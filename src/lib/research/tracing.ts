/**
 * LLM/agent tracing. Production: Langfuse (self-hosted via docker-compose).
 * This file-backed tracer is the local stand-in so a report still produces a
 * cost/latency line when Langfuse keys are absent. Do not confuse with MLflow,
 * which tracks the classical guidance-beat model only.
 */
export type TraceEvent = {
  name: string;
  model: string;
  latencyMs: number;
  costUsd: number;
  promptVersion: string;
};

const EVENTS: TraceEvent[] = [];

export function logTrace(event: TraceEvent): void {
  EVENTS.push(event);
  const line = `[langfuse-stub] ${event.name} model=${event.model} ${event.latencyMs}ms $${event.costUsd.toFixed(4)} prompt=${event.promptVersion}`;
  console.info(line);
}

export function recentTraces(): TraceEvent[] {
  return [...EVENTS];
}
