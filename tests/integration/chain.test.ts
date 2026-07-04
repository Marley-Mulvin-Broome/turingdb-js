import { describe, expect, it } from "vitest";
import { createClient, randomGraphName } from "./helpers";

describe("Builder chain", () => {
  it("chains setGraph → checkoutNewChange → query → commitAndSubmit → checkout → query", async () => {
    const client = createClient();
    const graph = randomGraphName();
    await client.createGraph(graph);

    const rows = await client
      .setGraph(graph)
      .checkoutNewChange()
      .query(
        "CREATE (a:Person {name: 'Alice'}), (j:Person {name: 'John'}), (a)-[:KNOWS]->(j)",
      )
      .commitAndSubmit()
      .checkout()
      .query("MATCH (n:Person) RETURN n.name ORDER BY n.name");

    const names = rows.map((r) => r["n.name"]);
    expect(names).toEqual(["Alice", "John"]);
  });

  it("query on main after checkout", async () => {
    const client = createClient();
    const graph = randomGraphName();
    await client.createGraph(graph);

    await client
      .setGraph(graph)
      .checkoutNewChange()
      .query(
        "CREATE (p:Person {name: 'Alice'}), (q:Person {name: 'John'}), (p)-[:KNOWS]->(q)",
      )
      .commitAndSubmit()
      .checkout();

    const rows = await client.query(
      "MATCH (n:Person) RETURN n.name ORDER BY n.name",
    );
    const names = rows.map((r) => r["n.name"]);
    expect(names).toEqual(["Alice", "John"]);
  });

  it("returns rows from last query in chain", async () => {
    const client = createClient();
    const graph = randomGraphName();
    await client.createGraph(graph);

    await client
      .setGraph(graph)
      .checkoutNewChange()
      .query("CREATE (a:Person {name: 'Alice'}), (j:Person {name: 'John'})")
      .commitAndSubmit()
      .checkout();

    const rows = await client.query(
      "MATCH (n:Person) RETURN n.name ORDER BY n.name DESC",
    );
    const names = rows.map((r) => r["n.name"]);
    expect(names).toEqual(["John", "Alice"]);
  });
});
