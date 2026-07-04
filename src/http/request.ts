import { TuringDBException } from "../exceptions";

export interface RequestOpts {
  host: string;
  path: string;
  body?: string;
  params?: Record<string, string | undefined>;
  headers: Record<string, string>;
  signal?: AbortSignal;
}

export async function sendRequest(opts: RequestOpts): Promise<unknown> {
  const { host, path, body = "", params, headers, signal } = opts;

  const url = new URL(path, host);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
  }

  let resp: Response;
  try {
    resp = await fetch(url.toString(), {
      method: "POST",
      headers,
      body: body || undefined,
      signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new TuringDBException(`Connection error: ${msg}`);
  }

  const text = await resp.text();

  if (!resp.ok) {
    throw new TuringDBException(
      `HTTP ${resp.status} ${resp.statusText}${text ? `: ${text.trim()}` : ""}`,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new TuringDBException(
      `Invalid response from the server: ${text.slice(0, 200)}`,
    );
  }

  if (typeof json === "object" && json !== null && "error" in json) {
    const err = json as { error: string; error_details?: string };
    throw new TuringDBException(
      err.error_details ? `${err.error}: ${err.error_details}` : err.error,
    );
  }

  return json;
}
