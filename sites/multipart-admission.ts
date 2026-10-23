/** Per-isolate memory admission; sizes are reservations, never trusted body bounds. */
export const MULTIPART_BYTE_BUDGET = 22 * 1024 * 1024;
export const MULTIPART_REQUEST_BUDGET = 4;

export function declaredContentLength(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const length = Number(value);
  return Number.isSafeInteger(length) && length >= 0 ? length : null;
}

export function createMultipartAdmission() {
  let activeRequests = 0, reservedBytes = 0;
  return {
    acquire(declaredBytes: number | null) {
      const reservation = declaredBytes ?? MULTIPART_BYTE_BUDGET;
      if (!Number.isSafeInteger(reservation) || reservation < 0 || activeRequests >= MULTIPART_REQUEST_BUDGET || reservedBytes + reservation > MULTIPART_BYTE_BUDGET) return null;
      activeRequests++; reservedBytes += reservation;
      let released = false;
      return { reservedBytes: reservation, release() {
        if (released) return;
        released = true; activeRequests--; reservedBytes -= reservation;
      } };
    },
    usage() { return { activeRequests, reservedBytes }; },
  };
}

export function boundRequestBody(body: ReadableStream<Uint8Array>, limit: number, onExceeded: () => void) {
  let bytes = 0;
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > limit) { onExceeded(); throw new Error("Request body limit exceeded."); }
      controller.enqueue(chunk);
    },
  }));
}
