import type { ChangeInfo, RawResponse } from "./types";

/**
 * A TuringDB client backed by any transport (HTTP, binary, or embedded).
 *
 * Chainable methods return `this` (the client instance) so you can build a
 * fluent pipeline of operations.  Because the client itself is
 * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise#thenables | thenable},
 * awaiting any chain flushes all queued operations sequentially and resolves
 * with the rows returned by the **last {@link query}** in the chain.
 *
 * ```ts
 * const rows = await client
 *   .setGraph("mygraph")
 *   .checkoutNewChange()
 *   .query("CREATE (a:Person {name: 'Alice'})")
 *   .commitAndSubmit()
 *   .checkout()
 *   .query("MATCH (n:Person) RETURN n.name");
 * // rows === [{ "n.name": "Alice" }]
 * ```
 *
 * Individual methods that return non-chainable data (e.g.
 * {@link newChange}, {@link listAvailableGraphs}) issue the request
 * immediately and return a plain `Promise`.
 */
export interface TuringDBClient {
  /**
   * Enqueue a Cypher query.
   *
   * This is the universal chain step for **both** reads (`MATCH … RETURN …`)
   * and writes (`CREATE`, `COMMIT`, `CHANGE SUBMIT`, …).  Awaiting the
   * returned client flushes the queue and resolves with the parsed rows of
   * the **last** query.
   *
   * ```ts
   * const people = await client.query("MATCH (p:Person) RETURN p.name");
   * people.forEach(r => console.log(r["p.name"]));
   * ```
   *
   * @param cypher - A raw Cypher statement string.
   * @returns `this` — the thenable client, so the chain continues.
   */
  query(cypher: string): this;

  /**
   * Execute a Cypher query and return the **raw** server response without
   * parsing chunks into rows.
   *
   * Unlike {@link query}, this method fires immediately (it does **not**
   * participate in the deferred chain — any pending queued ops are flushed
   * first).
   *
   * @param cypher - A raw Cypher statement string.
   * @returns The raw JSON response from `/query`.
   */
  queryRaw(cypher: string): Promise<RawResponse>;

  /**
   * Enqueue a `CREATE GRAPH <name>` command.
   *
   * The graph is created on the server but does **not** become the active
   * graph — call {@link setGraph} afterwards to target it.
   *
   * ```ts
   * await client.createGraph("analytics").query("MATCH () RETURN count(*)");
   * ```
   *
   * @param name - The new graph name (alphanumeric, no hyphens or leading digits).
   * @returns `this` — the thenable client.
   */
  createGraph(name: string): this;

  /**
   * Load an existing (on-disk) graph into the server's memory.
   *
   * This is a direct HTTP call — it does **not** participate in the
   * deferred chain.
   *
   * @param name - Graph name to load.
   * @throws `TuringDBException` if the graph cannot be loaded.
   */
  loadGraph(name: string): Promise<void>;

  /**
   * List all graph names stored on disk (whether loaded or not).
   *
   * Direct HTTP call — flushes any pending chain ops first.
   *
   * @returns Array of graph name strings.
   */
  listAvailableGraphs(): Promise<string[]>;

  /**
   * List graph names currently loaded in the server's memory.
   *
   * Direct HTTP call — flushes any pending chain ops first.
   *
   * @returns Array of loaded graph name strings.
   */
  listLoadedGraphs(): Promise<string[]>;

  /**
   * Check whether the **current** graph (see {@link currentGraph}) is
   * loaded in the server.
   *
   * Direct HTTP call — flushes any pending chain ops first.
   *
   * @returns `true` if the current graph is loaded.
   */
  isGraphLoaded(): Promise<boolean>;

  /**
   * Enqueue a state change that sets the active graph for subsequent
   * queries in the chain.
   *
   * ```ts
   * client.setGraph("social").query("MATCH (n) RETURN n");
   * ```
   *
   * @param name - The graph to target.
   * @returns `this` — the thenable client.
   */
  setGraph(name: string): this;

  /**
   * Enqueue a state change that picks a change (branch) to work on.
   *
   * The change ID is sent as the `change` query-string parameter on
   * subsequent `/query` calls within the same chain.
   *
   * @param change - An integer change ID (hex-encoded automatically) or a
   *   pre-encoded hex string.  Pass `"main"` to clear the change.
   * @returns `this` — the thenable client.
   */
  setChange(change: number | string): this;

  /**
   * Enqueue a state change that pins queries to a specific commit
   * within a change.
   *
   * The commit name is sent as the `commit` query-string parameter on
   * subsequent `/query` calls within the same chain.
   *
   * @param commit - The commit identifier.
   * @returns `this` — the thenable client.
   */
  setCommit(commit: string): this;

  /**
   * Enqueue a checkout operation that resets or switches the working
   * branch / commit.
   *
   * - `checkout()` or `checkout("main")` — switch back to the main branch
   *   (clears the `change` and `commit` params).
   * - `checkout(<changeId>)` — switch to a specific change.
   * - `checkout("main", "<commitName>")` — load a specific commit on main
   *   via `LOAD COMMIT '<commitName>'` on the server.
   *
   * ```ts
   * await client
   *   .checkout(someChangeId)
   *   .query("MATCH (n) RETURN n")
   *   .checkout()  // back to main
   *   .query("MATCH (n) RETURN n");
   * ```
   *
   * @param change - `"main"` (default), an integer change ID, or a hex string.
   * @param commit - `"HEAD"` (default) or a commit name.
   * @returns `this` — the thenable client.
   */
  checkout(change?: "main" | number | string, commit?: string | "HEAD"): this;

  /**
   * Create a new change (branch) and return its metadata.
   *
   * This is a **direct** call — it issues `CHANGE NEW` immediately,
   * eagerly sets the client's active change, and returns the change info.
   * Use {@link checkoutNewChange} for the chainable variant.
   *
   * ```ts
   * const { changeID, hex } = await client.newChange();
   * console.log(`Working on change ${hex} (${changeID})`);
   * ```
   *
   * @returns The change information object.
   * @throws `TuringDBException` if already working on a change or commit.
   */
  newChange(): Promise<ChangeInfo>;

  /**
   * Enqueue a `CHANGE NEW` operation that creates a branch and
   * immediately makes it the active change for subsequent chain steps.
   *
   * This is the chainable equivalent of {@link newChange}.  The change
   * ID is applied eagerly during flush so later ops in the same chain
   * see it.
   *
   * ```ts
   * await client.setGraph("g").checkoutNewChange().query("CREATE (n)");
   * ```
   *
   * @returns `this` — the thenable client.
   */
  checkoutNewChange(): this;

  /**
   * Enqueue a `COMMIT` command on the current change.
   *
   * @returns `this` — the thenable client.
   */
  commit(): this;

  /**
   * Enqueue a `CHANGE SUBMIT` command that merges the current change
   * back to the main branch.
   *
   * @returns `this` — the thenable client.
   */
  submit(): this;

  /**
   * Enqueue both a `COMMIT` and a `CHANGE SUBMIT` in one step.
   *
   * Equivalent to calling {@link commit} followed by {@link submit}.
   *
   * @returns `this` — the thenable client.
   */
  commitAndSubmit(): this;

  /** The name of the currently active graph.  Defaults to `"default"`. */
  readonly currentGraph: string;

  /**
   * The currently active change (branch).
   *
   * Returns the hex string of the change ID, or `"main"` when no change
   * is checked out.
   */
  readonly currentChange: string;

  /**
   * The currently pinned commit.
   *
   * Returns the commit name, or `"HEAD"` when no specific commit is set.
   */
  readonly currentCommit: string;

  /**
   * Server-reported execution time (in milliseconds) of the last query
   * that returned rows.
   *
   * `undefined` before any query has been executed.
   */
  readonly lastQueryTime?: number;

  /**
   * Client-side wall-clock time (in milliseconds) of the last HTTP
   * round-trip (or chain flush).
   *
   * `undefined` before any request has been made.
   */
  readonly lastTotalTime?: number;

  /**
   * Check whether the server is reachable.
   *
   * Issues a quick `list_avail_graphs` request.  Throws if the server
   * does not respond within the timeout.
   *
   * @param timeoutMs - Maximum time to wait in milliseconds (default 5000).
   */
  tryReach(timeoutMs?: number): Promise<void>;

  /**
   * No-op for the HTTP transport; exists for parity with the binary
   * client so callers can write transport-agnostic recovery code.
   */
  reconnect(): void;
}

export type { ChangeInfo, RawResponse };
