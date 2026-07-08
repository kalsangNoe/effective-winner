# Typography & Spacing Reference

A summary of the type, spacing, and rhythm used across the blog. Values are pulled
from `src/app/globals.css`, `src/app/layout.tsx`, `src/app/blog/[slug]/page.tsx`,
and the two sidebar components. Tailwind utility classes are shown with their
resolved CSS values in parentheses.

Root font size is the browser default (`16px`), so `1rem = 16px`.

> **The tables below document the _base_ design.** On top of it sits a per-column
> override layer (see next section) that changes the effective font, size, leading,
> and tracking of each column. Where the two differ, the override wins.

---

## Per-column overrides (applied)

Each column reads `--typo-<col>-{font,scale,leading,tracking}` CSS variables
(`<col>` = `list` | `article` | `outline`), consumed by the `.typo-*` rules in
`globals.css`. `scale` and `leading` are **multipliers** applied via `calc()` to
the base size / line-height; `font` is a full font-family; `tracking` is a
letter-spacing. The applied values live in the `:root` block of `globals.css`:

| Column (class) | Font | Size (`scale`) | Line height (`leading`) | Letter spacing (`tracking`) |
| --- | --- | --- | --- | --- |
| Post list (`.typo-list`) | Arial | ×1.0 | ×0.8 | −0.025em |
| Article (`.typo-article`) | Helvetica | ×0.8 | ×0.95 | −0.03em |
| Outline (`.typo-outline`) | Arial | ×1.0 | ×0.8 | −0.025em |

Effective sizes after the multiplier (base × scale):

| Element | Base | Applied |
| --- | --- | --- |
| Article date | 0.875rem | `×0.8` → 0.7rem |
| Article title `<h1>` | 2.25rem | `×0.8` → 1.8rem (keeps `tracking-tight`) |
| Article description | 1.125rem | `×0.8` → 0.9rem |
| `.prose` body | 1.125rem | `×0.8` → 0.9rem; leading 1.8 `×0.95` → 1.71 |
| `.prose h2` / `h3` | 1.5rem / 1.25rem | → 1.2rem / 1rem |
| `.prose pre` / `table` | 0.9rem / 1rem | → 0.72rem / 0.8rem |
| Sidebar nav link | 0.875rem | `×1.0` → 0.875rem; leading 1.25rem `×0.8` → 1rem |
| Sidebar heading | 0.75rem | `×1.0` → 0.75rem (keeps `tracking-wider`) |

Fallbacks in the `.typo-*` rules equal the base values, so clearing a variable
restores the base design for that column. Element-specific rules that are more
specific than the column container — heading `tracking-*` and code's mono font —
are intentionally left untouched. These values were produced by the (currently
dormant) `TypographySettings` popover; see CLAUDE.md → **Per-column typography**.

---

## Fonts

| Role | Family | Source |
| --- | --- | --- |
| UI / sans (default) | **Geist Sans** → `--font-geist-sans`, fallback `Arial, Helvetica, sans-serif` | `next/font/google` in `layout.tsx` |
| Monospace (code) | **Geist Mono** → `--font-geist-mono`, fallback `ui-monospace, monospace` | `next/font/google` in `layout.tsx` |

- `<html>` carries `antialiased` (`-webkit-font-smoothing: antialiased`).
- Body base color: `--foreground` = `#171717` light / `#ededed` dark.
- Background: `--background` = `#ffffff` light / `#0a0a0a` dark.

---

## Type scale

### Post header (column 2 — `page.tsx`)

| Element | Size | Weight | Tracking | Line height | Color |
| --- | --- | --- | --- | --- | --- |
| Date | `text-sm` (0.875rem / 14px) | normal | normal | `1.25rem` | zinc-400 / zinc-500 |
| Title `<h1>` | `text-4xl` (2.25rem / 36px) | `font-bold` (700) | `tracking-tight` (−0.025em) | `2.5rem` | zinc-900 / zinc-50 |
| Description | `text-lg` (1.125rem / 18px) | normal | normal | `1.75rem` | zinc-500 / zinc-400 |

### Article body — `.prose` (rendered markdown)

| Element | Size | Weight | Line height | Color (light / dark) |
| --- | --- | --- | --- | --- |
| Body text | `1.125rem` (18px) | 400 | **`1.8`** | `#3f3f46` zinc-700 / `#d4d4d8` zinc-300 |
| `<h2>` | `1.5rem` (24px) | 600 | — | `#18181b` zinc-900 / `#fafafa` zinc-50 |
| `<h3>` | `1.25rem` (20px) | 600 | — | `#18181b` zinc-900 / `#fafafa` zinc-50 |
| `<strong>` | inherit | 600 | — | zinc-900 / zinc-50 |
| `<a>` | inherit | inherit | — | `#2563eb` blue-600 / `#60a5fa` blue-400, underline, `text-underline-offset: 2px` |
| `<code>` (inline) | `0.9em` | inherit | — | on `#f4f4f5` / `#27272a` bg |
| `<pre>` (block) | `0.9rem` (14.4px) | inherit | `1.6` | `#fafafa` on `#18181b` / on `#000` |
| `<table>` | `1rem` (16px) | inherit | — | inherits body |
| `<blockquote>` | inherit | inherit, *italic* | — | `#52525b` zinc-600 / `#a1a1aa` zinc-400 |

### Sidebars (columns 1 & 3 — `PostList`, `Outline`)

| Element | Size | Weight | Tracking | Case |
| --- | --- | --- | --- | --- |
| Section heading ("All posts" / "On this page") | `text-xs` (0.75rem / 12px) | `font-semibold` (600) | `tracking-wider` (0.05em) | `uppercase` |
| Nav link (default) | `text-sm` (0.875rem / 14px) | normal | normal | — |
| Nav link (active) | `text-sm` | `font-medium` (500) | normal | — |

---

## Spacing & padding

### Layout columns

| Region | Width | Padding | Notes |
| --- | --- | --- | --- |
| Column 1 — post list `<aside>` | `w-64` (16rem / 256px) | `pt-8` (2rem top) | sticky, `h-dvh`, scrolls |
| Column 2 — article `<main>` | `flex-1`, article `max-w-2xl` (42rem / 672px), centered `mx-auto` | `px-8` (2rem) · `py-16` (4rem) | — |
| Column 3 — outline `<aside>` | `w-64` (16rem / 256px) | `pt-8` (2rem top) | sticky, `hidden lg:block` |

> Both sidebars deliberately share `pt-8` and identical nav markup so their content
> lines up vertically and horizontally. Change one, change the other.

### Article header

- `header` bottom margin: `mb-10` (2.5rem)
- Date → title gap: `mb-2` (0.5rem)
- Title → description gap: `mt-3` (0.75rem)

### `.prose` vertical rhythm

| Rule | Value |
| --- | --- |
| Space between top-level blocks (`> * + *`) | `margin-top: 1.25rem` (20px) |
| `<h2>` padding-top | `1rem` |
| `<h3>` padding-top | `0.5rem` |
| `<h2>` / `<h3>` `scroll-margin-top` | `2rem` (offset for anchor jumps) |
| List item to item (`li + li`) | `margin-top: 0.375rem` (6px) |
| `<ul>` / `<ol>` indent | `padding-left: 1.5rem` |
| `<blockquote>` | `padding-left: 1rem`, `border-left: 3px` |
| Inline `<code>` | `padding: 0.125rem 0.375rem`, `border-radius: 0.25rem` |
| `<pre>` block | `padding: 1rem 1.25rem`, `border-radius: 0.5rem` |
| Table cells (`th`/`td`) | `padding: 0.5rem 0.75rem`, `1px` border |

### Sidebar nav (both columns)

| Element | Padding | Gap |
| --- | --- | --- |
| `<nav>` wrapper | `p-4` (1rem) | — |
| Section heading | `px-3 pb-2` | — |
| List (`<ul>`) | — | `gap-0.5` (0.125rem between items) |
| Nav link (l1) | `px-3 py-1` (0.75rem / 0.25rem) | — |
| Outline `<h3>` link | `pl-6 pr-3` (indented) | — |
| Nav link radius | `rounded-md` (0.375rem) | — |

---

## Letter spacing (tracking)

| Where | Value |
| --- | --- |
| Post title `<h1>` | `tracking-tight` = −0.025em |
| Sidebar section headings | `tracking-wider` = 0.05em |
| Everything else | normal (0) |

## Line spacing (leading)

| Where | Value |
| --- | --- |
| `.prose` body | **1.8** (most generous — long-form reading) |
| `.prose pre` code blocks | 1.6 |
| `text-4xl` title | 2.5rem (≈1.11) |
| `text-lg` description | 1.75rem (≈1.56) |
| `text-sm` / `text-xs` UI text | 1.25rem / 1rem (Tailwind defaults) |

---

## Color tokens at a glance

Palette is Tailwind **zinc** for neutrals + **blue** for links. Dark mode is driven
entirely by `prefers-color-scheme`.

| Token | Light | Dark |
| --- | --- | --- |
| Background | `#ffffff` | `#0a0a0a` |
| Foreground (body) | `#171717` | `#ededed` |
| Prose text | zinc-700 `#3f3f46` | zinc-300 `#d4d4d8` |
| Headings / strong | zinc-900 `#18181b` | zinc-50 `#fafafa` |
| Muted (dates, meta) | zinc-400/500 | zinc-500/400 |
| Links | blue-600 `#2563eb` | blue-400 `#60a5fa` |
| Code bg | zinc-100 `#f4f4f5` | zinc-800 `#27272a` |
| Pre block bg | zinc-900 `#18181b` | `#000000` |
| Borders / rules | zinc-200 `#e4e4e7` | zinc-800 `#27272a` |

---

## Radii

| Element | Radius |
| --- | --- |
| Nav links | `rounded-md` (0.375rem) |
| Inline code | 0.25rem |
| Pre blocks, images | 0.5rem |
