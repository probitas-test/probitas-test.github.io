import { readFile } from "node:fs/promises";
import { client, expect, scenario } from "@probitas-test/probitas";
import { getPackageList } from "../data/api-pages.ts";
import { docPages } from "../data/docs.ts";

const BASE_URL = process.env.DOCS_BASE_URL ?? "http://localhost:8000";

async function loadDocHeadings(): Promise<Record<string, string>> {
  const headings: Record<string, string> = {};
  for (const doc of docPages) {
    try {
      const content = await readFile(
        new URL(doc.file, new URL("../", import.meta.url)),
        "utf8",
      );
      const match = content.match(/^# .+/m);
      if (match) {
        headings[doc.path] = match[0];
      }
    } catch {
      // Ignore missing local files; remote check will still validate status/ctype
    }
  }
  return headings;
}

const docHeadings = await loadDocHeadings();

export default scenario("Probitas docs site health", {
  tags: ["smoke", "docs"],
})
  .resource("http", () =>
    client.http.createHttpClient({
      url: BASE_URL,
    }))
  .step("serves LLM-friendly markdown at /index.md", async ({ resources }) => {
    const res = await resources.http.get("/index.md", {
      headers: { accept: "text/markdown" },
    });

    expect(res)
      .toBeOk()
      .toHaveStatus(200)
      .toHaveHeadersPropertyContaining("content-type", "text/markdown")
      .toHaveTextContaining("This is a Markdown page for LLMs.")
      .toHaveTextContaining("# Probitas");
  })
  .step("serves human homepage HTML", async ({ resources }) => {
    const res = await resources.http.get("/", {
      query: { human: "1" },
      headers: { accept: "text/html" },
    });

    expect(res)
      .toBeOk()
      .toHaveStatus(200)
      .toHaveHeadersPropertyContaining("content-type", "text/html")
      .toHaveTextContaining("Probitas - Scenario-based Testing Framework")
      .toHaveTextContaining(
        "Scenario-based testing framework designed for API, database, and message queue testing",
      )
      .toHaveTextContaining("AI-Friendly Documentation");
  })
  .step("exposes raw markdown for docs pages", async ({ resources }) => {
    for (const doc of docPages) {
      const res = await resources.http.get(`${doc.path}index.md`);
      const heading = docHeadings[doc.path] ?? "# ";
      expect(res)
        .toBeOk()
        .toHaveStatus(200)
        .toHaveHeadersPropertyContaining("content-type", "text/markdown")
        .toHaveTextContaining(heading);
    }
  })
  .step("renders docs HTML pages", async ({ resources }) => {
    for (const doc of docPages) {
      const res = await resources.http.get(doc.path, {
        headers: { accept: "text/html" },
      });
      expect(res)
        .toBeOk()
        .toHaveStatus(200)
        .toHaveHeadersPropertyContaining("content-type", "text/html")
        .toHaveTextContaining(doc.label);
    }
  })
  .step("provides LLM endpoints", async ({ resources }) => {
    const indexRes = await resources.http.get("/llms.txt");
    expect(indexRes)
      .toBeOk()
      .toHaveStatus(200)
      .toHaveHeadersPropertyContaining("content-type", "text/markdown")
      .toHaveTextContaining("## Documentation")
      .toHaveTextContaining("## API Reference");
  })
  .step("renders API index and package JSON", async ({ resources }) => {
    const indexRes = await resources.http.get("/api/", {
      headers: { accept: "text/html" },
    });
    expect(indexRes).toBeOk().toHaveStatus(200).toHaveTextContaining(
      "API Reference",
    );

    const packages = await getPackageList();
    for (const pkg of packages) {
      const res = await resources.http.get(`/api/${pkg.name}/index.json`);
      expect(res)
        .toBeOk()
        .toHaveStatus(200)
        .toHaveHeadersPropertyContaining("content-type", "application/json")
        .toHaveJsonMatching({ name: pkg.name, specifier: pkg.specifier });
    }
  })
  .step("renders API markdown endpoints", async ({ resources }) => {
    const packages = await getPackageList();
    for (const pkg of packages) {
      const res = await resources.http.get(`/api/${pkg.name}/index.md`);
      expect(res)
        .toBeOk()
        .toHaveStatus(200)
        .toHaveHeadersPropertyContaining("content-type", "text/markdown")
        .toHaveTextContaining(pkg.specifier);
    }
  })
  .step("serves static assets", async ({ resources }) => {
    const res = await resources.http.get("/static/common.css");
    expect(res).toBeOk().toHaveStatus(200).toHaveHeadersPropertyContaining(
      "content-type",
      "text/css",
    );
  })
  .build();
