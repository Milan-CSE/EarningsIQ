import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criticNode, runPipeline } from "./pipeline.ts";
import { hybridRetrieve, toCitation } from "./retrieve.ts";

describe("multi-agent pipeline", () => {
  it("produces a cited report for AAPL where every numeric claim has a citation", async () => {
    const report = await runPipeline({ ticker: "AAPL" });
    assert.equal(report.dataMode, "fixture");
    assert.match(report.disclaimer, /not investment advice/i);
    assert.ok(report.claims.length >= 2);
    for (const claim of report.claims) {
      assert.ok(claim.citations.length > 0, `uncited: ${claim.text}`);
      assert.equal(claim.verified, true);
    }
    assert.equal(report.verification.allCited, true);
    assert.ok(report.trace.map((t) => t.name).join(",") === "retrieval,analyst,risk,critic,synthesis");
  });

  it("routes an injected unsupported claim back through the critic", () => {
    const hits = hybridRetrieve("iPhone revenue 2024", { ticker: "AAPL", k: 4 });
    const citations = hits.map(toCitation);
    const seed = [
      {
        id: "seed",
        text: "iPhone net sales were $201,183 million.",
        numericValue: 201183,
        unit: "USD_millions",
        metric: "iPhoneNetSales",
        citations: citations.filter((c) => c.excerpt.includes("201,183")).map((c) => c.id),
        verified: true,
        status: "supported" as const,
        confidence: 0.9,
        note: "seed",
      },
    ];
    const result = criticNode(seed, citations, true);
    assert.ok(result.retries >= 1, "critic must retry at least once on an injected claim");
    assert.equal(result.claims.some((c) => c.citations.length === 0), false);
    assert.equal(
      result.claims.some((c) => c.text.includes("1,000,000")),
      false,
      "injected unverifiable claim must not survive",
    );
  });

  it("rejects tickers outside the fixture universe", async () => {
    await assert.rejects(() => runPipeline({ ticker: "ZZZZ" }), /fixture universe/);
  });
});
