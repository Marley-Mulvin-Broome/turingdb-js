import { describe, expect, it } from "vitest";
import { TuringDB, TuringDBException } from "../../src/index";
import { createClient } from "./helpers";

describe("Error handling", () => {
  it("throws on invalid Cypher", async () => {
    const client = createClient();
    await expect(client.query("INVALID CYPHER STATEMENT")).rejects.toThrow();
  });

  it("throws on non-existent graph query", async () => {
    const client = createClient();
    const nonexistent = `nonex-${Math.random().toString(36).slice(2, 10)}`;
    await expect(
      client.setGraph(nonexistent).query("MATCH (n) RETURN n"),
    ).rejects.toThrow();
  });

  it("throws HTTP error for bad host", async () => {
    const badClient = new TuringDB({ host: "http://localhost:19999" });
    await expect(badClient.tryReach(2000)).rejects.toThrow(TuringDBException);
  });

  it("throws on queryRaw with invalid Cypher", async () => {
    const client = createClient();
    await expect(client.queryRaw("TOTALLY INVALID")).rejects.toThrow();
  });
});
