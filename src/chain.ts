export type Op =
  | { kind: "state"; apply: (client: unknown) => void }
  | { kind: "http-new-change" }
  | { kind: "http-query"; cypher: string; isQuery: true }
  | { kind: "http-command"; cypher: string }
  | { kind: "http-load-graph"; name: string };

export class Chain {
  private _queue: Op[] = [];

  enqueue(op: Op): void {
    this._queue.push(op);
  }

  get queue(): readonly Op[] {
    return this._queue;
  }

  snapshot(): Op[] {
    const ops = this._queue;
    this._queue = [];
    return ops;
  }

  get pending(): boolean {
    return this._queue.length > 0;
  }
}
