import type { ColumnType } from "./types";

const DTYPE_MAP: Record<string, string> = {
  String: "string",
  Int64: "number",
  UInt64: "number",
  Double: "number",
  Bool: "boolean",
};

export function mapDType(columnType: ColumnType): string {
  return DTYPE_MAP[columnType] ?? "object";
}

export function coerceValue(
  value: unknown,
  columnType: ColumnType,
  bigIntColumns = false,
): unknown {
  if (value === null || value === undefined) return null;

  switch (columnType) {
    case "String":
      return String(value);
    case "Int64":
    case "UInt64":
      if (
        bigIntColumns &&
        (typeof value === "string" || typeof value === "number")
      ) {
        try {
          return BigInt(value);
        } catch {
          return Number(value);
        }
      }
      return Number(value);
    case "Double":
      return Number(value);
    case "Bool":
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      if (typeof value === "string") return value.toLowerCase() === "true";
      return Boolean(value);
    default:
      return value;
  }
}
