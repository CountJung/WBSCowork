import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEnvFileContent, serializeEnvValue, splitProtectedEnvContent, validateEditableEnvKeys } from "../src/features/settings-manage/server/protected-env";
import { getEditableEnvEntries, getLegacyOverrideKeys, getManagedEnvKeys, saveEditableEnvEntries } from "../src/features/settings-manage/server/env-file.server";

test("protected schema entries follow Next dotenv export, multiline and CR boundaries", () => {
  for (const quote of ['"', "'", "`"]) {
    const protectedText = `export DB_SCHEMA_PASSWORD=${quote}synthetic\nPRIVATE_FRAGMENT=value${quote}\n`;
    const result = splitProtectedEnvContent(`APP_PORT=3000\n${protectedText}CUSTOM_SETTING=keep\n`);
    assert.equal(result.protectedContent.trim(), protectedText.trim());
    assert.deepEqual([...parseEnvFileContent(result.editableContent)], [["APP_PORT", "3000"], ["CUSTOM_SETTING", "keep"]]);
  }
  for (const fixture of [
    "APP_PORT=3000\rDB_SCHEMA_PASSWORD=synthetic\r",
    'DB_SCHEMA_PASSWORD=\n"synthetic\nPRIVATE_FRAGMENT=value"\n',
    'DB_SCHEMA_PASSWORD="synthetic\\\\"\nPRIVATE_FRAGMENT=value\nend"\n',
  ]) {
    const result = splitProtectedEnvContent(fixture);
    assert.ok(!result.editableContent.includes("synthetic"));
    assert.ok(!result.editableContent.includes("PRIVATE_FRAGMENT"));
  }
  assert.deepEqual([...parseEnvFileContent("export CUSTOM_SETTING=keep\rCUSTOM.SETTING=keep\r")], [["CUSTOM_SETTING", "keep"], ["CUSTOM.SETTING", "keep"]]);
  validateEditableEnvKeys([["CUSTOM.SETTING", "keep"], ["CUSTOM_SETTING", "keep"]]);
  assert.throws(() => validateEditableEnvKeys([["DB_SCHEMA_USER", "synthetic"]]));
  assert.throws(() => validateEditableEnvKeys([["DB_SCHEMA_PASSWORD", "synthetic"]]));
  assert.throws(() => validateEditableEnvKeys([["OTHER\nDB_SCHEMA_PASSWORD", "synthetic"]]));
});

test("dotenv values and protected declarations remain stable on repeated saves", () => {
  for (const value of ["", "simple", " leading and trailing ", "hash#value", 'double"quote', "single'quote", "back`tick", "back\\slash", "literal\\n", "two\nlines", '"wrapped"']) {
    assert.equal(parseEnvFileContent(`VALUE=${serializeEnvValue(value)}\n`).get("VALUE"), value);
  }
  const composed = `FIRST=${serializeEnvValue('"abc')}\nSECOND=${serializeEnvValue('end"')}\nDB_SCHEMA_PASSWORD=synthetic"\n`;
  assert.deepEqual([...parseEnvFileContent(composed)], [["FIRST", '"abc'], ["SECOND", 'end"'], ["DB_SCHEMA_PASSWORD", 'synthetic"']]);
  assert.ok(!splitProtectedEnvContent(composed).editableContent.includes("synthetic"));
  assert.throws(() => serializeEnvValue(['all"', "'", "`quotes\nline\\"].join("")));
  let protectedContent = 'DB_SCHEMA_USER=synthetic # comment\r\nDB_SCHEMA_PASSWORD="synthetic\nvalue"\r\n';
  const original = parseEnvFileContent(protectedContent);
  for (let i = 0; i < 5; i += 1) {
    const result = splitProtectedEnvContent(protectedContent);
    assert.deepEqual(parseEnvFileContent(result.protectedContent), original);
    assert.equal(result.protectedContent, protectedContent);
    protectedContent = result.protectedContent;
  }
});

test("native settings hide and preserve schema values while rejecting submitted replacements", async () => {
  // This check creates and retains its own files. It never reads the caller's .env.
  const originalCwd = process.cwd();
  for (const key of getManagedEnvKeys()) delete process.env[key];
  process.env.DB_SCHEMA_USER = "synthetic_process_schema";
  process.env.DB_SCHEMA_PASSWORD = "synthetic_process_value";
  const fixture = await mkdtemp(path.join(tmpdir(), "wbs-native-settings-"));
  const protectedText = 'export DB_SCHEMA_USER="synthetic_schema"\nDB_SCHEMA_PASSWORD="synthetic\nPRIVATE_FRAGMENT=value"\n';
  const localProtected = "DB_SCHEMA_PASSWORD='synthetic_local'\n";
  await writeFile(path.join(fixture, ".env"), `APP_PORT=3000\nexport CUSTOM_SETTING=keep\nCUSTOM.SETTING=keep\n${protectedText}`);
  await writeFile(path.join(fixture, ".env.local"), `APP_PORT=3001\nLOCAL_CUSTOM=keep\n${localProtected}`);
  process.chdir(fixture);
  try {
    const entries = await getEditableEnvEntries();
    assert.ok(entries.every(entry => !entry.key.startsWith("DB_SCHEMA_") && entry.key !== "PRIVATE_FRAGMENT"));
    assert.ok(!JSON.stringify(entries).includes("synthetic_schema"));
    assert.ok(!JSON.stringify(entries).includes("PRIVATE_FRAGMENT"));
    assert.deepEqual(await getLegacyOverrideKeys(), ["APP_PORT"]);
    const before = await readFile(path.join(fixture, ".env"), "utf8");
    await assert.rejects(saveEditableEnvEntries({ DB_SCHEMA_PASSWORD: "rejected" }));
    assert.equal(await readFile(path.join(fixture, ".env"), "utf8"), before);
    await assert.rejects(saveEditableEnvEntries({ "OTHER\nDB_SCHEMA_PASSWORD": "rejected" }));
    assert.equal(await readFile(path.join(fixture, ".env"), "utf8"), before);
    await saveEditableEnvEntries({ APP_PORT: "3002", LOG_DIR: path.join(fixture, "logs") });
    const saved = await readFile(path.join(fixture, ".env"), "utf8");
    const local = await readFile(path.join(fixture, ".env.local"), "utf8");
    assert.equal(splitProtectedEnvContent(saved).protectedContent.trim(), splitProtectedEnvContent(before).protectedContent.trim());
    assert.equal(splitProtectedEnvContent(local).protectedContent.trim(), localProtected.trim());
    assert.match(saved, /^CUSTOM_SETTING=keep$/m);
    assert.match(saved, /^CUSTOM\.SETTING=keep$/m);
    assert.match(local, /^LOCAL_CUSTOM=keep$/m);
    assert.doesNotMatch(local, /^APP_PORT=/m);
    assert.ok((await getEditableEnvEntries()).every(entry => !entry.key.startsWith("DB_SCHEMA_")));
    assert.equal(process.env.DB_SCHEMA_USER, "synthetic_process_schema");
    assert.equal(process.env.DB_SCHEMA_PASSWORD, "synthetic_process_value");
  } finally {
    process.chdir(originalCwd);
  }
});
