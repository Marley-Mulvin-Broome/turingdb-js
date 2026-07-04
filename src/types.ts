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
