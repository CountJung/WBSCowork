/**
 * Miniflare 4.20260515 wraps an Undici fetch Response around its original stream.
 * Undici 7.24.8 can GC the original Response and cancel that shared stream while
 * callers still retain the wrapper. Drain at the transport boundary, before a
 * second request/GC, and return an independent single-use response for assertions.
 * This is QA transport only: never retries requests or hides body read failures.
 */
export async function consumeWorkerResponse(response, { route = "unknown", method = "GET" } = {}) {
  const context = `${method} ${new URL(route, "https://synthetic.invalid").pathname} (${response.status})`;
  if (response.bodyUsed || response.body?.locked) {
    throw new Error(`Worker QA response is already consumed or locked: ${context}`);
  }
  let bytes;
  try {
    bytes = response.body === null ? null : await response.arrayBuffer();
  } catch (cause) {
    throw new Error(`Worker QA response body read failed: ${context}`, { cause });
  }
  const snapshot = new Response(bytes, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
  for (const key of ["url", "redirected", "type"]) {
    Object.defineProperty(snapshot, key, { value: response[key] });
  }
  return snapshot;
}
