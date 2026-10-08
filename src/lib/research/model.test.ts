import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { loadRegisteredModel, predictGuidance, registryPath, scoreModel } from "./model.ts";
import { FEATURE_ROWS } from "./corpus.ts";

describe("guidance-beat model registry", () => {
  it("loads the production alias from the registry, not a pickle", () => {
    const path = registryPath();
    assert.ok(path);
    assert.ok(path.endsWith("production.json") || path.endsWith("ml-registry.json"));
    const model = loadRegisteredModel();
    assert.ok(model.alias === "production" || model.alias === "staging");
    assert.ok(model.features.length >= 8);
    assert.ok(model.metrics.auc > 0.5);
    assert.match(model.metrics.split, /walk_forward/);
  });

  it("scores AAPL features to a probability in (0,1) with a labeled disclaimer", () => {
    const signal = predictGuidance(FEATURE_ROWS.AAPL.features);
    assert.ok(signal.pBeat > 0 && signal.pBeat < 1);
    assert.match(signal.disclaimer, /not investment advice/i);
    assert.ok(signal.modelVersion);
  });

  it("fails loudly when the registry files are missing", () => {
    const missing = [join(process.cwd(), "ml/registry/does-not-exist.json")];
    assert.equal(registryPath(missing), null);
    assert.throws(() => loadRegisteredModel(missing), /registry unavailable/i);
    const p = scoreModel(loadRegisteredModel(), FEATURE_ROWS.MSFT.features);
    assert.ok(p >= 0 && p <= 1);
  });
});
