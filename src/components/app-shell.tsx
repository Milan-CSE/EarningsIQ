import { Link } from "@tanstack/react-router";
import { DisclaimerBar } from "./disclaimer-bar";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Briefing" },
  { to: "/corpus", label: "Corpus" },
  { to: "/models", label: "Models" },
  { to: "/eda", label: "EDA" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl min-w-0 flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display text-xl tracking-tight">EarningsIQ</span>
            <span className="hidden text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
              Research desk
            </span>
          </Link>
          <nav className="flex min-w-0 flex-wrap items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex h-11 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground",
                )}
                activeProps={{ className: "text-foreground bg-secondary" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <DisclaimerBar />
      </header>
      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-8 sm:py-10">{children}</main>
    </div>
  );
}
