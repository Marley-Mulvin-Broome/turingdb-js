import { TuringDBException } from "./exceptions";
import { HTTPClient } from "./http/HTTPClient";
import type { TuringDBClient } from "./interface";
import type { ClientConfig, Row, Thenable } from "./types";

export type BackendType = "json" | "native" | "embedded";

export interface TuringDBConfig extends ClientConfig {
  type?: BackendType;
  port?: number | string;
  dataDir?: string;
}

export class TuringDB implements TuringDBClient, Thenable<Row[]> {
  private readonly _impl: TuringDBClient;

  constructor(config: TuringDBConfig = {}) {
    const type: BackendType =
      config.type ??
      (typeof process !== "undefined"
        ? (process.env.TURINGDB_TYPE as BackendType)
        : undefined) ??
      "json";

    switch (type) {
      case "json": {
        let host = config.host ?? "http://localhost:6666";
        if (config.port != null) {
          host = `http://localhost:${config.port}`;
        }
        this._impl = new HTTPClient({
          host,
          token: config.token,
          bigIntColumns: config.bigIntColumns,
        });
        break;
      }
      case "native":
        throw new TuringDBException(
          "Binary (native) client not yet implemented in turingdb-js",
        );
      case "embedded":
        throw new TuringDBException(
          "Embedded client not yet implemented in turingdb-js",
        );
    }
  }

  // Proxy all methods to _impl

  query(cypher: string): this {
    this._impl.query(cypher);
    return this;
  }

  async queryRaw(cypher: string) {
    return this._impl.queryRaw(cypher);
  }
  createGraph(name: string): this {
    this._impl.createGraph(name);
    return this;
  }
  async loadGraph(name: string) {
    return this._impl.loadGraph(name);
  }
  async listAvailableGraphs() {
    return this._impl.listAvailableGraphs();
  }
  async listLoadedGraphs() {
    return this._impl.listLoadedGraphs();
  }
  async isGraphLoaded() {
    return this._impl.isGraphLoaded();
  }
  setGraph(name: string): this {
    this._impl.setGraph(name);
    return this;
  }
  setChange(change: number | string): this {
    this._impl.setChange(change);
    return this;
  }
  setCommit(commit: string): this {
    this._impl.setCommit(commit);
    return this;
  }
  checkout(
    change: "main" | number | string = "main",
    commit: string | "HEAD" = "HEAD",
  ): this {
    this._impl.checkout(change, commit);
    return this;
  }
  async newChange() {
    return this._impl.newChange();
  }
  checkoutNewChange(): this {
    this._impl.checkoutNewChange();
    return this;
  }
  commit(): this {
    this._impl.commit();
    return this;
  }
  submit(): this {
    this._impl.submit();
    return this;
  }
  commitAndSubmit(): this {
    this._impl.commitAndSubmit();
    return this;
  }

  get currentGraph() {
    return this._impl.currentGraph;
  }
  get currentChange() {
    return this._impl.currentChange;
  }
  get currentCommit() {
    return this._impl.currentCommit;
  }
  get lastQueryTime() {
    return this._impl.lastQueryTime;
  }
  get lastTotalTime() {
    return this._impl.lastTotalTime;
  }

  async tryReach(timeoutMs?: number) {
    return this._impl.tryReach(timeoutMs);
  }
  reconnect() {
    this._impl.reconnect();
  }

  // biome-ignore lint/suspicious/noThenProperty: intentional thenable for builder chain
  then<TResult1 = Row[], TResult2 = never>(
    onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return (this._impl as unknown as Thenable<Row[]>).then(
      onfulfilled,
      onrejected,
    ) as Promise<TResult1 | TResult2>;
  }
}
