import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AgentTrace } from "@/components/agent-trace";
import { ReportView } from "@/components/report-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJobs, getUniverse, submitResearch } from "@/lib/research/actions";
import type { AgentName, ResearchReport } from "@/lib/research/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [universe, jobs] = await Promise.all([getUniverse(), fetchJobs()]);
    return { universe, jobs };
  },
  component: BriefingDesk,
});

const STEP_ORDER: AgentName[] = ["retrieval", "analyst", "risk", "critic", "synthesis"];

function BriefingDesk() {
  const { universe, jobs: initialJobs } = Route.useLoaderData();
  const [ticker, setTicker] = useState(universe.companies[0]?.ticker ?? "AAPL");
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState<AgentName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [jobs, setJobs] = useState(initialJobs);

  const selected = universe.companies.find((c) => c.ticker === ticker);
  const quarter = selected?.quarters[0];

  async function run() {
    setRunning(true);
    setError(null);
    setReport(null);
    let i = 0;
    setActive(STEP_ORDER[0]);
    const timer = setInterval(() => {
      i = Math.min(i + 1, STEP_ORDER.length - 1);
      setActive(STEP_ORDER[i]);
    }, 280);
    try {
      const next = await submitResearch({ data: { ticker, quarter } });
      setReport(next);
      const list = await fetchJobs();
      setJobs(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Briefing failed.");
    } finally {
      clearInterval(timer);
      setActive(null);
      setRunning(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-10">
        <section className="max-w-3xl space-y-4">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Research desk</p>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            Cross-check the call against the filing.
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            A five-agent team retrieves from 10-K / 10-Q / 8-K fixtures and the earnings-call
            transcript, extracts numbers, flags hedging, and refuses to publish a claim without a
            citation. This is research and summarization — not investment advice.
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {universe.companies.map((c) => {
            const on = c.ticker === ticker;
            return (
              <button
                key={c.ticker}
                type="button"
                onClick={() => {
                  setTicker(c.ticker);
                  setReport(null);
                  setError(null);
                }}
                className={cn(
                  "rounded-2xl bg-card p-5 text-left shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--shadow-border-hover)]",
                  on && "shadow-[var(--shadow-border-hover)] ring-1 ring-ring/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{c.ticker}</span>
                  <Badge variant={on ? "primary" : "default"}>{c.quarters[0]}</Badge>
                </div>
                <p className="mt-3 font-display text-xl">{c.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.sector}</p>
                <p className="mt-3 font-mono text-xs text-muted-foreground">CIK {c.cik}</p>
              </button>
            );
          })}
        </section>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button size="lg" onClick={run} disabled={running}>
            {running ? "Running agents…" : `Run ${ticker} briefing`}
          </Button>
          <p className="min-w-0 text-sm text-muted-foreground">
            Frozen fixture filings, not a live EDGAR pull. {universe.disclaimer}
          </p>
        </div>

        {running && (
          <div className="space-y-4">
            <AgentTrace steps={[]} active={active} />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        )}

        {error && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Could not run briefing</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {report && <ReportView report={report} />}

        {!report && !running && selected && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>What the agents do</CardTitle>
                <CardDescription>
                  Retrieval → analyst → risk → critic (loops on missing citations) → synthesis.
                  Cheap classification nodes stay template-local; synthesis may call Grok when a
                  key is present and otherwise uses the fixture template.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Hybrid search fuses BM25 with a dense TF-IDF stand-in for BAAI/bge-large-en-v1.5,
                  then reranks. Every chunk keeps document, section, and character offsets.
                </p>
                <p>
                  The critic drops unverifiable numbers instead of publishing them. A dedicated
                  test injects a broken claim to prove the retry path.
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Prior briefings</CardTitle>
                <CardDescription>In-session only. Nothing is written to a user account.</CardDescription>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No briefings yet this session.</p>
                ) : (
                  <ul className="space-y-2">
                    {jobs.slice(0, 6).map((j) => (
                      <li key={j.jobId} className="flex items-center justify-between gap-3 text-sm">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => setReport(j)}
                        >
                          {j.ticker} {j.quarter}
                        </button>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {j.claims.length} claims
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
