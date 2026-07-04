import { describe, expect, it } from "vitest";
import { createClient, randomGraphName } from "./helpers";

describe("Change workflow", () => {
  it("creates a new change and returns ChangeInfo", async () => {
    const client = createClient();
    const info = await client.newChange();
    expect(typeof info.changeID).toBe("number");
    expect(typeof info.hex).toBe("string");
    expect(info.hex).toBe(info.changeID.toString(16));
    expect(client.currentChange).toBe(info.hex);
  });

  it("writes, commits, submits, and reads back data", async () => {
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

  it("throws when newChange called while working on a change", async () => {
    const client = createClient();
    await client.newChange();
    await expect(client.newChange()).rejects.toThrow(
      /Cannot create a new change while working on one/,
    );
  });

  it("currentGraph reflects setGraph after await", async () => {
    const client = createClient();
    const graph = randomGraphName();
    await client.setGraph(graph);
    expect(client.currentGraph).toBe(graph);
  });
});
