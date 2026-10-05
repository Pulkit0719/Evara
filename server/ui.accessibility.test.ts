import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Evara keyboard-accessible controls", () => {
  it("keeps primary navigation reachable through labelled native buttons", () => {
    const layout = source("../client/src/components/DashboardLayout.tsx");
    expect(layout).toContain('aria-label="Open navigation"');
    expect(layout).toContain('aria-label="Close navigation"');
    expect(layout).toContain('aria-current={isActive ? "page" : undefined}');
  });

  it("keeps onboarding and logging form fields visibly labelled", () => {
    const onboarding = source("../client/src/pages/Onboarding.tsx");
    const cycle = source("../client/src/pages/Cycle.tsx");
    expect(onboarding).toContain('htmlFor="displayName"');
    expect(onboarding).toContain('htmlFor="cycleLength"');
    expect(cycle).toContain('htmlFor="period-start"');
    expect(cycle).toContain('htmlFor="period-end"');
  });

  it("keeps calendar day selection and month navigation operable by keyboard", () => {
    const calendar = source("../client/src/pages/CalendarPage.tsx");
    expect(calendar).toContain('aria-label="Previous month"');
    expect(calendar).toContain('aria-label="Next month"');
    expect(calendar).toContain('<button key={day}');
  });
});
