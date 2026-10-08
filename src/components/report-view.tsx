import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AgentTrace } from "@/components/agent-trace";
import { SignalCard } from "@/components/signal-card";
import type { Claim, ResearchReport } from "@/lib/research/types";
import { cn } from "@/lib/utils";

function statusVariant(status: Claim["status"]) {
  if (status === "supported") return "verify" as const;
  if (status === "hedged") return "caution" as const;
  return "fail" as const;
}

export function ReportView({ report }: { report: ResearchReport }) {
  const [openCite, setOpenCite] = useState<string | null>(report.claims[0]?.id ?? null);
  const citeById = new Map(report.citations.map((c) => [c.id, c]));

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Fixture corpus</Badge>
          <Badge variant="default">{report.ticker}</Badge>
          <Badge variant="default">{report.quarter}</Badge>
          <Badge variant={report.verification.allCited ? "verify" : "fail"}>
            {report.verification.allCited ? "All claims cited" : "Uncited claims"}
          </Badge>
        </div>
        <h2 className="font-display text-3xl tracking-tight sm:text-4xl">{report.companyName}</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {report.executiveSummary}
        </p>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          {report.synthesisModel} · {report.latencyMs} ms · ${report.costUsd.toFixed(4)} · critic
          retries {report.verification.criticRetries}
        </p>
      </header>

      <AgentTrace steps={report.trace} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          {report.claims.map((claim) => {
            const open = openCite === claim.id;
            return (
              <Card key={claim.id} className="rounded-2xl">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant(claim.status)}>{claim.status}</Badge>
                    {claim.speaker && (
                      <span className="text-xs text-muted-foreground">{claim.speaker}</span>
                    )}
                    <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                      {(claim.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <CardTitle className="text-base leading-snug">{claim.text}</CardTitle>
                  {typeof claim.numericValue === "number" && (
                    <CardDescription className="font-mono tabular-nums">
                      {claim.metric}: {claim.numericValue.toLocaleString()} {claim.unit}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{claim.note}</p>
                  <button
                    type="button"
                    className="text-sm text-foreground underline-offset-4 hover:underline"
                    onClick={() => setOpenCite(open ? null : claim.id)}
                  >
                    {open ? "Hide citations" : `Citations (${claim.citations.length})`}
                  </button>
                  {open && (
                    <ul className="space-y-2">
                      {claim.citations.map((id) => {
                        const c = citeById.get(id);
                        if (!c) return null;
                        return (
                          <li
                            key={id}
                            className="rounded-md bg-secondary p-3 text-sm leading-relaxed"
                          >
                            <p className="mb-1 font-mono text-xs text-muted-foreground">
                              {c.docType} · {c.section}
                              {c.page ? ` · p.${c.page}` : ""}
                              {c.timestamp ? ` · ${c.timestamp}` : ""} · {c.charStart}–{c.charEnd}
                            </p>
                            <p>{c.excerpt}</p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="space-y-4">
          <SignalCard signal={report.signal} error={report.signalError} />
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Risk / tone</CardTitle>
              <CardDescription>Hedging and geography flags from the call transcript.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {report.risks.map((risk) => (
                <div key={risk.label}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{risk.label}</p>
                    <Badge
                      variant={
                        risk.severity === "high" ? "fail" : risk.severity === "medium" ? "caution" : "verify"
                      }
                    >
                      {risk.severity}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{risk.evidence}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      <section>
        <h3 className="font-display text-xl">Retrieved context</h3>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Hybrid BM25 + dense (TF-IDF stand-in for bge-large) fused with RRF, then reranked.
          Every chunk carries offsets so the critic can cite it.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {report.retrieved.map((chunk) => (
            <li key={chunk.id} className={cn("rounded-lg bg-card p-4 shadow-[var(--shadow-border)]")}>
              <p className="font-mono text-xs text-muted-foreground">
                {chunk.docType} · {chunk.section}
                {chunk.timestamp ? ` · ${chunk.timestamp}` : ""}
              </p>
              <p className="mt-2 text-sm leading-relaxed">{chunk.text.slice(0, 220)}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">{report.disclaimer}</p>
    </div>
  );
}
