export interface ColumnHeader {
  column_names: string[];
  column_types: string[];
}

export interface RawResponse {
  time: number;
  header: ColumnHeader;
  data: unknown[][][];
}

export interface ErrorResponse {
  error: string;
  error_details?: string;
}

export type QueryResponse = RawResponse | ErrorResponse;

export interface ChangeInfo {
  changeID: number;
  hex: string;
}

export type Row = Record<string, unknown>;

export type ColumnType = string;

export interface ClientConfig {
  host?: string;
  token?: string;
  bigIntColumns?: boolean;
}

/**
 * A generic thenable — an object with a `then` method that makes it
 * compatible with `await`.  `TValue` is the resolved type (defaults
 * to `Row[]`).
 */
export interface Thenable<TValue = Row[]> {
  then<TResult1 = TValue, TResult2 = never>(
    onfulfilled?: ((value: TValue) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
}
