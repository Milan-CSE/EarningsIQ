import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchFindings } from "@/lib/research/actions";

export const Route = createFileRoute("/eda")({
  loader: () => fetchFindings(),
  component: EdaPage,
});

const FINDING_CARDS = [
  {
    title: "Beat rates are sticky, not stationary",
    body: "Names like NVDA beat more often in this panel; AAPL is closer to even. The cross-sectional mean also drifts by quarter. That is why last_4q_beat_rate is a feature, and why the train/test cut is a walk-forward split by fiscal quarter rather than a random row shuffle. Shuffling would leak 2024Q4 into a model asked to score 2023Q2.",
  },
  {
    title: "Tone is a weak but real signal",
    body: "Call sentiment correlates positively with the next-session reaction proxy; hedging-token rate is higher on misses. Neither is strong enough to use alone — they sit alongside fundamentals so the tree cannot overfit a single lexicon.",
  },
  {
    title: "XBRL units are a trap",
    body: "The same concept arrives as USD, USD millions, or USD billions. We never feed raw levels into the model. Features are scale-free: revenue_growth_yoy, gross_margin_delta, ocf_to_ni, share_count_change.",
  },
  {
    title: "Guidance width is information",
    body: "A wider published range lines up with more misses in this panel. A missing range is encoded as 0 and accompanied by the hedge-rate feature rather than imputed.",
  },
  {
    title: "Class balance is usable",
    body: "Beat rate sits near 55/45. No resampling, no class weights in the baseline. We still report precision and recall, not just accuracy.",
  },
  {
    title: "Chunks should not swallow tables",
    body: "The length histogram is bimodal: short narrative and slightly longer table blocks. The chunker is forbidden from splitting a table across chunks, so a cited number always lives in one chunk.",
  },
];

function EdaPage() {
  const { figures } = Route.useLoaderData();

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="max-w-2xl space-y-3">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Exploratory analysis</p>
          <h1 className="font-display text-4xl tracking-tight">Why these features.</h1>
          <p className="text-muted-foreground">
            Charts from the synthetic panel in fixtures/panel.csv. The write-up in eda/FINDINGS.md
            is the feature-engineering contract for ml/train.py — not a pile of unexplained plots.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          {FINDING_CARDS.map((card) => (
            <Card key={card.title} className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{card.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {figures.map((fig) => (
            <Card key={fig.src} className="overflow-hidden rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">{fig.title}</CardTitle>
                <CardDescription>{fig.note}</CardDescription>
              </CardHeader>
              <CardContent>
                <img
                  src={fig.src}
                  alt={fig.title}
                  className="w-full rounded-md outline outline-1 -outline-offset-1 outline-foreground/10"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
