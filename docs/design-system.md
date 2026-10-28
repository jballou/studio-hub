# Design rules

Two rules, both checked by `npm run check:design` (also run it before a push).

## Spacing: multiples of 8px
Padding, margin and gap use Tailwind's even steps only: `2` (8px), `4` (16), `6` (24), `8` (32), `10` (40), `12` (48) and up, plus `0`.
Never use `0.5, 1, 1.5, 2.5, 3, 3.5, 5, 7, 9, 11` (4, 6, 10, 12, 14, 20, 28, 36, 44px) or arbitrary values like `p-[10px]`.
Sizes (`h-*`, `w-*`) are not spacing. Small controls get a fixed height (for example tags are `h-6`) instead of vertical padding.

## Type: the Project Catalyst scale (National 2)
Defined once in `app/globals.css` (`@theme`). Use the named sizes only, never `text-[13px]`.

| Class | Size / line | Figma style |
|---|---|---|
| `text-xs` | 12 / 20 | Label Small |
| `text-sm` | 14 / 24 | Label Medium, Body Extra Small |
| `text-base` | 16 / 24 | Label Large, Body Small |
| `text-lg` | 18 / 28 | Title Small, Body Medium |
| `text-xl` | 20 / 28 | Title Medium, Body Large |
| `text-2xl` | 24 / 32, -0.48 tracking | Title Large |
| `text-3xl` | 28 / 32 | Headline Small |
| `text-4xl` | 36 / 40, -0.72 | Headline Medium |
| `text-headline-lg` | 42 / 48, -0.84 | Headline Large |
| `text-5xl` | 48 / 48, -0.96 | Display Small |
| `text-display-md` / `text-display-lg` | 60 / 76 | Display Medium / Large |
| `eyebrow` | 14 / 24, 500, uppercase, 0.1em | Label Eyebrow Small |

Weights: titles and labels bold, body regular, eyebrows medium. Line-heights sit on a 4px grid and are tighter than the Figma frame's (which are tuned for marketing layouts).
