export const BUG_SCREENSHOT_LIMIT = 3;
export const BUG_SCREENSHOT_BYTES = 2 * 1024 * 1024;
export const BUG_SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type BugScreenshot = { id: number; report_id: number; file_name: string; file_mime_type: string; file_size_bytes: number };
export function validateScreenshotSelection(files: File[]) {
  if (files.length > BUG_SCREENSHOT_LIMIT) throw new Error("스크린샷은 최대 3개까지 첨부할 수 있습니다.");
  for (const file of files) {
    if (!BUG_SCREENSHOT_TYPES.includes(file.type as typeof BUG_SCREENSHOT_TYPES[number])) throw new Error("PNG, JPEG, WebP 이미지만 첨부할 수 있습니다.");
    if (file.size <= 0 || file.size > BUG_SCREENSHOT_BYTES) throw new Error("각 스크린샷은 비어 있지 않은 2MB 이하 이미지여야 합니다.");
  }
}
export async function validateScreenshotBytes(files: File[]) {
  validateScreenshotSelection(files);
  for (const file of files) {
    const b = new Uint8Array(await file.slice(0,32).arrayBuffer());
    const tail = new Uint8Array(await file.slice(-12).arrayBuffer());
    const text = (start: number, end: number) => String.fromCharCode(...b.slice(start,end));
    const png = b.length >= 24 && [...b.slice(0,8)].join() === "137,80,78,71,13,10,26,10" && text(12,16) === "IHDR" && [...tail].join() === "0,0,0,0,73,69,78,68,174,66,96,130";
    const jpeg = b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255 && tail.at(-2) === 255 && tail.at(-1) === 217;
    const webp = b.length >= 16 && text(0,4) === "RIFF" && text(8,12) === "WEBP" && ["VP8 ","VP8L","VP8X"].includes(text(12,16)) && new DataView(b.buffer).getUint32(4,true) + 8 === file.size;
    if (!(file.type === "image/png" ? png : file.type === "image/jpeg" ? jpeg : webp)) throw new Error("스크린샷의 실제 이미지 형식이 올바르지 않습니다.");
  }
}
