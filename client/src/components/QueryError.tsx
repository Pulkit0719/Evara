import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QueryError({ resource, onRetry }: { resource: string; onRetry: () => void }) {
  return <section className="content-card p-8" role="alert"><div className="flex items-start gap-3"><div className="empty-state__icon"><AlertCircle className="h-5 w-5" /></div><div><p className="font-semibold text-foreground">We could not load {resource}.</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Your private information has not been changed. Please try again.</p><Button variant="outline" className="mt-4" onClick={onRetry}>Try again</Button></div></div></section>;
}
