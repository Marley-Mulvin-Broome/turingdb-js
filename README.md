# turingdb-js

TuringDB client SDK for JavaScript/TypeScript.

## Installation

```bash
npm install turingdb-js
```

Requires Node.js >= 18 and a running [TuringDB](https://github.com/turingdb/turingdb) server.

## Usage

```ts
import { TuringDB } from "turingdb-js";

const client = new TuringDB({ host: "http://localhost:6670" });

// Cypher queries
const rows = await client.query("MATCH (n) RETURN n");

// Graph management
await client.createGraph("mygraph").loadGraph().setGraph("mygraph");

// Branching workflow (git-like)
await client.checkoutNewChange()
  .query("CREATE (a:Person {name: 'Alice'})")
  .commitAndSubmit()
  .checkout();
```

The client is [thenable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await#thenable)—methods return `this` and queue operations. Awaiting the chain flushes all queued commands sequentially.

## Contributing

```bash
git clone https://github.com/turingdb/turingdb-js
cd turingdb-js
npm install
npm run docker:up                           # starts TuringDB locally
npm run typecheck && npm run lint && npm run test
```

Open a PR against `main`. CI will lint, typecheck, and run tests on every push.
