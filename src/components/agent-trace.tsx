import { Badge } from "@/components/ui/badge";
import type { AgentStep } from "@/lib/research/types";
import { cn } from "@/lib/utils";

const LABELS: Record<AgentStep["name"], string> = {
  retrieval: "Retrieval",
  analyst: "Analyst",
  risk: "Risk",
  critic: "Critic",
  synthesis: "Synthesis",
};

export function AgentTrace({
  steps,
  active,
}: {
  steps: AgentStep[];
  active?: AgentStep["name"] | null;
}) {
  return (
    <ol className="grid gap-2 sm:grid-cols-5">
      {(["retrieval", "analyst", "risk", "critic", "synthesis"] as const).map((name, i) => {
        const step = steps.find((s) => s.name === name);
        const isActive = active === name;
        const status = step?.status ?? (isActive ? "running" : "pending");
        return (
          <li
            key={name}
            className={cn(
              "rounded-lg bg-card p-3 shadow-[var(--shadow-border)] transition-[box-shadow,opacity] duration-150",
              status === "pending" && "opacity-50",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs tabular-nums text-muted-foreground">0{i + 1}</span>
              <Badge
                variant={
                  status === "ok"
                    ? "verify"
                    : status === "retry"
                      ? "caution"
                      : status === "failed"
                        ? "fail"
                        : "default"
                }
              >
                {status}
              </Badge>
            </div>
            <p className="mt-2 text-sm font-medium">{LABELS[name]}</p>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
              {step?.summary ?? (isActive ? "Running…" : "Waiting")}
            </p>
            {step && (
              <p className="mt-2 font-mono text-xs tabular-nums text-muted-foreground">
                {step.latencyMs} ms · {step.retries} retry
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
