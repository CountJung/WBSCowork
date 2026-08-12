import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { initializeServerLogging, logInfo } = await import("@/src/shared/server/logging/index.server");

  await initializeServerLogging();
  await logInfo("instrumentation", "Next.js instrumentation registered", {
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
  });
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { logError, serializeError } = await import("@/src/shared/server/logging/index.server");

  await logError("request", "Next.js request error captured", {
    error: serializeError(error),
    request: {
      method: request.method,
      path: request.path,
    },
    context,
  });
};
