/** Both authorized download routes must return the same safe header contract. */
export function attachmentResponseHeaders(input: { fileName: string; mimeType?: string | null; size: number; inlineRequested: boolean }) {
  const candidate = input.mimeType?.trim().toLowerCase() ?? "";
  const mimeType = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(candidate) ? candidate : "application/octet-stream";
  const inline = input.inlineRequested && /^(image\/(png|jpeg|gif|webp|avif)|application\/pdf|text\/plain)$/.test(mimeType);
  const filename = encodeURIComponent(input.fileName).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${filename}`,
    "Content-Length": String(input.size),
    "Content-Type": mimeType,
  };
}
