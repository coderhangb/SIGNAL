export class AppError extends Error {
  constructor(status, code, message, retryable = false) {
    super(message);
    Object.assign(this, { status, code, retryable });
  }
}
export function check(
  condition,
  message,
  status = 400,
  code = "INVALID_INPUT",
) {
  if (!condition) throw new AppError(status, code, message);
}
export function object(value, keys) {
  check(
    value && typeof value === "object" && !Array.isArray(value),
    "Expected an object.",
  );
  check(
    Object.keys(value).every((k) => keys.includes(k)),
    "Unexpected field.",
  );
  return value;
}
export function string(value, max = 2000, required = true) {
  check(
    typeof value === "string" &&
      value.length <= max &&
      (!required || value.trim().length > 0),
    `Expected text of at most ${max} characters.`,
  );
  return value;
}
export function revision(value) {
  check(Number.isInteger(value) && value >= 0, "Invalid revision.");
  return value;
}
export const statuses = [
  "confirmed",
  "needs_confirmation",
  "unknown",
  "not_available",
];
