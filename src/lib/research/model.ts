import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { GuidanceSignal } from "./types.ts";

export type XgbNode = {
  nodeid: number;
  leaf?: number;
  split?: string;
  split_condition?: number;
  yes?: number;
  no?: number;
  missing?: number;
  children?: XgbNode[];
};

export type RegisteredModel = {
  name: string;
  version: string;
  alias: "staging" | "production";
  algorithm: "xgboost" | "logistic";
  features: string[];
  baseScore: number;
  trees?: XgbNode[];
  coefficients?: Record<string, number>;
  intercept?: number;
  scaler_mean?: number[];
  scaler_scale?: number[];
  metrics: {
    auc: number;
    precision: number;
    recall: number;
    baselineAuc: number;
    split: string;
  };
};

const REGISTRY_CANDIDATES = [
  join(process.cwd(), "ml/registry/production.json"),
  join(process.cwd(), "src/data/ml-registry.json"),
];

export function registryPath(candidates: string[] = REGISTRY_CANDIDATES): string | null {
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

export function loadRegisteredModel(candidates?: string[]): RegisteredModel {
  const path = registryPath(candidates);
  if (!path) {
    throw new Error(
      "MLflow registry unavailable: ml/registry/production.json is missing. Refusing to score from a stale pickle.",
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as RegisteredModel;
}

function walk(node: XgbNode, fmap: Map<string, number>): number {
  if (typeof node.leaf === "number") return node.leaf;
  const fname = node.split ?? "";
  const x = fmap.get(fname) ?? fmap.get(fname.replace(/^f/, "")) ?? 0;
  const thr = node.split_condition ?? 0;
  const kids = new Map((node.children ?? []).map((c) => [c.nodeid, c]));
  const nextId = x < thr ? node.yes : node.no;
  const nxt = nextId !== undefined ? kids.get(nextId) : undefined;
  if (!nxt) return 0;
  return walk(nxt, fmap);
}

function sigmoid(z: number): number {
  if (z < -40) return 0;
  if (z > 40) return 1;
  return 1 / (1 + Math.exp(-z));
}

export function scoreModel(model: RegisteredModel, features: Record<string, number>): number {
  if (model.algorithm === "logistic") {
    let z = model.intercept ?? 0;
    model.features.forEach((f, i) => {
      const raw = features[f] ?? 0;
      const mean = model.scaler_mean?.[i] ?? 0;
      const scale = model.scaler_scale?.[i] ?? 1;
      const x = scale === 0 ? 0 : (raw - mean) / scale;
      z += (model.coefficients?.[f] ?? 0) * x;
    });
    return sigmoid(z);
  }
  const fmap = new Map<string, number>();
  model.features.forEach((f, i) => {
    fmap.set(f, features[f] ?? 0);
    fmap.set(`f${i}`, features[f] ?? 0);
  });
  let raw = 0;
  for (const tree of model.trees ?? []) raw += walk(tree, fmap);
  return sigmoid(raw + (model.baseScore ?? 0));
}

export function predictGuidance(features: Record<string, number>): GuidanceSignal {
  const model = loadRegisteredModel();
  const pBeat = scoreModel(model, features);
  return {
    disclaimer:
      "Backtested research signal, not investment advice. Probability is a walk-forward model score on fixture panel data.",
    pBeat,
    predictedClass: pBeat >= 0.5 ? "beat" : "miss",
    modelName: model.name,
    modelVersion: model.version,
    alias: model.alias,
    features,
  };
}
