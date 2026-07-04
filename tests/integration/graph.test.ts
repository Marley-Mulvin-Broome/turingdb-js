import { describe, expect, it } from "vitest";
import { createClient, randomGraphName } from "./helpers";

describe("Graph management", () => {
  it("lists available graphs", async () => {
    const client = createClient();
    const graphs = await client.listAvailableGraphs();
    expect(Array.isArray(graphs)).toBe(true);
    expect(graphs).toContain("default");
  });

  it("creates a new graph and lists it", async () => {
    const client = createClient();
    const name = randomGraphName();
    await client.createGraph(name);
    const graphs = await client.listAvailableGraphs();
    expect(graphs).toContain(name);
  });

  it("loads default graph without error", async () => {
    const client = createClient();
    // default is always loaded on startup — loading again should be fine
    await client.loadGraph("default");
  });

  it("checks if default graph is loaded", async () => {
    const client = createClient();
    const loaded = await client.isGraphLoaded();
    expect(typeof loaded).toBe("boolean");
  });

  it("lists loaded graphs", async () => {
    const client = createClient();
    const loaded = await client.listLoadedGraphs();
    expect(Array.isArray(loaded)).toBe(true);
    expect(loaded).toContain("default");
  });
});
