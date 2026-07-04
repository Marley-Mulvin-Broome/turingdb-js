import { Chain, type Op } from "../chain";
import { TuringDBException } from "../exceptions";
import type { ChangeInfo, ClientConfig, RawResponse, Row } from "../types";
import { parseChunks } from "./parseChunks";
import { sendRequest } from "./request";

const DEFAULT_HOST = "http://localhost:6666";

export class HTTPClient {
  readonly host: string;
  private readonly _bigIntColumns: boolean;
  private readonly _headers: Record<string, string>;
  private readonly _params: { graph: string; change?: string; commit?: string };
  private readonly _chain = new Chain();
  private _queryExecTime?: number;
  private _totalExecTime?: number;
  private _lastFlushT0 = 0;

  constructor(config?: string | ClientConfig) {
    if (typeof config === "string") {
      config = { host: config };
    }
    const { host = DEFAULT_HOST, token, bigIntColumns = false } = config ?? {};
    this.host = host.replace(/\/+$/, "");
    this._bigIntColumns = bigIntColumns;

    const resolvedToken =
      token ??
      (typeof process !== "undefined"
        ? process.env.TURINGDB_AUTH_TOKEN
        : undefined);

    this._headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (resolvedToken) {
      this._headers.Authorization = `Bearer ${resolvedToken}`;
    }

    this._params = { graph: "default" };
  }

  // ── Thenable ────────────────────────────────────────────────────

  // biome-ignore lint/suspicious/noThenProperty: intentional thenable for builder chain
  then<TResult1 = Row[], TResult2 = never>(
    onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this._flush().then(onfulfilled, onrejected);
  }

  private async _flush(): Promise<Row[]> {
    const ops = this._chain.snapshot();
    let lastRows: Row[] = [];

    this._lastFlushT0 = Date.now();

    for (const op of ops) {
      const result = await this._executeOp(op);
      if (result !== undefined) {
        lastRows = result;
      }
    }

    this._totalExecTime = Date.now() - this._lastFlushT0;

    return lastRows;
  }

  private async _executeOp(op: Op): Promise<Row[] | undefined> {
    switch (op.kind) {
      case "state":
        op.apply(this);
        return undefined;

      case "http-new-change": {
        const json = await this._queryRequest("CHANGE NEW");
        const parsed = parseChunks(json, this._bigIntColumns);
        this._queryExecTime = parsed.time;
        const changeID = parsed.rows[0]?.changeID as number;
        if (changeID === undefined) {
          throw new TuringDBException("CHANGE NEW did not return a changeID");
        }
        this._params.change = changeID.toString(16);
        return undefined;
      }

      case "http-query": {
        const json = await this._queryRequest(op.cypher);
        const parsed = parseChunks(json, this._bigIntColumns);
        this._queryExecTime = parsed.time;
        return parsed.rows;
      }

      case "http-command": {
        const json = await this._queryRequest(op.cypher);
        this._queryExecTime = (json as { time?: number }).time;
        return undefined;
      }

      case "http-load-graph": {
        await this._directRequest("/load_graph", "", { graph: op.name });
        return undefined;
      }
    }
  }

  // ── Low-level HTTP ──────────────────────────────────────────────

  private _paramsFor(path: string): Record<string, string | undefined> {
    if (path === "/query") {
      return {
        graph: this._params.graph,
        change: this._params.change,
        commit: this._params.commit,
      };
    }
    return {};
  }

  private async _queryRequest(cypher: string): Promise<RawResponse> {
    const json = await sendRequest({
      host: this.host,
      path: "/query",
      body: cypher,
      params: this._paramsFor("/query"),
      headers: this._headers,
    });
    return json as RawResponse;
  }

  private async _directRequest(
    path: string,
    body?: string,
    extraParams?: Record<string, string | undefined>,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    return (await sendRequest({
      host: this.host,
      path,
      body,
      params: extraParams ?? {},
      headers: this._headers,
      signal,
    })) as Record<string, unknown>;
  }

  // ── Query ───────────────────────────────────────────────────────

  query(cypher: string): this {
    this._chain.enqueue({ kind: "http-query", cypher, isQuery: true });
    return this;
  }

  async queryRaw(cypher: string): Promise<RawResponse> {
    if (this._chain.pending) {
      await this._flush();
    }
    const json = await this._queryRequest(cypher);
    this._queryExecTime = json.time;
    return json;
  }

  // ── Graph management ────────────────────────────────────────────

  createGraph(name: string): this {
    this._chain.enqueue({
      kind: "http-command",
      cypher: `CREATE GRAPH ${name}`,
    });
    return this;
  }

  async loadGraph(name: string): Promise<void> {
    if (this._chain.pending) {
      await this._flush();
    }
    try {
      await this._directRequest("/load_graph", "", { graph: name });
    } catch (e) {
      if (
        e instanceof TuringDBException &&
        (e.message === "GRAPH_ALREADY_EXISTS" ||
          e.message === "GRAPH_LOAD_ERROR")
      ) {
        return;
      }
      throw e;
    }
  }

  async listAvailableGraphs(): Promise<string[]> {
    if (this._chain.pending) {
      await this._flush();
    }
    const json = await this._directRequest("/list_avail_graphs");
    return json.data as string[];
  }

  async listLoadedGraphs(): Promise<string[]> {
    if (this._chain.pending) {
      await this._flush();
    }
    const json = await this._directRequest("/list_loaded_graphs");
    return ((json.data as unknown[][])?.[0]?.[0] as string[]) ?? [];
  }

  async isGraphLoaded(): Promise<boolean> {
    if (this._chain.pending) {
      await this._flush();
    }
    const json = await this._directRequest("/is_graph_loaded", "", {
      graph: this._params.graph,
    });
    return json.data as boolean;
  }

  // ── State ───────────────────────────────────────────────────────

  setGraph(name: string): this {
    this._chain.enqueue({
      kind: "state",
      apply: () => {
        this._params.graph = name;
      },
    });
    return this;
  }

  setChange(change: number | string): this {
    this._chain.enqueue({
      kind: "state",
      apply: () => {
        const hex = typeof change === "number" ? change.toString(16) : change;
        this._params.change = hex;
      },
    });
    return this;
  }

  setCommit(commit: string): this {
    this._chain.enqueue({
      kind: "state",
      apply: () => {
        this._params.commit = commit;
      },
    });
    return this;
  }

  checkout(
    change: "main" | number | string = "main",
    commit: string | "HEAD" = "HEAD",
  ): this {
    if (change === "main") {
      this._chain.enqueue({
        kind: "state",
        apply: () => {
          delete this._params.change;
        },
      });
    } else {
      this.setChange(change);
    }

    if (commit === "HEAD") {
      this._chain.enqueue({
        kind: "state",
        apply: () => {
          delete this._params.commit;
        },
      });
    } else {
      this._chain.enqueue({
        kind: "http-command",
        cypher: `LOAD COMMIT '${commit}'`,
      });
      this.setCommit(commit);
    }

    return this;
  }

  // ── Change ──────────────────────────────────────────────────────

  async newChange(): Promise<ChangeInfo> {
    if (this._chain.pending) {
      await this._flush();
    }
    if (this._params.change !== undefined) {
      throw new TuringDBException(
        "Cannot create a new change while working on one",
      );
    }
    if (this._params.commit !== undefined) {
      throw new TuringDBException(
        "Cannot create a new change while working on a commit",
      );
    }
    const json = await this._queryRequest("CHANGE NEW");
    const parsed = parseChunks(json, this._bigIntColumns);
    this._queryExecTime = parsed.time;
    const changeID = parsed.rows[0]?.changeID as number;
    if (changeID === undefined) {
      throw new TuringDBException("CHANGE NEW did not return a changeID");
    }
    const hex = changeID.toString(16);
    this._params.change = hex;
    return { changeID, hex };
  }

  checkoutNewChange(): this {
    this._chain.enqueue({ kind: "http-new-change" });
    return this;
  }

  // ── Commit / Submit ─────────────────────────────────────────────

  commit(): this {
    this._chain.enqueue({ kind: "http-command", cypher: "COMMIT" });
    return this;
  }

  submit(): this {
    this._chain.enqueue({ kind: "http-command", cypher: "CHANGE SUBMIT" });
    return this;
  }

  commitAndSubmit(): this {
    this._chain.enqueue({ kind: "http-command", cypher: "COMMIT" });
    this._chain.enqueue({ kind: "http-command", cypher: "CHANGE SUBMIT" });
    return this;
  }

  // ── Accessors ───────────────────────────────────────────────────

  get currentGraph(): string {
    return this._params.graph;
  }

  get currentChange(): string {
    return this._params.change ?? "main";
  }

  get currentCommit(): string {
    return this._params.commit ?? "HEAD";
  }

  get lastQueryTime(): number | undefined {
    return this._queryExecTime;
  }

  get lastTotalTime(): number | undefined {
    return this._totalExecTime;
  }

  // ── Liveness ────────────────────────────────────────────────────

  async tryReach(timeoutMs = 5000): Promise<void> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      await this._directRequest(
        "/list_avail_graphs",
        undefined,
        undefined,
        controller.signal,
      );
    } finally {
      clearTimeout(t);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  reconnect(): void {}
}
