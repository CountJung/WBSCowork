/**
 * Server Action 은 성공/실패를 모두 `redirect()` 로 끝낸다.
 * Next 는 이때 `NEXT_REDIRECT;<mode>;<url>;<status>;` digest 를 가진 오류를 던지므로,
 * 이를 잡아 실제 이동 대상을 확인한다.
 */
export type ActionOutcome = {
  status: "success" | "error" | null;
  message: string | null;
  path: string;
};

function parseRedirectDigest(digest: string): string {
  const parts = digest.split(";");

  if (parts[0] !== "NEXT_REDIRECT") {
    throw new Error(`redirect digest 형식이 예상과 다릅니다: ${digest}`);
  }

  return parts[2];
}

/** action 을 실행하고 최종 redirect 결과를 해석한다. redirect 없이 끝나면 실패로 본다. */
export async function runAction(action: () => Promise<unknown>): Promise<ActionOutcome> {
  try {
    await action();
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;

    if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT")) {
      throw error;
    }

    const target = parseRedirectDigest(digest);
    const url = new URL(target, "http://127.0.0.1");

    return {
      status: url.searchParams.get("status") as "success" | "error" | null,
      message: url.searchParams.get("message"),
      path: url.pathname,
    };
  }

  throw new Error("action 이 redirect 없이 종료했습니다. 성공/실패 경로를 확인하십시오.");
}

export function formDataFrom(values: Record<string, string | number>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, String(value));
  }

  return formData;
}
