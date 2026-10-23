import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("PPTX resolves the patched image parser and zero-length image boxes cannot hang it", () => {
  const require = createRequire(import.meta.url);
  const pptxRequire = createRequire(require.resolve("pptxgenjs"));
  const parser = pptxRequire.resolve("image-size");
  const metadata = JSON.parse(readFileSync(path.resolve(path.dirname(parser), "../../package.json"), "utf8")) as { version: string };
  assert.match(metadata.version, /^2\.0\.(?:[3-9]|[1-9]\d+)$/, "GHSA-5p2g-fcmc-qvqq / GHSA-w3rx-r6r6-pgpr require image-size >=2.0.3");
  // Isolate parser regressions behind a hard process timeout so an accidental
  // vulnerable dependency cannot freeze the entire test runner.
  const script = `
    const assert = require('node:assert/strict');
    const {imageSize} = require(process.argv[1]);
    const png = Buffer.from('89504e470d0a1a0a0000000d494844520000000200000003', 'hex');
    assert.deepEqual(imageSize(png), {width:2,height:3,type:'png'});
    const icns = Buffer.alloc(16); icns.write('icns'); icns.writeUInt32BE(16,4); icns.write('ic07',8);
    const heif = Buffer.from('00000010667479706865696300000000000000006d657461', 'hex');
    const jxl = Buffer.from('0000000c4a584c200d0a870a00000014667479706a786c20000000006a786c20000000006a786c70', 'hex');
    for (const bytes of [icns,heif,jxl]) assert.throws(() => imageSize(bytes));
  `;
  const result = spawnSync(process.execPath, ["-e", script, parser], { timeout: 3000, encoding: "utf8" });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});
