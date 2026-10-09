/** Draft goals may be blank; completion policy requires filled deliverable/definition-of-done. */
export function normalizeWorkGoal(value: string | null | undefined, label: string): string {
  const text = value?.trim() ?? "";
  if (text.length > 2000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
    throw new Error(`${label}는 제어문자 없이 2000자 이내로 입력해 주세요.`);
  }
  return text;
}
