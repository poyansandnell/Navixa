/**
 * Integration test: the DB unique index on lower(username) is the final
 * guarantee against duplicate-name races. Runs only when DATABASE_URL is set
 * (dev workspace); cleans up after itself.
 */
import { afterAll, describe, expect, it } from "vitest";
import { db, profilesTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

const hasDb = Boolean(process.env.DATABASE_URL);
const ids = ["__test_race_a", "__test_race_b", "__test_nfc_a", "__test_nfc_b"];

describe.skipIf(!hasDb)("username uniqueness race (DB-level)", () => {
  afterAll(async () => {
    await db.delete(profilesTable).where(inArray(profilesTable.id, ids));
  });

  it("only one of two concurrent case-variant inserts succeeds", async () => {
    const name = `Test Race ${Date.now() % 100000}`;
    const results = await Promise.allSettled([
      db.insert(profilesTable).values({ id: ids[0], username: name }),
      db
        .insert(profilesTable)
        .values({ id: ids[1], username: name.toLowerCase() }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const err = (rejected[0] as PromiseRejectedResult).reason as {
      code?: string;
      cause?: { code?: string };
    };
    expect(err.code ?? err.cause?.code).toBe("23505");
  });

  it("rejects an NFC duplicate of a stored (normalised) name", async () => {
    // The API normalises to NFC before insert; storing NFC then trying the
    // same NFC string again (from a different NFD user input) must fail.
    const suffix = `${Date.now() % 100000}`;
    const nfd = `A\u030asa ${suffix}`; // Åsa via combining ring (user input)
    const nfc = nfd.normalize("NFC"); // what the API stores
    await db.insert(profilesTable).values({ id: ids[2], username: nfc });
    await expect(
      db
        .insert(profilesTable)
        .values({ id: ids[3], username: nfd.normalize("NFC").toLowerCase() }),
    ).rejects.toMatchObject({});
  });
});
