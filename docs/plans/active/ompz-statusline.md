# ompz statusline preset

Port of the `slim.sh` Claude Code statusline into omp's native segment
pipeline, shipped as a new preset `ompz` and made the fork's default.

Target render (idle):

```
✦ Opus 5 · high · ━━━───── 47% · ϟ 2.2k tpm · ⌥ feat/pre-improve-facility-sync
```

Working (agent mid-turn — `pi` keeps its braille spinner + turn timer):

```
⠋ 45s · Opus 5 · high · ━━━───── 47% · ϟ 2.2k tpm · ⌥ feat/…
```

## Locked decisions

- **Preset, not fork of `default`**: additive preset `ompz`; users who picked
  `default`/`compact` keep them. `statusLine.preset` default → `"ompz"`.
- **Composer unchanged**: `composer.shape` stays `band`. Preset carries
  `transparent` + `separator: "dot"` + `contextLine: "off"` so the look is
  self-contained on band/box too; bottom-bar composers (`pi`, `borderless`,
  `field`, `rail`) get pixel-closest slim parity for free (plain layouts already
  use `·` + transparent + space gap).
- **`pi` stays**: idle icon `✦` (new `pi.icon` option), working = spinner+timer.
- **Effort**: fixed magenta `35` like slim, via new `model.thinkingColor`
  option; omitting it falls back to per-level thinking colors.
- **TPM**: `token_rate.unit: "tpm"` = `tokensPerSecond * 60` (live recent rate,
  consistent with the existing segment — not slim's lifetime average).
- **Bar thresholds**: omp's `getContextUsageLevel` (50/70/90 + token floors,
  purple band), not slim's hard 50/75.
- **Colors**: new per-segment `color`/`iconColor`/`valueColor`/`thinkingColor`
  options accepting `ColorValue` (256 index or `#hex`; `fgAnsi()` already
  handles both). Preset bakes the slim palette; theme-role values stay possible
  for anyone who wants theme-adaptive.

## Slim palette → preset segmentOptions

| Element            | Slim ANSI            | Option                              |
| ------------------ | -------------------- | ----------------------------------- |
| `✦` + model name   | `38;5;208`           | `pi.icon:"✦"`, `model.color: 208`   |
| effort `high`      | `35`                 | `model.thinkingColor: 35`           |
| `━━━───── 47%`     | 247 / 93@≥50 / 91@≥75| context level colors (omp defaults) |
| `ϟ`                | `93`                 | `token_rate.icon:"ϟ"`, `iconColor:93`|
| `2.2k tpm`         | `247`                | `token_rate.valueColor: 247`        |
| `⌥ branch`         | `36`                 | `git.icon:"⌥"`, `git.color: 36`     |
| ` · `              | default fg           | separator `"dot"`                   |

`pi` keeps the dim→accent brand tween (accent `#febc38` is already amber;
working pulse matters more than exact-208 idle).

## Changes

**`packages/tui/src/status-line/schema.ts`**
- `STATUS_LINE_SEGMENT_IDS` += `"context_bar"`
- `STATUS_LINE_SEPARATOR_VALUES` += `"dot"`
- `STATUS_LINE_PRESET_VALUES` += `"ompz"`

**`separators.ts`** — `case "dot"` → `{ left: "·", right: "·" }` (same glyph the
plain layouts hardcode).

**`types.ts`**
- `StatusLineSegmentOptions` additions:
  - `pi?: { icon?: string }` — idle brand glyph override.
  - `model?: { icon?: string; thinkingStyle?: "icon" | "text"; thinkingColor?: ColorValue }`
    — `icon:""` hides the `⬢`; `"text"` strips the thinking glyph (`◉ high` → `high`).
  - `context_bar?: { width?: number; color?: ColorValue }` — `color` pins all
    levels; unset → `getContextUsageThemeColor`.
  - `token_rate?: { unit?: "tps" | "tpm"; icon?: string; iconColor?: ColorValue; valueColor?: ColorValue }`
  - `git?: { icon?: string; color?: ColorValue }` — `color` pins branch color
    (skips clean/dirty swap when set).
  - Shared color resolution helper: `ColorValue | ThemeColor` → ANSI via
    `isValidThemeColor` + `theme.fg` else `fgAnsi`.
- `PresetDef` += optional `transparent?`, `compactThinkingLevel?`,
  `contextLine?`, `sessionAccent?` — merged as defaults in
  `#computeEffectiveSettings` (explicit settings still win).

**`segments.ts`**
- `contextBarSegment` (`id: "context_bar"`): `width` (default 8) cells of
  `━`/`─`, `filled = floor(pct·w/100)` clamped, then ` {Math.round(pct)}%`.
  `contextPercent === null` → `──────── ?%` dimmed. Honors
  `startupPlaceholder` → `…`.
- `tokenRateSegment`: `unit:"tpm"` → `tps*60`, slim formatting
  (`≥10k` → `Nk`, `≥1k` → `N.Nk`, else int) + ` tpm` suffix.
- `modelSegment`: `icon`/`thinkingStyle`/`thinkingColor` handling.
- `piSegment`: `icon` override for the idle glyph.
- `gitSegment`: `icon`/`color` overrides; detached HEAD falls back to short sha
  (branch resolution already in component — extend if cheap, else follow-up).
- Registry `SEGMENTS` += `context_bar`.

**`presets.ts`**

```ts
ompz: {
    leftSegments: ["pi", "model", "context_bar", "token_rate", "git"],
    rightSegments: [],
    separator: "dot",
    transparent: true,
    contextLine: "off",
    compactThinkingLevel: false,
    sessionAccent: false,
    segmentOptions: {
        pi: { icon: "✦" },
        model: { icon: "", thinkingStyle: "text", thinkingColor: 35, color: 208 },
        context_bar: { width: 8 },
        token_rate: { unit: "tpm", icon: "ϟ", iconColor: 93, valueColor: 247 },
        git: { icon: "⌥", color: 36, showStaged: false, showUnstaged: false, showUntracked: false },
    },
},
```

**`component.ts`** — merge new PresetDef fields in `#computeEffectiveSettings`.

**`packages/coding-agent/src/config/settings-schema.ts`**
- `statusLine.preset`: enum option `{ value: "ompz", label: "ompz", description: "Slim single-line: model · effort · context bar · tpm · branch" }`; **default → `"ompz"`**.
- `statusLine.separator`: enum option `{ value: "dot", label: "Dot", description: "Middle-dot separators" }`.

**Gallery** — `context_bar` variants in `gallery-fixtures/segments.ts`
(normal/warning/error) auto-surface via `ALL_SEGMENT_IDS`; optional
`ompz_statusline` fixture rendering the full preset like `status-line.ts` does
for the gauge.

## Tests

- `packages/tui/test/status-line-context-bar.test.ts` — fill math, clamping,
  null-percent, color levels, `color` pin, width option, placeholder.
- `packages/tui/test/status-line-token-rate.test.ts` — tpm conversion,
  `Nk`/`N.Nk`/raw formatting, icon/color overrides.
- Extend `status-line-model.test.ts` — `thinkingStyle:"text"`, `icon:""`,
  `thinkingColor`.
- Preset test: `ompz` resolves expected segments/options; `"dot"` separator
  resolves.
- `cd packages/tui && bun test` (follow existing runner convention).

## Edge cases / non-goals

- Detached HEAD → short-sha fallback only if branch resolve exposes it cheaply.
- `context_bar` never joins the `contextLine` embedded gauge (different id;
  embed check only matches `context_pct`/`context_total`).
- No `statusline.sh`-style external script — this is native, not a subprocess.
- No changes to `default` preset contents or `composer.shape` default.
