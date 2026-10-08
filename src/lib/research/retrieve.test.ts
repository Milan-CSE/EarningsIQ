import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hybridRetrieve, runRetrievalSmoke, toCitation } from "./retrieve.ts";
import { RETRIEVAL_PROBES } from "./corpus.ts";

describe("hybrid retrieval", () => {
  it("returns the correct cited chunk for each of 10 hand-picked probes", () => {
    const rows = runRetrievalSmoke();
    assert.equal(rows.length, 10);
    assert.equal(RETRIEVAL_PROBES.length, 10);
    for (const row of rows) {
      assert.equal(row.ok, true, `missed probe: ${row.query} — top: ${row.excerpt}`);
    }
  });

  it("attaches a citation with doc, section, and offsets", () => {
    const hits = hybridRetrieve("iPhone revenue 2024", { ticker: "AAPL", k: 3 });
    assert.ok(hits.length >= 1);
    const cite = toCitation(hits[0]);
    assert.ok(cite.docId);
    assert.ok(cite.section);
    assert.ok(cite.charEnd > cite.charStart);
    assert.ok(cite.excerpt.length > 0);
    assert.match(cite.sourceLabel, /FIXTURE/);
  });

  it("scopes results to the requested ticker", () => {
    const hits = hybridRetrieve("revenue", { ticker: "NVDA", k: 5 });
    assert.ok(hits.every((h) => h.ticker === "NVDA"));
  });
});
