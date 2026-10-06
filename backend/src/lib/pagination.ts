import {AuthError} from "../types/auth.types.js";
export function pageNumber(value: unknown, fallback: number, maximum = 2147483647) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > maximum) throw new AuthError(400, "Invalid pagination parameters.");
  return Number(value);
}
