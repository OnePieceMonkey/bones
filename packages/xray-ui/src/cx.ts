/** Join class names, dropping falsy values and empty strings. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((p): p is string => typeof p === "string" && p !== "").join(" ");
}
