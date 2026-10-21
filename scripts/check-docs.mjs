/** Repository-local documentation checks; not the unavailable docs-canon checker. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const core = ["PRODUCT_SPEC.md", "MASTER_PLAN.html", "TODO.md", "ARCHITECTURE.md", "PROJECT_MAP.md", "HARNESS_MAP.md", "COMPLETED_LOG.md"];
const withoutFences = (text) => text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, "");
const slug = (text) => text.toLowerCase().replace(/<[^>]*>/g, "").replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu, "").replace(/\s/g, "-");
function anchors(text) {
  const ids = new Set([...text.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]));
  const seen = new Map();
  for (const match of withoutFences(text).matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const id = slug(match[1]);
    const count = seen.get(id) ?? 0;
    ids.add(count ? `${id}-${count}` : id);
    seen.set(id, count + 1);
  }
  return ids;
}
function links(text) {
  const prose = withoutFences(text);
  return [
    ...[...prose.matchAll(/!?\[[^\]\n]*\]\(<?([^\s)>]+)>?(?:\s+["'][^\n]*?["'])?\)/g)].map((m) => m[1]),
    ...[...prose.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)].map((m) => m[1]),
    ...[...prose.matchAll(/^\s*\[[^\]]+\]:\s*<?([^\s>]+)>?/gm)].map((m) => m[1]),
  ];
}
function inspect(documents, scripts, exists) {
  const errors = [];
  let linkCount = 0;
  let commandCount = 0;
  for (const [name, text] of documents) {
    if (/\p{Cf}/u.test(text)) errors.push(`${name}: invisible formatting character`);
    for (const url of links(text)) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) continue;
      linkCount++;
      const [file, fragment] = url.split("#");
      const target = file ? path.posix.normalize(path.posix.join(file.startsWith("/") ? "." : path.posix.dirname(name), decodeURIComponent(file.replace(/^\//, "")))) : name;
      if (target.startsWith("../") || !exists(target)) errors.push(`${name}: missing local target ${url}`);
      else if (fragment && documents.has(target) && !anchors(documents.get(target)).has(decodeURIComponent(fragment))) errors.push(`${name}: missing anchor ${url}`);
    }
    // Backticked root-relative documentation paths in tool guidance are references too.
    for (const match of withoutFences(text).matchAll(/`(docs\/[^`\s]+\.(?:md|html)(?:#[^`\s]+)?)`/g)) {
      const [target, fragment] = match[1].split("#");
      if (!exists(target)) errors.push(`${name}: missing documentation reference ${match[1]}`);
      else if (fragment && documents.has(target) && !anchors(documents.get(target)).has(fragment)) errors.push(`${name}: missing documentation reference anchor ${match[1]}`);
    }
    for (const match of text.matchAll(/\bnpm run ([a-z][a-z\d:_-]*)/g)) {
      commandCount++;
      if (!Object.hasOwn(scripts, match[1])) errors.push(`${name}: unknown npm script ${match[1]}`);
    }
    if (name.endsWith(".html")) {
      const ids = [...text.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]);
      if (new Set(ids).size !== ids.length) errors.push(`${name}: duplicate HTML id`);
      if (!/<!doctype html>/i.test(text) || !/<html\b[^>]*lang=/i.test(text) || !/<title>.+?<\/title>/s.test(text)) errors.push(`${name}: missing standalone HTML metadata`);
      if (/<(?:script|link)\b[^>]*(?:src|href)=["'](?:https?:)?\/\//i.test(text) || /@import\s+(?:url\()?\s*["']?https?:/i.test(text)) errors.push(`${name}: external runtime asset`);
    }
  }
  return { errors, documents: documents.size, links: linkCount, commands: commandCount };
}
function registration(documents) {
  const errors = [];
  const registry = documents.get("AGENTS.md") ?? "";
  const registered = links(registry).filter((url) => /^docs\/.*\.(md|html)$/.test(url));
  const actual = [...documents.keys()].filter((name) => name.startsWith("docs/"));
  if (new Set(registered).size !== registered.length) errors.push("AGENTS.md: duplicate document registration");
  for (const name of actual) if (!registered.includes(name)) errors.push(`AGENTS.md: unregistered document ${name}`);
  for (const name of core) if (!documents.has(`docs/${name}`)) errors.push(`missing core role docs/${name}`);
  if (documents.get("CLAUDE.md")?.trim() !== "@AGENTS.md") errors.push("CLAUDE.md must point to AGENTS.md");
  for (const name of ["TODO.md", "PROJECT_MAP.md", "ARCHITECTURE.md", "HARNESS_MAP.md"]) {
    if (!registry.includes(`docs/${name}`)) errors.push(`AGENTS.md: missing reading entry ${name}`);
  }
  for (const name of actual) if (/\d{4}-\d{2}-\d{2}/.test(name)) errors.push(`dated report outside current document policy: ${name}`);
  return errors;
}
function selfTest() {
  const valid = new Map([["a.md", "# A\n[ok](b.md#중복-제목-1)\n`npm run lint`"], ["b.md", "# 중복 제목\n# 중복 제목"]]);
  const check = (docs) => inspect(docs, { lint: "eslint" }, (name) => docs.has(name));
  assert.deepEqual(check(valid).errors, []);
  const broken = new Map([["a.md", "[missing](gone.md)\n[anchor](b.md#missing)\n`npm run invented`"], ["b.md", "# B"]]);
  assert.equal(check(broken).errors.length, 3);
  assert.equal(check(new Map([["a.md", "`docs/gone.md`"]])).errors.length, 1);
  assert.equal(check(new Map([["a.html", '<!doctype html><html lang="ko"><title>A</title><div id="x"></div><div id="x"></div><script src="https://example.invalid/a.js"></script></html>']])).errors.length, 2);
  assert.equal(check(new Map([["a.md", "text\uFEFF"]])).errors.length, 1);
  assert.equal(check(new Map([["a.md", "```md\n[example](missing.md)\n```"]])).errors.length, 0);
  assert(registration(new Map([["AGENTS.md", "[a](docs/TODO.md) [a](docs/TODO.md)"]])).includes("AGENTS.md: duplicate document registration"));
  assert(registration(new Map([["docs/2026-01-01.md", "# Old"]])).some((message) => message.startsWith("dated report")));
  console.log("PASS docs checker self-test: valid links/Unicode/duplicate headings; missing path/anchor/script, HTML ids/assets, invisible character, fenced example, registration/policy");
}
if (process.argv.includes("--self-test")) selfTest();
else {
  const names = new Set(execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean));
  // Include newly added docs before staging, without reading unrelated untracked files.
  function walkDocs(directory) {
    for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const name = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walkDocs(name);
      else if (/\.(md|html)$/.test(name)) names.add(name);
    }
  }
  walkDocs("docs");
  const documents = new Map([...names].filter((name) => /\.(md|html)$/.test(name) && existsSync(path.join(root, name))).map((name) => [name, readFileSync(path.join(root, name), "utf8")]));
  const { scripts } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const result = inspect(documents, scripts, (name) => existsSync(path.join(root, name)));
  result.errors.push(...registration(documents));
  if (result.errors.length) {
    console.error(result.errors.join("\n"));
    process.exitCode = 1;
  } else console.log(`PASS local docs: ${result.documents} documents, ${[...documents.keys()].filter((name) => name.startsWith("docs/")).length} registered docs (${core.length} core), ${result.links} local links, ${result.commands} npm commands. Original docs-canon checker not run.`);
}
