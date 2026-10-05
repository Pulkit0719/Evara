import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Evara responsive layout safeguards", () => {
  it("preserves a mobile navigation drawer and compact application spacing", () => {
    const css = source("../client/src/index.css");
    const layout = source("../client/src/components/DashboardLayout.tsx");
    expect(css).toContain("@media(max-width:860px)");
    expect(css).toContain(".app-sidebar--open{transform:translateX(0)}");
    expect(css).toContain("@media(max-width:620px)");
    expect(layout).toContain('className="mobile-menu"');
  });

  it("keeps dense tracking content usable at small widths", () => {
    const css = source("../client/src/index.css");
    expect(css).toContain(".field-grid,.field-grid--three,.goal-list,.scale-grid{grid-template-columns:1fr}");
    expect(css).toContain(".calendar-grid{min-width:560px}");
    expect(css).toContain(".calendar-card{margin-inline:-.15rem;padding:.5rem;overflow-x:auto}");
  });

  it("keeps the health summary actions fluid and creates a clean print view", () => {
    const report = source("../client/src/pages/Reports.tsx");
    const css = source("../client/src/index.css");
    expect(report).toContain('className="flex flex-wrap gap-2"');
    expect(report).toContain('className="dashboard-grid report-grid"');
    expect(css).toContain("@media print");
    expect(css).toContain(".app-sidebar,.app-header,.no-print,.mobile-scrim{display:none!important}");
  });
});
