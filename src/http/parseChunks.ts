import { TuringDBException } from "../exceptions";
import { coerceValue } from "../protocol";
import type { RawResponse, Row } from "../types";

export interface ParsedResult {
  rows: Row[];
  columns: { name: string; type: string }[];
  time: number;
}

export function parseChunks(
  json: RawResponse,
  bigIntColumns = false,
): ParsedResult {
  const { time, header } = json;
  const { column_names, column_types } = header;

  if (column_names.length !== column_types.length) {
    throw new TuringDBException(
      "Query response column names and types do not match",
    );
  }

  const columns = column_names.map((name, i) => ({
    name,
    type: column_types[i],
  }));

  const rows: Row[] = [];
  for (const chunk of json.data) {
    const len = (chunk[0] as unknown[])?.length ?? 0;
    for (let i = 0; i < len; i++) {
      const row: Row = {};
      column_names.forEach((name, ci) => {
        row[name] = coerceValue(
          (chunk[ci] as unknown[])?.[i],
          column_types[ci],
          bigIntColumns,
        );
      });
      rows.push(row);
    }
  }

  return { rows, columns, time };
}
