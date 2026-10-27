import { validateAttachmentImage } from "@/src/shared/lib/attachment-preview";

export const MEDIA_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const MEDIA_VIDEO_MAX_BYTES = 20 * 1024 * 1024;
export const MEDIA_REQUEST_MAX_BYTES = 21 * 1024 * 1024;
export const mediaMimeTypes = ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"] as const;
export type MediaMime = typeof mediaMimeTypes[number];
export type MediaVisibility = "team_private" | "project";
export type MediaFields = { title: string; caption: string; visibility: MediaVisibility };
export type ProjectMediaItem = MediaFields & {
  id: number; projectId: number; teamId: number; teamName: string; version: number;
  createdBy: number; createdAt: string; updatedAt: string; fileName: string;
  mimeType: MediaMime; sizeBytes: number; canEdit: boolean; fileUrl: string;
};
export type MediaTeam = { id: number; name: string; canUpload: boolean };
export class ProjectMediaError extends Error {
  constructor(readonly code: "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT" | "UNAVAILABLE" | "TOO_LARGE") { super(code); this.name = "ProjectMediaError"; }
  get status() { return this.code === "INVALID_INPUT" ? 400 : this.code === "NOT_FOUND" ? 404 : this.code === "CONFLICT" ? 409 : this.code === "TOO_LARGE" ? 413 : 503; }
}
export function mediaId(value: unknown): number {
  if (typeof value === "string" && /^[1-9]\d*$/.test(value) && String(Number(value)) === value) value = Number(value);
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new ProjectMediaError("NOT_FOUND");
  return value;
}
export function mediaMutationKey(value: unknown): string {
  if (typeof value !== "string" || value.length !== 36 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new ProjectMediaError("INVALID_INPUT");
  return value.toLowerCase();
}
export function normalizeMediaFields(input: unknown): MediaFields {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ProjectMediaError("INVALID_INPUT");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => !["title", "caption", "visibility"].includes(key))) throw new ProjectMediaError("INVALID_INPUT");
  if (typeof value.title !== "string" || !value.title.isWellFormed() || !value.title.trim() || [...value.title].length > 120 || /[\x00-\x1f\x7f-\x9f]/.test(value.title)) throw new ProjectMediaError("INVALID_INPUT");
  if (typeof value.caption !== "string" || !value.caption.isWellFormed() || [...value.caption].length > 2000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(value.caption)) throw new ProjectMediaError("INVALID_INPUT");
  if (value.visibility !== "team_private" && value.visibility !== "project") throw new ProjectMediaError("INVALID_INPUT");
  return { title: value.title.trim(), caption: value.caption, visibility: value.visibility };
}
export function validateMediaFileName(name: string, mime: MediaMime): void {
  const extensions: Record<MediaMime, readonly string[]> = { "image/png": ["png"], "image/jpeg": ["jpg", "jpeg"], "image/webp": ["webp"], "video/mp4": ["mp4"], "video/webm": ["webm"] };
  if (!name.isWellFormed() || !name.trim() || [...name].length > 255 || /[\x00-\x1f\x7f]/.test(name) || !extensions[mime].includes(name.split(".").at(-1)?.toLowerCase() ?? "")) throw new ProjectMediaError("INVALID_INPUT");
}
/** Validate actual bounded bytes and MIME. Extensions never authorize active content. */
export function validateMediaBytes(bytes: Uint8Array, mime: string, configuredMax = MEDIA_VIDEO_MAX_BYTES): MediaMime {
  if (!mediaMimeTypes.includes(mime as MediaMime) || !Number.isSafeInteger(configuredMax) || configuredMax < 1 || bytes.length < 1) throw new ProjectMediaError("INVALID_INPUT");
  if (bytes.length > Math.min(configuredMax, mime.startsWith("image/") ? MEDIA_IMAGE_MAX_BYTES : MEDIA_VIDEO_MAX_BYTES)) throw new ProjectMediaError("TOO_LARGE");
  if (mime.startsWith("image/")) {
    try { validateAttachmentImage(bytes, mime); } catch { throw new ProjectMediaError("INVALID_INPUT"); }
    // Containers must not be truncated before their mandatory final marker.
    if (mime === "image/png" && (bytes.length < 45 || String.fromCharCode(...bytes.subarray(bytes.length - 8, bytes.length - 4)) !== "IEND")) throw new ProjectMediaError("INVALID_INPUT");
    if (mime === "image/jpeg" && (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9)) throw new ProjectMediaError("INVALID_INPUT");
    if (mime === "image/webp" && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8 !== bytes.length) throw new ProjectMediaError("INVALID_INPUT");
  } else if (mime === "video/mp4") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const text = (at: number, size: number) => String.fromCharCode(...bytes.subarray(at, at + size));
    if (bytes.length < 24 || text(4, 4) !== "ftyp") throw new ProjectMediaError("INVALID_INPUT");
    const ftypSize = view.getUint32(0);
    if (ftypSize < 16 || ftypSize > 1024 || ftypSize > bytes.length || ![text(8, 4), ...Array.from({ length: Math.floor((ftypSize - 16) / 4) }, (_, i) => text(16 + i * 4, 4))].some(brand => /^(isom|iso[2-9]|mp4[12]|avc1|M4V )$/.test(brand))) throw new ProjectMediaError("INVALID_INPUT");
    let media = false, movie = false, count = 0;
    for (let at = ftypSize; at < bytes.length;) {
      if (at + 8 > bytes.length || ++count > 2048) throw new ProjectMediaError("INVALID_INPUT");
      const size = view.getUint32(at), kind = text(at + 4, 4);
      if (size < 8 || at + size > bytes.length) throw new ProjectMediaError("INVALID_INPUT");
      if (kind === "mdat") media = true;
      if (kind === "moov") movie = true;
      at += size;
    }
    if (!media || !movie) throw new ProjectMediaError("INVALID_INPUT");
  } else {
    // EBML header, exact WebM DocType and a Segment marker are required; Matroska is not accepted.
    if (bytes.length < 16 || ![0x1a, 0x45, 0xdf, 0xa3].every((value, i) => bytes[i] === value)) throw new ProjectMediaError("INVALID_INPUT");
    const prefix = bytes.subarray(0, Math.min(bytes.length, 4096));
    const contains = (needle: number[]) => prefix.some((_value, i) => needle.every((value, j) => prefix[i + j] === value));
    if (!contains([0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]) || !contains([0x18, 0x53, 0x80, 0x67])) throw new ProjectMediaError("INVALID_INPUT");
  }
  return mime as MediaMime;
}
