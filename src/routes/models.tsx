import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchEvalReport, fetchModelCard } from "@/lib/research/actions";

export const Route = createFileRoute("/models")({
  loader: async () => {
    const [model, evalReport] = await Promise.all([fetchModelCard(), fetchEvalReport()]);
    return { model, evalReport };
  },
  component: ModelsPage,
});

function ModelsPage() {
  const { model, evalReport } = Route.useLoaderData();

  if (!model.ok) {
    return (
      <AppShell>
        <h1 className="font-display text-3xl">Model registry unavailable</h1>
        <p className="mt-2 text-fail">{model.error}</p>
        <p className="mt-4 max-w-xl text-sm text-muted-foreground">
          The desk is wired to the MLflow production alias. If the registry files are removed it
          fails loudly instead of scoring from a stale pickle.
        </p>
      </AppShell>
    );
  }

  const runs = model.runs as {
    baseline: { test: { auc: number; precision: number; recall: number; brier: number } };
    tuned: { test: { auc: number; precision: number; recall: number; brier: number } };
    n_optuna_trials: number;
    best_trial: number;
    split: string;
    class_balance_train: number;
    runs: { run_id: string; nested: boolean; metrics: { valid_auc?: number } }[];
  } | null;

  const compare = runs
    ? [
        { name: "LogReg", auc: runs.baseline.test.auc, precision: runs.baseline.test.precision, recall: runs.baseline.test.recall },
        { name: "XGBoost", auc: runs.tuned.test.auc, precision: runs.tuned.test.precision, recall: runs.tuned.test.recall },
      ]
    : [];

  const coef = model.model.coefficients
    ? Object.entries(model.model.coefficients)
        .map(([k, v]) => ({ feature: k.replace(/_/g, " "), weight: v as number }))
        .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    : [];

  const trials = (runs?.runs ?? [])
    .filter((r) => r.nested && typeof r.metrics.valid_auc === "number")
    .map((r, i) => ({ trial: i, auc: r.metrics.valid_auc as number }));

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="max-w-2xl space-y-3">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">MLflow registry</p>
          <h1 className="font-display text-4xl tracking-tight">Walk-forward beat model.</h1>
          <p className="text-muted-foreground">
            Logistic regression baseline versus Optuna-tuned XGBoost on a synthetic panel. Split is
            by fiscal quarter on purpose — a random split would leak the future. Feature choices are
            justified in eda/FINDINGS.md.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="rounded-2xl lg:col-span-2">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{model.model.name}</CardTitle>
                <Badge variant="verify">{model.model.alias}</Badge>
                <Badge>v{model.model.version}</Badge>
              </div>
              <CardDescription>{model.model.notes}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-4">
              <Stat label="Test AUC" value={model.model.metrics.auc.toFixed(3)} />
              <Stat label="Precision" value={model.model.metrics.precision.toFixed(3)} />
              <Stat label="Recall" value={model.model.metrics.recall.toFixed(3)} />
              <Stat label="Baseline AUC" value={model.model.metrics.baselineAuc.toFixed(3)} />
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Split</CardTitle>
              <CardDescription>{model.model.metrics.split}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Train through 2023-Q4. Validate 2024-Q1/Q2. Test 2024-Q3/Q4.</p>
              <p className="font-mono text-xs">
                {runs?.n_optuna_trials ?? 0} Optuna trials · best #{runs?.best_trial}
              </p>
              <p>
                Class balance (train beat rate){" "}
                <span className="font-mono tabular-nums">
                  {((runs?.class_balance_train ?? 0) * 100).toFixed(1)}%
                </span>
              </p>
            </CardContent>
          </Card>
        </div>

        {compare.length > 0 && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Baseline vs tuned (walk-forward test)</CardTitle>
              <CardDescription>
                Always compare the gradient-boosted model to logistic regression — a single AUC in
                isolation is not a result.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compare}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis domain={[0, 1]} stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="auc" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {coef.length > 0 && (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Standardized coefficients</CardTitle>
                <CardDescription>Logistic baseline. Signs match the EDA story: beat-rate and surprise up, hedge down.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {coef.map((row) => (
                  <div key={row.feature} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{row.feature}</span>
                    <span className="font-mono tabular-nums">{row.weight.toFixed(3)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {trials.length > 0 && (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Optuna nested runs</CardTitle>
                <CardDescription>Valid AUC per trial, logged to the file-backed MLflow stand-in.</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trials}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="trial" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis domain={[0.5, 0.8]} stroke="var(--muted-foreground)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="auc" fill="var(--verify)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Agent eval gate</CardTitle>
            <CardDescription>
              40 golden questions on the fixture corpus. Scale by adding tickers; the three kinds
              stay the same: factual lookup, numeric extraction, cross-document call vs filing.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            <Stat label="Golden n" value={String(evalReport.nGolden)} />
            <Stat
              label="Context recall"
              value={evalReport.retrieval.contextRecall.toFixed(2)}
            />
            <Stat
              label="Context precision"
              value={evalReport.retrieval.contextPrecision.toFixed(2)}
            />
            <Stat
              label="Critic caught inject"
              value={evalReport.pipeline.criticCaughtInjected ? "yes" : "no"}
            />
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          MLflow tracks classical ML (this model). Langfuse tracks LLM/agent calls. Two layers, two
          tools — not duplication. Registry path: {model.registryPath}
        </p>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums tracking-tight">{value}</p>
    </div>
  );
}
