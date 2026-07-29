---
version: alpha
name: GEA Weekly Campaign Reports
description: The shared GEA warm-neutral design system, ported from the GEA Careers Assessment and GEA Leave apps — same palette, hero treatment, section shells, form controls and gold primary action, applied across the agent dashboard (functional) and the vendor/landlord portals (marketing-facing).
colors:
  primary: "#1A1814"
  secondary: "#8B8580"
  tertiary: "#C8A96E"
  neutral: "#FAF8F4"
  gold: "#C8A96E"
  gold-soft: "#E8D4A8"
  ink: "#1A1814"
  paper: "#FAF8F4"
  surface: "#F2EEE8"
  rule: "#E0DBD4"
  muted: "#8B8580"
  status-pending: "#5B7A99"
  status-approved: "#4A7C6F"
  status-rejected: "#9A5B5B"
  status-pending-bg: "#EAEFF4"
  status-approved-bg: "#E7F0EC"
  status-rejected-bg: "#F3E9E9"
typography:
  display-h1:
    fontFamily: "Playfair Display"
    fontSize: 44px
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: -0.02em
  display-h2:
    fontFamily: "Playfair Display"
    fontSize: 28px
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: -0.01em
  body-md:
    fontFamily: "DM Sans"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "DM Sans"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  mono-tabular:
    fontFamily: "IBM Plex Mono"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.4
rounded:
  md: 0.625rem
  lg: 1rem
spacing:
  xs: 0.5rem
  sm: 0.75rem
  md: 1rem
  lg: 1.5rem
  xl: 2.5rem
---

# GEA Weekly Campaign Reports — Design System

Ported from the GEA HR apps (`GEA_HR_assessment`, `GEA_HR_leave_applications`)
so every staff- and client-facing GEA surface reads as one company. The
palette, type stack, hero treatment, section shells, form controls and gold
primary action below are the shared vocabulary; this document adapts them to
this project's two very different audiences.

## Overview

GEA's house palette is warm, editorial neutrals anchored by a single restrained
gold accent — never a corporate blue, never pure black or white. Quiet
confidence, typography-forward rather than graphic-forward.

The house system (`~/.claude/GEA_DESIGN.md`) classifies every surface, and
this project spans two classifications:

| Surface | Classification | Feel |
|---|---|---|
| Agent dashboard, wizards, admin | **Functional** | Dense, scannable, speed-first |
| Vendor / landlord portals, PDF reports | **Marketing** | Premium, trust-building, editorial |

**The rule: same vocabulary, different rhythm.** Both sides use the same
palette, fonts and components — but the vendor portal earns the full editorial
treatment (hero, generous spacing, display type), while the agent dashboard
runs the same parts at functional density. An agent switching to the vendor
preview should feel the register shift without the brand changing.

Existing note: `GEA_ST_reports_design_guidelines/DESIGN.md` ("Warm Editorial
Studio") is an earlier, brand-agnostic spec for this project. This file
supersedes it as the working reference; the guidelines folder remains as
archive. The fonts actually loaded in `src/app/layout.tsx` (Bodoni Moda /
Schibsted Grotesk / Spline Sans Mono) predate this port — see Typography for
the target stack.

## Colors

- **Primary / Ink (#1A1814):** Warm near-black. Headings, primary text, hero
  background base.
- **Neutral / Paper (#FAF8F4):** Warm off-white. Page background — never pure
  white, including PDF exports.
- **Surface (#F2EEE8):** Elevated cards, panels, section shells.
- **Rule (#E0DBD4):** Dividers, borders, table rules, disabled states.
- **Secondary / Muted (#8B8580):** Secondary text, labels, captions, metadata.
- **Tertiary / Gold (#C8A96E) and Gold Soft (#E8D4A8):** The sole accent.
  Hero rule dividers, focus rings, active-state underlines, stat highlights,
  and the **primary button fill** (gold ground, ink text, gold-soft hover).
  One gold *surface* per screen at most — the primary action. Every other use
  is a hairline, a rule, or a ring. Gold marks the one thing that matters,
  not everything.
- **Status colors** (cool-toned, deliberately never gold-adjacent): pending
  `#5B7A99`, approved `#4A7C6F`, rejected `#9A5B5B`, with matching `*-bg`
  tints for badges. Use these for draft/approved/sent report states rather
  than the current `--success`/`--warning`/`--danger` warm tones, which
  compete with gold.

## Typography

- **Display (Playfair Display → Georgia → serif):** Vendor-facing headlines,
  report titles, the portal hero, section titles. Weight 400 only — display
  type is expressive through letterform, never weight; bolding it is a
  house-rule violation. On the agent dashboard, display appears only in
  section-shell headers, never in data rows.
- **Body (DM Sans → system-ui):** All UI text, form labels, buttons, nav,
  table content.
- **Mono (IBM Plex Mono → Courier New):** Every number a vendor or agent
  reads — views, enquiries, saves, prices, dates — set with
  `font-variant-numeric: tabular-nums`. Monospace numerals read as precise
  and audit-safe; campaign stats are this product's core content, so this
  matters more here than anywhere else in the GEA suite.

**Migration note:** the currently loaded Google fonts (Bodoni Moda, Schibsted
Grotesk, Spline Sans Mono) should be replaced in `src/app/layout.tsx` with
Playfair Display, DM Sans and IBM Plex Mono via `next/font` to match the rest
of the suite. The CSS variable names (`--font-display` / `--font-body` /
`--font-mono`) already match — only the font imports change. Playfair and DM
Sans are Google-hosted stand-ins for the licensed Klim faces (Canela, Söhne);
swap to self-hosted licensed files when available.

## Layout

- Warm-neutral base (paper), never pure white.
- **Vendor portal shell:** hero → single `max-w-4xl` content column
  (`px-4 pt-8 pb-20`) — the assessment app's measure. Generous vertical
  rhythm; each report section is a distinct moment.
- **Agent dashboard shell:** compact masthead (see Hero) → full-width dense
  layout. Density with hierarchy: agents scan many properties quickly, so
  tables and lists stay tight, scannability coming from type hierarchy and
  rules rather than whitespace.
- **Section shell:** `rounded-2xl`, `border-rule`, `bg-surface`, a ruled
  header band (`px-8 pt-8 pb-6`) over a body (`px-8 py-7`). Header carries a
  `font-display` title, optional muted description, optional gold numbered
  disc, optional right-aligned action. Inside a section, nested panels sit on
  `bg-paper` — surface-on-surface reads as mush.
- **Cards:** `rounded-lg` (0.625rem), `border-rule`, `bg-surface`, `p-6`,
  for small standalone panels only.
- **Form controls:** `rounded-lg`, generous `px-4 py-3`, `border-rule` on
  `bg-paper`, gold focus ring (`focus:ring-2 focus:ring-gold/25`). Focus
  rings are never removed — accessibility floor, non-negotiable.

## Hero banner

The GEA arrival treatment, ported from the assessment app:

1. Full-bleed brand photograph (`background-size: cover`, `center top`) under
   a warm gradient overlay `rgba(26,24,20,0.82)` → `rgba(26,24,20,0.68)`,
   dark-to-lighter top-to-bottom. Gradient-over-photo, never a flat colour,
   so the image keeps depth. For vendor reports, the subject property's own
   hero photo is the ideal background — falling back to the GEA brand
   photograph when none exists.
2. Centered GEA logo above the headline, 90% opacity.
3. Centered `font-display` headline, `clamp(2.25rem, 5vw, 3.75rem)`, tight
   tracking (`-0.02em`), weight 400.
4. A short gold rule (`h-px w-14 bg-gold`) between headline and subhead.
5. Muted subhead at 65% paper opacity (`text-paper/65`).

**Where it renders:** full-height on the vendor/landlord portal landing
(the arrival moment — the vendor opening their weekly report). A **compact
variant** (`py-10 md:py-12`, smaller clamp) serves as masthead on interior
vendor pages. The agent dashboard gets at most the compact variant — or none;
density wins on daily-use screens.

## Motion

Keep the existing restrained motion vocabulary: the staggered `.reveal`
fade-up on page load and `accent-expand` for gold rules, both gated behind
`prefers-reduced-motion`. Nothing bounces, nothing loops. Skeletons, never
spinners, on loading surfaces.

## Do's and Don'ts

- **Do** keep gold to one accent per screen — the primary button, a rule, a
  focus ring. Never a background fill for content areas.
- **Do** set every stat, price and date in mono with tabular figures.
- **Do** let the vendor portal breathe (editorial rhythm) while the agent
  dashboard stays dense (functional rhythm) — same parts, different spacing.
- **Do** use the subject property's photo for the vendor report hero when
  available.
- **Don't** bold Playfair Display, or use it in data rows, labels, or agent
  table UI.
- **Don't** use pure `#000`/`#fff` anywhere — always warm ink/paper, PDFs
  included.
- **Don't** let status or chart colors drift gold-adjacent — status stays
  cool-toned so the one true accent keeps its authority.
- **Don't** style the agent dashboard like the vendor portal — agents should
  feel the register shift when previewing what a vendor sees.
