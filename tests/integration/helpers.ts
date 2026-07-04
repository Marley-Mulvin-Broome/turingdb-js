import { TuringDB } from "../../src/index";

export const DB_HOST = process.env.TURINGDB_HOST ?? "http://localhost:6670";

export function createClient(): TuringDB {
  return new TuringDB({ host: DB_HOST });
}

export function randomGraphName(prefix = "test"): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let suffix = "";
  for (let i = 0; i < 8; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}${suffix}`;
}
