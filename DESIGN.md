# pwsh.ca design system

The whole idea in one line: **a console, dressed for daylight.** The page
itself is quiet — cool paper, blue-black ink, hairline rules. The only
saturated surface is the terminal in the hero, because that is the thing this
site is actually about. Everything else gets out of its way.

## Color

Semantic tokens, defined once in `src/styles.css` and flipped wholesale by
`:root[data-theme="dark"]`. Component rules never reference a raw hex.

| Token | Means |
| --- | --- |
| `--paper`, `--paper-raised`, `--paper-sunk` | the desk, objects on it, recesses in it |
| `--ink`, `--ink-muted`, `--ink-faint` | text, in three descending weights |
| `--rule`, `--rule-strong` | hairlines and input borders |
| `--accent`, `--accent-ink`, `--accent-wash` | the shell's blue: edges, text-safe blue, tint |
| `--console-*` | the terminal's own palette |
| `--live`, `--danger` | state only, never decoration |

Two rules that matter:

1. **`--accent` is for edges and marks; `--accent-ink` is the only blue that
   may be printed as text.** The raw accent does not clear 4.5:1 on paper.
2. **The console does not flip with the theme.** A terminal is dark in both
   rooms; only its lift off the ground changes.

`--ink-faint` is the contrast floor (4.8:1 on paper). Nothing goes below it.

## Type

Three faces, each with one job: **Bricolage Grotesque** for display and
headings, **Atkinson Hyperlegible Next** for body, **Commit Mono** for code,
codes, and anything that is literally shell text.

The ramp lives in `:root` and every `font-size` names a step —
`--text-display`, `--text-headline`, `--text-brand`, `--text-title`,
`--text-lede`, `--text-body`, `--text-small`, `--text-code`, `--text-label`,
`--text-micro`, `--text-stamp`. Literals off the ladder are how a type system
quietly rots; there are none in this file.

`--text-stamp` (0.6875rem) is the floor, reserved for uppercase, tracked-out
labels only.

## Space

One ladder: 4, 8, 12, 16, 24, 40, 72 (`--space-xs` … `--space-xxl`). Radii:
6 / 10 / 14 / pill.

## Depth

Three paper values and hairline rules do the work. There are exactly two
shadows on the site: the focus ring, and the console's own lift. Nothing else
casts.

## Motion

Two animations, both meaningful: the prompt caret blinks (it is a caret) and
the loading dot pulses (something is happening). Both are switched off under
`prefers-reduced-motion`. Hover transitions are 0.15s on color and border
only — never on layout.

## Accessibility

Real form controls, always: the theme switcher is three radio inputs behind
styled labels, so grouping, arrow-key navigation, and checked state come from
the browser rather than hand-rolled ARIA. Focus is a 2px accent ring at a
2px offset, visible on every interactive element in both themes.
