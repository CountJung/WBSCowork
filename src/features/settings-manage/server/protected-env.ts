const protectedKeys = new Set(["DB_SCHEMA_USER", "DB_SCHEMA_PASSWORD"]);

export function isProtectedEnvKey(key: string) {
  return protectedKeys.has(key);
}

/** Match the dotenv grammar bundled with @next/env, without variable expansion. */
function envTokens(content: string) {
  // dotenv normalizes CR/CRLF before parsing. Map offsets back to the original
  // text so privileged declarations can be retained byte-for-byte on save.
  let normalized = "";
  const offsets: number[] = [];
  for (let index = 0; index < content.length; index += 1) {
    offsets.push(index);
    if (content[index] === "\r") {
      normalized += "\n";
      if (content[index + 1] === "\n") index += 1;
    } else normalized += content[index];
  }
  offsets.push(content.length);
  const declarations = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm;
  return [...normalized.matchAll(declarations)].map(match => {
    let value = (match[2] ?? "").trim();
    const quote = value[0];
    value = value.replace(/^(['"`])([\s\S]*)\1$/gm, "$2");
    if (quote === '"') value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
    let end = offsets[match.index + match[0].length];
    if (content[end] === "\r") {
      end += 1;
      if (content[end] === "\n") end += 1;
    } else if (content[end] === "\n") end += 1;
    return { key: match[1], value, start: offsets[match.index], end };
  });
}

export function parseEnvFileContent(content: string) {
  return new Map(envTokens(content).map(({ key, value }) => [key, value]));
}

/** Keep privileged entries server-side, including exported and multiline values. */
export function splitProtectedEnvContent(content: string) {
  const editable: string[] = [];
  const protectedParts: string[] = [];
  let cursor = 0;
  for (const token of envTokens(content)) {
    if (!isProtectedEnvKey(token.key)) continue;
    editable.push(content.slice(cursor, token.start));
    protectedParts.push(content.slice(token.start, token.end));
    cursor = token.end;
  }
  editable.push(content.slice(cursor));
  const protectedContent = protectedParts.reduce((saved, part) => {
    const separator = saved && !/[\r\n]$/.test(saved) && !/^[\r\n]/.test(part) ? "\n" : "";
    return saved + separator + part;
  }, "");
  return { editableContent: editable.join(""), protectedContent };
}

export function validateEditableEnvKeys(entries: readonly (readonly [string, string])[]) {
  for (const [key] of entries) {
    if (!/^[\w.-]+$/.test(key) || isProtectedEnvKey(key)) {
      throw new Error("편집할 수 없는 환경 설정 키가 포함되어 있습니다.");
    }
  }
}

/** Choose an encoding that the same dotenv grammar can read without value loss. */
export function serializeEnvValue(value: string) {
  const doubleQuoted = value.replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  const candidates = [
    ...(!/[\r\n]/.test(value) && !/^[\s]*['"`]/.test(value) ? [value] : []),
    ...(!doubleQuoted.includes('"') && !doubleQuoted.endsWith("\\") ? [`"${doubleQuoted}"`] : []),
    ...(!value.includes("'") && !value.endsWith("\\") ? [`'${value}'`] : []),
    ...(!value.includes("`") && !value.endsWith("\\") ? ["`" + value + "`"] : []),
  ];
  for (const candidate of candidates) {
    const parsed = parseEnvFileContent(`VALUE=${candidate}\n`);
    if (parsed.size === 1 && parsed.get("VALUE") === value) return candidate;
  }
  throw new Error("값을 보존할 수 없는 환경 설정 형식입니다. 인용부호와 줄바꿈을 확인하십시오.");
}

export function assertEnvContentMatches(content: string, expected: ReadonlyMap<string, string>) {
  const actual = parseEnvFileContent(content);
  if (actual.size !== expected.size || [...expected].some(([key, value]) => actual.get(key) !== value)) {
    throw new Error("환경 설정 직렬화 검증에 실패했습니다. 설정 파일을 확인하십시오.");
  }
}
