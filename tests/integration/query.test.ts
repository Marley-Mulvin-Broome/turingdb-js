import { describe, expect, it } from "vitest";
import type { Row } from "../../src/index";
import { colKey, createClient, randomGraphName } from "./helpers";

describe("Data types and queries", () => {
  it("returns all supported column types", async () => {
    const client = createClient();
    const graph = randomGraphName("dtypes");
    await client.createGraph(graph);

    await client
      .setGraph(graph)
      .checkoutNewChange()
      .query(
        "CREATE (n:Widget {" +
          "name: 'alpha', " +
          "count: 42, " +
          "score: 3.14, " +
          "active: true, " +
          "bigval: 9007199254740991" +
          "})",
      )
      .commitAndSubmit()
      .checkout();

    const rows = await client.query(
      "MATCH (n:Widget) RETURN n.name, n.count, n.score, n.active, n.bigval",
    );

    expect(rows).toHaveLength(1);
    const r = rows[0] as Row;

    expect(r[colKey(rows, ".name")]).toBe("alpha");
    expect(r[colKey(rows, ".count")]).toBe(42);
    expect(r[colKey(rows, ".score")]).toBe(3.14);
    expect(r[colKey(rows, ".active")]).toBe(true);
    expect(r[colKey(rows, ".bigval")]).toBe(9007199254740991);
  });

  it("handles multiple relationship hops in one query", async () => {
    const client = createClient();
    const graph = randomGraphName("hops");
    await client.createGraph(graph);

    await client
      .setGraph(graph)
      .checkoutNewChange()
      .query(
        "CREATE (a:City {name: 'London'}), " +
          "(b:City {name: 'Paris'}), " +
          "(c:City {name: 'Berlin'}), " +
          "(a)-[:ROAD {distance: 344}]->(b), " +
          "(b)-[:ROAD {distance: 878}]->(c)",
      )
      .commitAndSubmit()
      .checkout();

    const cities = await client.query(
      "MATCH (c:City) RETURN c.name ORDER BY c.name",
    );
    const names = cities.map((r) => r[colKey(cities, ".name")]);
    expect(names).toEqual(["Berlin", "London", "Paris"]);

    const paths = await client.query(
      "MATCH (a:City)-[:ROAD]->(b:City)-[:ROAD]->(c:City) RETURN a.name, c.name",
    );
    expect(paths).toHaveLength(1);
    expect(paths[0][colKey(paths, "a.name")]).toBe("London");
    expect(paths[0][colKey(paths, "c.name")]).toBe("Berlin");

    const roads = await client.query(
      "MATCH ()-[r:ROAD]->() RETURN r.distance ORDER BY r.distance",
    );
    const distances = roads.map((r) => r[colKey(roads, ".distance")]);
    expect(distances).toEqual([344, 878]);
  });

  it("filters with WHERE and LIMIT", async () => {
    const client = createClient();
    const graph = randomGraphName("filter");
    await client.createGraph(graph);

    await client
      .setGraph(graph)
      .checkoutNewChange()
      .query(
        "CREATE (a:Num {val: 10}), " +
          "(b:Num {val: 20}), " +
          "(c:Num {val: 30}), " +
          "(d:Num {val: 40})",
      )
      .commitAndSubmit()
      .checkout();

    const filtered = await client.query(
      "MATCH (n:Num) WHERE n.val > 15 AND n.val < 35 RETURN n.val ORDER BY n.val",
    );
    const vals = filtered.map((r) => r[colKey(filtered, ".val")]);
    expect(vals).toEqual([20, 30]);

    const limited = await client.query(
      "MATCH (n:Num) RETURN n.val ORDER BY n.val LIMIT 2",
    );
    expect(limited).toHaveLength(2);
    expect(limited.map((r) => r[colKey(limited, ".val")])).toEqual([10, 20]);
  });

  it("handles boolean and null values", async () => {
    const client = createClient();
    const graph = randomGraphName("bools");
    await client.createGraph(graph);

    await client
      .setGraph(graph)
      .checkoutNewChange()
      .query(
        "CREATE (a:Flag {label: 'on', on: true}), " +
          "(b:Flag {label: 'off', on: false}), " +
          "(c:Flag {label: 'unknown'})",
      )
      .commitAndSubmit()
      .checkout();

    const rows = await client.query(
      "MATCH (f:Flag) RETURN f.label, f.on ORDER BY f.label",
    );

    const labelKey = colKey(rows, ".label");
    const onKey = colKey(rows, ".on");

    expect(rows[0][labelKey]).toBe("off");
    expect(rows[0][onKey]).toBe(false);
    expect(rows[1][labelKey]).toBe("on");
    expect(rows[1][onKey]).toBe(true);
    expect(rows[2][labelKey]).toBe("unknown");
    expect(rows[2][onKey]).toBeNull();
  });

  it("supports introspection queries", async () => {
    const client = createClient();
    const graph = randomGraphName("intro");
    await client.createGraph(graph);

    await client
      .setGraph(graph)
      .checkoutNewChange()
      .query(
        "CREATE (a:Person {name: 'Alice', age: 30}), " +
          "(a)-[:KNOWS {since: 2020}]->(b:Person {name: 'Bob', age: 25})",
      )
      .commitAndSubmit()
      .checkout();

    const labels = await client.query("CALL db.labels()");
    expect(labels.some((r) => Object.values(r).includes("Person"))).toBe(true);

    const edgeTypes = await client.query("CALL db.edgeTypes()");
    expect(edgeTypes.some((r) => Object.values(r).includes("KNOWS"))).toBe(
      true,
    );

    const propTypes = await client.query("CALL db.propertyTypes()");
    expect(propTypes.length).toBeGreaterThan(0);
  });

  it("returns empty rows for zero-row queries", async () => {
    const client = createClient();
    const graph = randomGraphName("empty");
    await client.createGraph(graph);

    await client
      .setGraph(graph)
      .checkoutNewChange()
      .query("CREATE (x:EmptyMarker {val: 1})")
      .commitAndSubmit()
      .checkout();

    const rows = await client.query(
      "MATCH (n:EmptyMarker) WHERE n.val > 999 RETURN n",
    );
    expect(rows).toHaveLength(0);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("handles composite node creation", async () => {
    const client = createClient();
    const graph = randomGraphName("composite");
    await client.createGraph(graph);

    await client
      .setGraph(graph)
      .checkoutNewChange()
      .query(
        "CREATE (a:Sensor {id: 's1', temp: 22.5, pressure: 1013.25, active: true})" +
          "-[:REPORTS {ts: 1700000000, freq: 2.4}]->" +
          "(h:Hub {id: 'hub1', location: 'warehouse-1'})",
      )
      .commitAndSubmit()
      .checkout();

    const sensors = await client.query(
      "MATCH (s:Sensor) RETURN s.id, s.temp, s.pressure, s.active",
    );
    expect(sensors).toHaveLength(1);

    const hubs = await client.query("MATCH (h:Hub) RETURN h.id, h.location");
    expect(hubs).toHaveLength(1);
    expect(hubs[0][colKey(hubs, ".location")]).toBe("warehouse-1");
  });

  it("reports query timing", async () => {
    const client = createClient();

    await client.query("MATCH (n) RETURN n");

    expect(typeof client.lastQueryTime).toBe("number");
    expect(client.lastQueryTime).toBeGreaterThanOrEqual(0);
    expect(typeof client.lastTotalTime).toBe("number");
    expect(client.lastTotalTime).toBeGreaterThanOrEqual(0);
  });

  it("BigInt mode coerces Int64/UInt64 to bigint", async () => {
    const { HTTPClient } = await import("../../src/index");
    const client = new HTTPClient({
      host: "http://localhost:6670",
      bigIntColumns: true,
    });
    const graph = randomGraphName("bigint");
    await client.createGraph(graph);

    await client
      .setGraph(graph)
      .checkoutNewChange()
      .query("CREATE (n:Counter {val: 123456789012345})")
      .commitAndSubmit()
      .checkout();

    const rows = await client.query("MATCH (n:Counter) RETURN n.val");
    expect(rows).toHaveLength(1);
    const key = colKey(rows, ".val");
    expect(typeof rows[0][key]).toBe("bigint");
    expect(rows[0][key]).toBe(BigInt("123456789012345"));
  });

  it("queryRaw returns the raw server response", async () => {
    const client = createClient();

    const raw = await client.queryRaw("RETURN 1 AS one");
    expect(raw).toHaveProperty("time");
    expect(raw).toHaveProperty("header");
    expect(raw).toHaveProperty("data");
    expect(raw.header.column_names).toEqual(["one"]);
    expect(raw.header.column_types).toEqual(["Int64"]);
    expect(raw.data).toHaveLength(1);
    expect(raw.data[0]).toEqual([[1]]);
  });
});
