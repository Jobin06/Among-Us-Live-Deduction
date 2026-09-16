import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Phase 7 Automated Structural & Accessibility Test Suite
 *
 * Verifies that the implementation conforms to:
 * - REQUIREMENTS.md §26 (Dark gaming theme, professional e-sports, no copyrighted assets)
 * - REQUIREMENTS.md §27 (Responsive layout for mobile, tablet, desktop, projector)
 * - Phase 7 Accessibility Plan (Semantic HTML, ARIA landmarks, touch targets >= 44px/48px, contrast ratios)
 */
describe("Consolidated Phase 7 — Responsive & Accessibility QA", () => {
  const readSrcFile = (relPath: string) => {
    return fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
  };

  describe("1. Touch Targets & Responsive Controls", () => {
    it("ScoreEntryModal implements 48px stepper controls for referee tallying", () => {
      const content = readSrcFile("src/components/volunteer/score-entry-modal.tsx");
      // Steppers must have h-12 w-12 (48x48px)
      expect(content).toContain("h-12 w-12 rounded-xl");
      expect(content).toContain('aria-label="Decrease tasks completed"');
      expect(content).toContain('aria-label="Increase tasks completed"');
      expect(content).toContain('aria-label="Decrease successful eliminations"');
      expect(content).toContain('aria-label="Increase successful eliminations"');
    });

    it("ScoreEntryModal implements min-h-[44px] touch targets for role toggles and checkboxes", () => {
      const content = readSrcFile("src/components/volunteer/score-entry-modal.tsx");
      expect(content).toContain("min-h-[48px]");
      expect(content).toContain("min-h-[44px] py-1");
    });

    it("Navbar implements min-h-[44px] touch targets for mobile navigation items", () => {
      const content = readSrcFile("src/components/layout/navbar.tsx");
      expect(content).toContain("min-h-[44px] min-w-[44px]");
      expect(content).toContain("min-h-[44px] text-sm font-medium");
    });

    it("Volunteer Dashboard inputs and action buttons implement min-h-[44px] touch targets", () => {
      const content = readSrcFile("src/app/volunteer/dashboard/page.tsx");
      expect(content).toContain("min-h-[44px] rounded-xl");
      expect(content).toContain("px-4 py-2 min-h-[44px]");
    });

    it("Participant Dashboard action buttons implement min-h-[44px] touch targets", () => {
      const content = readSrcFile("src/app/participant/dashboard/page.tsx");
      expect(content).toContain("min-h-[44px] min-w-[44px]");
      expect(content).toContain("min-h-[44px] text-xs font-semibold");
    });

    it("Admin Dashboard tab controls implement min-h-[44px] touch targets", () => {
      const content = readSrcFile("src/app/admin/dashboard/page.tsx");
      expect(content).toContain("min-h-[44px]");
    });

    it("Leaderboard and Results projector buttons implement min-h-[44px] touch targets", () => {
      const lbContent = readSrcFile("src/app/leaderboard/page.tsx");
      const resContent = readSrcFile("src/app/results/page.tsx");
      expect(lbContent).toContain("min-h-[44px] min-w-[44px]");
      expect(resContent).toContain("min-h-[44px]");
    });
  });

  describe("2. Modal Accessibility & Focus Containment", () => {
    it("ScoreEntryModal provides dialog role, labelledby, and escape key listener", () => {
      const content = readSrcFile("src/components/volunteer/score-entry-modal.tsx");
      expect(content).toContain('role="dialog"');
      expect(content).toContain('aria-modal="true"');
      expect(content).toContain('aria-labelledby="score-modal-title"');
      expect(content).toContain('e.key === "Escape"');
      expect(content).toContain("max-h-[85vh] overflow-y-auto");
    });

    it("ScoreHistoryModal provides dialog role, labelledby, and escape key listener", () => {
      const content = readSrcFile("src/components/participant/score-history-modal.tsx");
      expect(content).toContain('role="dialog"');
      expect(content).toContain('aria-modal="true"');
      expect(content).toContain('aria-labelledby="history-modal-title"');
      expect(content).toContain('e.key === "Escape"');
      expect(content).toContain("max-h-[85vh]");
    });

    it("Navbar mobile menu provides Escape listener and route-change auto-close", () => {
      const content = readSrcFile("src/components/layout/navbar.tsx");
      expect(content).toContain('e.key === "Escape" && mobileMenuOpen');
      expect(content).toContain("setMobileMenuOpen(false)");
      expect(content).toContain('aria-controls="mobile-navigation-menu"');
    });
  });

  describe("3. Table Semantics & ARIA Landmarks", () => {
    it("Volunteer Dashboard table includes scope='col' on headers and role='region'", () => {
      const content = readSrcFile("src/app/volunteer/dashboard/page.tsx");
      expect(content).toContain('<th scope="col"');
      expect(content).toContain('role="region"');
      expect(content).toContain('aria-label="Lobby roster table"');
    });

    it("Admin Dashboard tab navigation includes role='tablist' and role='tab'", () => {
      const content = readSrcFile("src/app/admin/dashboard/page.tsx");
      expect(content).toContain('role="tablist"');
      expect(content).toContain('role="tab"');
      expect(content).toContain("aria-selected={isActive}");
    });

    it("Leaderboard table includes scope='col' on headers and aria-live='polite'", () => {
      const content = readSrcFile("src/app/leaderboard/page.tsx");
      expect(content).toContain('<th scope="col"');
      expect(content).toContain('aria-live="polite"');
      expect(content).toContain('role="region"');
    });

    it("Results table includes scope='col' on headers and role='region'", () => {
      const content = readSrcFile("src/app/results/page.tsx");
      expect(content).toContain('<th scope="col"');
      expect(content).toContain('role="region"');
      expect(content).toContain('aria-label="Complete Tournament Standings"');
    });
  });

  describe("4. Responsive Layout & Mobile Hierarchy", () => {
    it("Results podium applies mobile order hierarchy (order-1 for 1st place, order-2 for 2nd place)", () => {
      const content = readSrcFile("src/app/results/page.tsx");
      expect(content).toContain("order-1 md:order-2");
      expect(content).toContain("order-2 md:order-1");
      expect(content).toContain("order-3 md:order-3");
    });

    it("Participant Dashboard renders announcements without a dismiss button", () => {
      const content = readSrcFile("src/app/participant/dashboard/page.tsx");
      expect(content).toContain('aria-label="Official Tournament Announcements"');
      expect(content).not.toContain("dismissAnnouncement");
      expect(content).not.toContain("onDismiss");
    });

    it("Tables have overflow-x-auto wrappers to avoid viewport clipping on narrow screens", () => {
      const volunteerContent = readSrcFile("src/app/volunteer/dashboard/page.tsx");
      const lbContent = readSrcFile("src/app/leaderboard/page.tsx");
      const resContent = readSrcFile("src/app/results/page.tsx");
      expect(volunteerContent).toContain("overflow-x-auto");
      expect(lbContent).toContain("overflow-x-auto");
      expect(resContent).toContain("overflow-x-auto");
    });
  });

  describe("5. Color Contrast & WCAG Luminance Compliance", () => {
    // Relative luminance calculation according to WCAG specs
    const getLuminance = (r: number, g: number, b: number) => {
      const [rs, gs, bs] = [r, g, b].map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const getContrastRatio = (rgb1: [number, number, number], rgb2: [number, number, number]) => {
      const l1 = getLuminance(...rgb1);
      const l2 = getLuminance(...rgb2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    };

    it("Body text slate-100 on slate-950 exceeds WCAG AAA (7:1) contrast ratio", () => {
      const slate950: [number, number, number] = [2, 6, 23]; // #020617
      const slate100: [number, number, number] = [241, 245, 249]; // #f1f5f9
      const ratio = getContrastRatio(slate100, slate950);
      expect(ratio).toBeGreaterThan(15); // > 15:1
    });

    it("Accent cyan-400 on slate-950 exceeds WCAG AA (4.5:1) contrast ratio", () => {
      const slate950: [number, number, number] = [2, 6, 23];
      const cyan400: [number, number, number] = [34, 211, 238]; // #22d3ee
      const ratio = getContrastRatio(cyan400, slate950);
      expect(ratio).toBeGreaterThan(9); // > 9:1
    });

    it("Accent amber-400 on slate-950 exceeds WCAG AA (4.5:1) contrast ratio", () => {
      const slate950: [number, number, number] = [2, 6, 23];
      const amber400: [number, number, number] = [251, 191, 36]; // #fbbf24
      const ratio = getContrastRatio(amber400, slate950);
      expect(ratio).toBeGreaterThan(10); // > 10:1
    });

    it("Destructive red-400 on slate-950 exceeds WCAG AA (4.5:1) contrast ratio", () => {
      const slate950: [number, number, number] = [2, 6, 23];
      const red400: [number, number, number] = [248, 113, 113]; // #f87171
      const ratio = getContrastRatio(red400, slate950);
      expect(ratio).toBeGreaterThan(5); // > 5:1
    });
  });
});
