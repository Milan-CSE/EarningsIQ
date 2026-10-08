import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { GuidanceSignal } from "@/lib/research/types";

export function SignalCard({
  signal,
  error,
}: {
  signal: GuidanceSignal | null;
  error?: string;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Guidance-beat signal</CardTitle>
          <Badge variant="caution">Research signal</Badge>
        </div>
        <CardDescription>
          Backtested research signal, not investment advice. Loaded from the MLflow
          production alias — the desk refuses to score if the registry is missing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && !signal && (
          <p className="text-sm text-fail">Registry error: {error}</p>
        )}
        {signal && (
          <>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">P(beat)</p>
                <p className="font-display text-4xl tabular-nums tracking-tight">
                  {(signal.pBeat * 100).toFixed(1)}
                  <span className="ml-1 text-lg text-muted-foreground">%</span>
                </p>
              </div>
              <Badge variant={signal.predictedClass === "beat" ? "verify" : "fail"}>
                predicted {signal.predictedClass}
              </Badge>
            </div>
            <Progress value={Math.round(signal.pBeat * 100)} />
            <p className="font-mono text-xs text-muted-foreground">
              {signal.modelName} · v{signal.modelVersion} · alias {signal.alias}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">{signal.disclaimer}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
