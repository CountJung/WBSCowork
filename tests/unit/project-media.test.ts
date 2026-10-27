import assert from "node:assert/strict";
import { test } from "node:test";
import { mediaId, mediaMutationKey, normalizeMediaFields, validateMediaBytes, validateMediaFileName } from "../../src/entities/project-media";

const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"));
test("media validates actual image bytes and rejects active or mismatched content", () => {
  assert.equal(validateMediaBytes(png, "image/png"), "image/png");
  for (const mime of ["image/jpeg", "image/webp", "image/svg+xml", "text/html", "video/mp4", "video/webm"]) assert.throws(() => validateMediaBytes(png, mime));
  assert.throws(() => validateMediaBytes(new TextEncoder().encode("<script>alert(1)</script>"), "image/png"));
  assert.throws(() => validateMediaBytes(png.slice(0, -12), "image/png"));
  const enormous = png.slice(); new DataView(enormous.buffer).setUint32(16, 9000); assert.throws(() => validateMediaBytes(enormous, "image/png"));
  assert.throws(() => validateMediaBytes(png, "image/png", 10));
  validateMediaFileName("긴 한국어 합성 사진.PNG", "image/png");
  assert.throws(() => validateMediaFileName("image.html", "image/png"));
  assert.throws(() => validateMediaFileName("image.svg", "image/png"));
});
test("media fields default policy cannot be overridden with unsupported visibility or hidden inputs", () => {
  assert.deepEqual(normalizeMediaFields({ title: " 합성 사진 ", caption: "설명\n둘째 줄", visibility: "team_private" }), { title: "합성 사진", caption: "설명\n둘째 줄", visibility: "team_private" });
  for (const patch of [{ visibility: "public" }, { visibility: "internet" }, { title: "" }, { title: "a".repeat(121) }, { caption: "a".repeat(2001) }, { title: "bad\nheader" }, { isSuperuser: true }, { authorId: 9 }]) assert.throws(() => normalizeMediaFields({ title: "합성", caption: "", visibility: "project", ...patch }));
});
test("media IDs and retry tokens reject malformed paths and ambiguous values", () => {
  assert.equal(mediaId("123"), 123);
  for (const value of ["01", "1.0", "../1", "1e2", "1?project=2", "0", -1, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => mediaId(value));
  const key = "00000000-0000-4000-8000-000000000001"; assert.equal(mediaMutationKey(key), key);
  for (const value of ["", "../token", "__proto__", "0".repeat(36), key + "\n"]) assert.throws(() => mediaMutationKey(value));
});
