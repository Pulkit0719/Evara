import { Sparkles } from "lucide-react";

export function EstimateBadge({ compact = false }: { compact?: boolean }) {
  return <span className="estimate-badge" title="This value is an estimate based on your recorded history."><Sparkles className="h-3 w-3" aria-hidden="true" />{compact ? "Estimate" : "Estimated from your history"}</span>;
}
