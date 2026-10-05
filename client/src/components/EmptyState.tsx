import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({ icon: Icon, title, detail, action }: { icon: LucideIcon; title: string; detail: string; action?: { label: string; onClick: () => void } }) {
  return <div className="empty-state"><div className="empty-state__icon"><Icon className="h-5 w-5" aria-hidden="true" /></div><div><h3 className="text-base font-semibold text-foreground">{title}</h3><p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{detail}</p></div>{action ? <Button variant="outline" onClick={action.onClick}>{action.label}</Button> : null}</div>;
}
