import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCorpusBundle, getUniverse, probeRetrieve, retrievalHealth } from "@/lib/research/actions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/corpus")({
  loader: async () => {
    const universe = await getUniverse();
    const ticker = universe.companies[0]?.ticker ?? "AAPL";
    const [bundle, probes] = await Promise.all([
      getCorpusBundle({ data: { ticker } }),
      retrievalHealth(),
    ]);
    return { universe, bundle, probes };
  },
  component: CorpusPage,
});

function CorpusPage() {
  const { universe, bundle: initial, probes } = Route.useLoaderData();
  const [ticker, setTicker] = useState(universe.companies[0]?.ticker ?? "AAPL");
  const [bundle, setBundle] = useState(initial);
  const [query, setQuery] = useState("iPhone revenue 2024");
  const [hits, setHits] = useState<Awaited<ReturnType<typeof probeRetrieve>>>([]);
  const [searching, setSearching] = useState(false);

  async function switchTicker(next: string) {
    setTicker(next);
    const b = await getCorpusBundle({ data: { ticker: next } });
    setBundle(b);
    setHits([]);
  }

  async function search() {
    setSearching(true);
    try {
      const rows = await probeRetrieve({ data: { query, ticker } });
      setHits(rows);
    } finally {
      setSearching(false);
    }
  }

  if (!bundle.ok) {
    return (
      <AppShell>
        <p className="text-fail">{bundle.error}</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="max-w-2xl space-y-3">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Fixture corpus</p>
          <h1 className="font-display text-4xl tracking-tight">Filings, calls, facts.</h1>
          <p className="text-muted-foreground">
            Labeled synthetic/fixture snapshot of public-company-style 10-K / 10-Q / 8-K text,
            timestamped transcripts, and XBRL facts. Not a live EDGAR or market-data response.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          {universe.companies.map((c) => (
            <Button
              key={c.ticker}
              variant={c.ticker === ticker ? "default" : "secondary"}
              onClick={() => void switchTicker(c.ticker)}
            >
              {c.ticker}
            </Button>
          ))}
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Hybrid retrieval probe</CardTitle>
            <CardDescription>
              BM25 + TF-IDF dense stand-in, reciprocal-rank fusion, lexical rerank. Production swap
              is BAAI/bge-large-en-v1.5 + bge-reranker-large.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void search();
                }}
                placeholder="Ask the corpus…"
                aria-label="Retrieval query"
              />
              <Button onClick={() => void search()} disabled={searching}>
                {searching ? "Searching…" : "Retrieve"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {probes.map((p) => (
                <Badge key={p.query} variant={p.ok ? "verify" : "fail"}>
                  {p.ok ? "pass" : "miss"} · {p.query}
                </Badge>
              ))}
            </div>
            {hits.length > 0 && (
              <ul className="space-y-3">
                {hits.map((h) => (
                  <li key={h.id} className="rounded-lg bg-secondary p-4">
                    <p className="font-mono text-xs text-muted-foreground">
                      {h.docType} · {h.section} · score {h.score.toFixed(3)} · {h.citation.charStart}–
                      {h.citation.charEnd}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">{h.excerpt}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="docs">
          <TabsList>
            <TabsTrigger value="docs">Documents</TabsTrigger>
            <TabsTrigger value="facts">XBRL facts</TabsTrigger>
            <TabsTrigger value="chunks">Indexed chunks</TabsTrigger>
          </TabsList>
          <TabsContent value="docs" className="space-y-4">
            {bundle.documents.map((d) => (
              <Card key={d.id} className="rounded-2xl">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{d.docType}</Badge>
                    {d.hedge && (
                      <Badge variant="caution">{d.hedge.count} hedge tokens</Badge>
                    )}
                    <Badge variant="outline">{d.autoChunks} auto-chunks</Badge>
                  </div>
                  <CardTitle className="text-lg">{d.title}</CardTitle>
                  <CardDescription>
                    Filed {d.filed} · {d.sourceLabel}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
                    {d.preview}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="facts">
            <div className="overflow-x-auto rounded-2xl bg-card shadow-[var(--shadow-border)]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Concept</th>
                    <th className="px-4 py-3 font-medium">Value</th>
                    <th className="px-4 py-3 font-medium">Unit</th>
                    <th className="px-4 py-3 font-medium">Period</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.facts.map((f) => (
                    <tr key={f.concept} className="border-t border-border">
                      <td className="px-4 py-3 font-mono text-xs">{f.concept}</td>
                      <td className="px-4 py-3 font-mono tabular-nums">{f.value.toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground">{f.unit}</td>
                      <td className="px-4 py-3 text-muted-foreground">{f.period}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
          <TabsContent value="chunks">
            <ul className="grid gap-3 sm:grid-cols-2">
              {bundle.chunks.map((c) => (
                <li
                  key={c.id}
                  className={cn("rounded-xl bg-card p-4 shadow-[var(--shadow-border)]")}
                >
                  <p className="font-mono text-xs text-muted-foreground">
                    {c.section} · {c.charStart}–{c.charEnd}
                    {c.table ? " · table" : ""}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">{c.text.slice(0, 260)}</p>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
