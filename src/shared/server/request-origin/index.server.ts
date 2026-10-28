import { getHostedRequestContext, isHostedRuntime } from "@/src/shared/server/hosted-runtime/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";

export class BrowserOriginError extends Error {
  constructor(readonly status: 403 | 503, readonly code: "INVALID_ORIGIN" | "INVALID_CONFIGURATION") { super(code); }
}

function canonicalOrigin(value: string): string {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid origin");
    return url.origin;
  } catch { throw new BrowserOriginError(503, "INVALID_CONFIGURATION"); }
}

/** Browser mutation CSRF check. Native proxy configuration remains authoritative. */
export function assertBrowserOrigin(request: Request): void {
  const configured = getRuntimeEnv().auth.nextAuthUrl;
  let expected: string;
  if (isHostedRuntime()) {
    const context = getHostedRequestContext();
    if (!context) throw new BrowserOriginError(503, "INVALID_CONFIGURATION");
    // Parse even when the pinned origin matches: malformed server configuration fails closed.
    const legacyOrigin = configured === undefined ? undefined : canonicalOrigin(configured);
    if (context.ingressOrigin !== context.publicOrigin && context.ingressOrigin !== legacyOrigin) throw new BrowserOriginError(403, "INVALID_ORIGIN");
    expected = context.ingressOrigin;
  } else {
    expected = canonicalOrigin(configured ?? request.url);
  }
  if (request.headers.get("Origin") !== expected) throw new BrowserOriginError(403, "INVALID_ORIGIN");
}
