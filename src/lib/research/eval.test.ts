import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GOLDEN, evaluateRetrieval, extractNumbers, numericAccuracy, evaluatePipeline } from "./eval.ts";
import { chunkDocument } from "./chunker.ts";
import { parseTimestampedTranscript, hedgeRate } from "./asr.ts";
import { DOCUMENTS } from "./corpus.ts";

describe("eval harness", () => {
  it("has 40 golden items covering factual, numeric, and cross-doc", () => {
    assert.equal(GOLDEN.length, 40);
    assert.ok(GOLDEN.some((g) => g.kind === "factual"));
    assert.ok(GOLDEN.some((g) => g.kind === "numeric"));
    assert.ok(GOLDEN.some((g) => g.kind === "cross_doc"));
  });

  it("retrieval context recall is at least 0.85 on the golden set", () => {
    const { contextRecall, contextPrecision, rows } = evaluateRetrieval();
    const misses = rows.filter((r) => !r.ok).map((r) => r.id);
    assert.ok(contextRecall >= 0.85, `recall ${contextRecall} misses ${misses.join(",")}`);
    assert.ok(contextPrecision >= 0.85);
  });

  it("numeric extractor reads millions and billions", () => {
    assert.deepEqual(extractNumbers("$201,183 million"), [201183]);
    assert.deepEqual(extractNumbers("$94.9 billion"), [94900]);
  });
});

describe("chunker", () => {
  it("never splits a table block and keeps section labels", () => {
    const filing = DOCUMENTS.find((d) => d.id === "aapl-10k-2024");
    assert.ok(filing);
    const chunks = chunkDocument(filing);
    assert.ok(chunks.length >= 3);
    const table = chunks.find((c) => c.table);
    assert.ok(table, "expected a table chunk");
    assert.match(table.text, /391,035/);
    assert.ok(chunks.every((c) => c.section.length > 0));
    assert.ok(chunks.every((c) => c.charEnd > c.charStart));
  });
});

describe("fixture ASR", () => {
  it("parses timestamped utterances from the AAPL call", () => {
    const call = DOCUMENTS.find((d) => d.id === "aapl-call-2024q4");
    assert.ok(call);
    const utts = parseTimestampedTranscript(call.text);
    assert.ok(utts.length >= 4);
    assert.equal(utts[0].timestamp, "00:01:12");
    const hedges = hedgeRate(call.text);
    assert.ok(hedges.count >= 3);
  });
});

describe("end-to-end eval", () => {
  it("pipeline eval reports critic catch and numeric alignment", async () => {
    const result = await evaluatePipeline();
    assert.equal(result.criticCaughtInjected, true);
    assert.equal(result.criticRemainingUnsupported, 0);
    assert.ok(result.numeric.checked >= 1);
    assert.ok(result.numeric.matched >= 1);
    assert.equal(result.allCited, true);
  });
});
