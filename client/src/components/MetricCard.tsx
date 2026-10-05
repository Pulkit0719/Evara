import { type LucideIcon } from "lucide-react";
import { EstimateBadge } from "./EstimateBadge";

export function MetricCard({ label, value, note, icon: Icon, estimate = false, tone = "rose" }: { label: string; value: string; note: string; icon: LucideIcon; estimate?: boolean; tone?: "rose" | "plum" | "peach" | "sage" }) {
  return <article className="metric-card"><div className={`metric-icon metric-icon--${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></div><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><p className="eyebrow">{label}</p>{estimate ? <EstimateBadge compact /> : null}</div><p className="metric-value">{value}</p><p className="metric-note">{note}</p></div></article>;
}
