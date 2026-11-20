---
name: Brand Creative Hub
description: A calm, paper-like workspace where the brand team's work carries the color, built on the SurveyMonkey brand palette and National 2.
colors:
  primary: "#08794a"
  primary-deep: "#105638"
  primary-fill: "#089b5e"
  primary-soft: "#d6f5de"
  link: "#08794a"
  ink: "#0f2e21"
  paper: "#f7f5f3"
  shell: "#ebe8e3"
  card: "#ffffff"
  surface: "#fefdfb"
  neutral-50: "#fefdfb"
  neutral-100: "#f7f5f3"
  neutral-150: "#edebe8"
  neutral-200: "#e2dfda"
  neutral-500: "#908d89"
  neutral-650: "#686764"
  neutral-700: "#5b5a57"
  neutral-800: "#464543"
  neutral-1000: "#1a1919"
  focus: "#5568bf"
  info-surface: "#ededfd"
  info-border: "#c5ccf9"
  info-text: "#3f4d94"
  progress-surface: "#d9f0f2"
  progress-border: "#a6dce1"
  progress-text: "#255b60"
  warn-surface: "#f9e8d2"
  warn-border: "#f2d0a3"
  warn-text: "#854813"
  ok-surface: "#d6f5de"
  ok-border: "#b0e8c3"
  ok-text: "#0f2e21"
  bad-surface: "#f7dbd4"
  bad-border: "#eab0a9"
  bad-text: "#8a3734"
  gold-surface: "#f9f2d2"
  gold-border: "#f2e2a6"
  gold-text: "#7c6403"
typography:
  display:
    fontFamily: "National 2, system-ui, sans-serif"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: "48px"
    letterSpacing: "-0.96px"
  headline:
    fontFamily: "National 2, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "32px"
    letterSpacing: "0"
  title:
    fontFamily: "National 2, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "28px"
    letterSpacing: "0"
  title-sm:
    fontFamily: "National 2, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: "28px"
    letterSpacing: "0"
  body-lg:
    fontFamily: "National 2, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "0"
  body:
    fontFamily: "National 2, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "0"
  label:
    fontFamily: "National 2, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "20px"
    letterSpacing: "0"
  eyebrow:
    fontFamily: "National 2, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "24px"
    letterSpacing: "0.1em"
rounded:
  tight: "8px"
  loose: "24px"
  round: "9999px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "32px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-50}"
    typography: "{typography.body}"
    rounded: "{rounded.tight}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.tight}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.neutral-150}"
  button-ghost:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.tight}"
    padding: "0 16px"
    height: "40px"
  chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.round}"
    padding: "0 16px"
    height: "32px"
  chip-selected:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.ink}"
  segmented-control:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.round}"
    height: "32px"
  segmented-control-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-50}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.loose}"
    padding: "16px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.tight}"
    padding: "0 16px"
    height: "40px"
  tag:
    backgroundColor: "{colors.neutral-150}"
    textColor: "{colors.neutral-800}"
    typography: "{typography.label}"
    rounded: "{rounded.round}"
    padding: "0 8px"
    height: "24px"
  tag-ok:
    backgroundColor: "{colors.ok-surface}"
    textColor: "{colors.ok-text}"
  tag-warn:
    backgroundColor: "{colors.warn-surface}"
    textColor: "{colors.warn-text}"
  tag-bad:
    backgroundColor: "{colors.bad-surface}"
    textColor: "{colors.bad-text}"
  nav-item:
    textColor: "{colors.neutral-800}"
    typography: "{typography.body}"
    rounded: "{rounded.tight}"
    padding: "8px 16px"
  nav-item-active:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
---

# Design System: Brand Creative Hub

## Overview

**Creative North Star: "The Studio Desk"**

The Hub is the desk the brand team works at: warm paper under a soft dot grid, white cards laid on it, and one confident green for the things you can act on. Nothing competes with the work itself. Photos, logos and designs carry the color; the interface stays quiet, legible and precise. Brand lives in the details: National 2 type, the SurveyMonkey palette used by its exact values, and three corner shapes used everywhere.

The system is an operating tool, not a marketing page. It is dense where people scan lists (projects, reviews, calendars) and spacious where they read or decide (a brief, a comment thread). Surfaces are flat and hairline-bordered until something is clickable, then they lift slightly. Status is always icon plus label plus tint, never color alone. A dark theme swaps the same tokens, so a screen built from the tokens works in both.

This file is meant to travel. Build a new app or dashboard from the frontmatter tokens and the component rules below, or bring an existing tool in line by replacing its colors, type, corners and spacing with these values.

**Key Characteristics:**
- Warm paper (#f7f5f3) over a darker shell (#ebe8e3), with white cards on the paper.
- One accent, Green 600 (#08794a), for actions; Green 500 (#089b5e) only for graphics and large fills.
- National 2 only: 400 regular, 500 medium, 700 bold. Roles are carried by size and weight, never by a second typeface.
- Three corner shapes (8px, 24px, pill) and an 8px spacing grid, enforced by a script in the repo.
- Status uses six tinted families, each with a surface, a border and a text tone, always with an icon and a label.
- Full-width pages with a single content column; the sidebar is a drawer on phones.

## Colors

A warm neutral ground, a single deep green for action, and six muted tints that carry status. Every value comes from the SurveyMonkey brand palette; no hex values live outside the token file.

### Primary
- **Interaction Green** (#08794a, Green 600): the action color. Solid buttons, the selected segment, selected-chip borders, badges that carry white text, and (as the link color) green text on light surfaces. It passes 5.4:1 under off-white text.
- **Pressed Green** (#105638, Green 700): hover and pressed state of the primary button; avatar fills.
- **Brand Green** (#089b5e, Green 500): the brand swatch itself. Use it for icons, charts, large fills and graphics only. Under white text it is 3.5:1 and fails.
- **Mint Wash** (#d6f5de, Green 100): selected-chip and soft-highlight surfaces.

### Secondary
- **Focus Periwinkle** (#5568bf, Periwinkle 600): the keyboard focus ring and informational accents. In dark mode it lightens to #93a0f2.

### Neutral
- **Deep Moss Ink** (#0f2e21, Green 900): primary text. A near-black green, not gray.
- **Studio Paper** (#f7f5f3, Neutral 100): the page surface.
- **Shell Stone** (#ebe8e3): the outer frame behind the paper and sidebar.
- **Card White** (#ffffff) and **Soft Surface** (#fefdfb, Neutral 50): cards, controls, popovers.
- **Hairline** (#e2dfda, Neutral 200): dividers and card borders. **Control Outline** (#908d89, Neutral 500): the lightest allowed outline for interactive controls.
- **Secondary Text** (#5b5a57, Neutral 700) and **Quiet Text** (#686764, Neutral 650, used for placeholders): both pass 4.5:1 on white.

### Status tints
Each family is a surface, a border and a text tone. Text on the surface always passes 4.5:1.
- **Info** (Periwinkle): #ededfd / #c5ccf9 / #3f4d94 for notices and review states.
- **Progress** (Teal): #d9f0f2 / #a6dce1 / #255b60 for work in progress.
- **Warning** (Orange): #f9e8d2 / #f2d0a3 / #854813 for action required and at-risk.
- **OK** (Green): #d6f5de / #b0e8c3 / #0f2e21 for delivered and approved.
- **Bad** (Red): #f7dbd4 / #eab0a9 / #8a3734 for blocked, overdue and errors.
- **Gold** (Yellow): #f9f2d2 / #f2e2a6 / #7c6403 for starred and highlighted items.

### Dark theme
The same token names swap values. Paper becomes #111714, the shell #0b100d, cards #1a221e, ink #e8efe9, and links #3fd08f. Status surfaces become deep tints (for example bad is #3e201d with #f3aaa3 text). Choose tokens, never literal hexes, so both themes work.

### Named Rules
**The Green-For-Action Rule.** Anything that carries white text on green uses Green 600 or darker. Green 500 never sits under text. Green text on light surfaces uses the link green (#08794a); in dark mode it becomes #3fd08f.
**The Tokens-Only Rule.** No literal hex in components. Components read the named tokens, so a theme change is one file.
**The Icon-And-Label Rule.** A status is a tinted pill with an icon and a word. Color alone never says what state something is in.

## Typography

**Display, headline, title and body font:** National 2 (with system-ui, sans-serif fallback)
**Label font:** National 2, same family

**Character:** One humanist sans in three weights, used with tight, confident headings and an easy 14px working size. Hierarchy comes from size and weight steps, with generous contrast between a bold title and regular body text.

### Hierarchy
- **Display** (700, 48px, 48px line, -0.96px tracking): the greeting on My Day and hero numbers at desktop width. Rare.
- **Headline** (700, 28px, 32px): large panel titles.
- **Title** (700, 20px, 28px): page titles in the top bar and section headings.
- **Title Small** (700, 18px, 28px): card and panel titles.
- **Body Large** (400, 16px, 24px): reading text, briefs and descriptions. Keep to 65 to 75 characters per line.
- **Body** (400, 14px, 24px): the default size for lists, controls, tables and forms.
- **Label** (500, 12px, 20px): tags, chips, helper text and metadata.
- **Eyebrow** (500, 14px, 24px, +0.1em, uppercase): labels for groups of items: sidebar groups (Workspace, Brand Assets, Favorites), menu sections, and list headings such as "Open (3)". It is the brand's own Label Eyebrow style; never use it as decoration above a page title or hero.

Available steps are 12, 14, 16, 18, 20, 24, 28, 36, 42, 48, 60 and 76 px. No other font size is allowed.

### Named Rules
**The One Scale Rule.** Use only the sizes above. Weights are 400, 500 and 700 (a 600 maps to bold; there is no semibold file).
**The Balanced-Heading Rule.** Headings use balanced wrapping and paragraphs use pretty wrapping, so no word is left alone on a last line.

## Layout

A full-width, single-column page inside a framed shell. The shell is inset 8px from the window edge, with a persistent sidebar (256px, 64px when collapsed) beside it. A 64px top bar holds the page title and the New project button; every page sits in the same column with 16px side padding, 32px from 768px up. There is no maximum width: wide dashboards use the space, and card grids scale by minimum width (`repeat(auto-fill, minmax(Nrem, 1fr))`). Narrow reading pages cap their inner content at 48rem.

Spacing is an 8px grid: 8, 16, 24, 32, 48. Tight groups sit at 8; related blocks at 16; sections at 24 to 32. More space goes above a heading than below it.

Breakpoints: 768px (the layout step; below it the sidebar becomes a drawer opened from the top bar and content is single column), 1280px (two-column pages such as My Day), and 1700px (a three-column step for the widest dashboards).

On phones: the sidebar is a drawer over a dimmed page, controls grow to 44px on touch screens, lone text links get a 44px target, and nested rows indent half as far. The page background is a 16px dot grid in a barely-there tone, which gives the paper its texture.

### Named Rules
**The 8px Grid Rule.** Margins, padding and gaps are multiples of 8px. A script in the repo (`check:design`) fails the build on anything else.
**The 44px Touch Rule.** On coarse pointers, every control is at least 44px tall.

## Elevation & Depth

Depth is quiet and mostly tonal: paper under cards, cards under floating panels. Cards carry a hairline border and a faint, wide shadow. Clickable cards lift one pixel and brighten their border on hover. Popovers and dialogs use the heavier standard shadows. Nothing glows, and there are no colored shadows.

### Shadow Vocabulary
- **Card at rest** (`box-shadow: 0 1px 2px rgb(30 40 35 / 0.04), 0 8px 24px -12px rgb(30 40 35 / 0.12)`): every `.card`.
- **Card hover** (`box-shadow: 0 2px 4px rgb(30 40 35 / 0.06), 0 16px 32px -12px rgb(30 40 35 / 0.18)` with a 1px upward move and a green border): only on clickable cards.
- **Small, medium, large, extra-large** (the standard small, medium, large and extra-large shadows): small for resting tiles, medium for the comment dock, large and extra-large for dropdowns, dialogs and the sidebar drawer.

### Named Rules
**The Flat-Until-Touched Rule.** A card gets its lift on hover only if clicking it does something. Static cards stay still.
**The No-Nesting Rule.** A card never contains another bordered card. Use spacing, dividers or a tinted row (Neutral 100, no border) inside a card.

## Shapes

Three corner shapes and no others. **Tight (8px)** for buttons, inputs, menus and table wrappers. **Loose (24px)** for cards, panels, dialogs and the app shell. **Round (pill)** for chips, tags, segmented controls, badges and avatars. Borders are 1px hairlines; the only thicker line is the 2px focus ring. Icons are Lucide-style outlines at 2px stroke with rounded caps, sized 12 to 20px, always inline SVG using the current text color.

### Named Rules
**The Three Corners Rule.** Use `tight`, `loose` or `round`. No other radius, and no `rounded-[…]` values except the logo.

## Components

### Buttons
Quiet and confident: 8px corners, medium weight, no shadow. Three sizes: small (32px, 12px text), medium (40px, 14px text, the default) and large (48px, 16px bold, the one big action on a screen). Icon-only buttons are 32px square (40px large).
- **Primary:** solid Interaction Green with off-white text; hover is Pressed Green. One primary per area.
- **Secondary:** white fill, 1px Control Outline, ink text; hover is a Neutral 150 wash.
- **Danger:** secondary with a red border and red text.
- **Ghost:** no frame; hover is the same neutral wash.
- **Disabled:** 40% opacity.

### Chips and segmented controls
- **Chip:** a 32px pill with a Control Outline; selected adds a green border and the Mint Wash fill. Use for filters and wizard answers (a 40px size exists for answers).
- **Segmented control:** a pill group of exclusive choices (views, ranges). The selected item gets a green highlight that slides to the choice, with off-white text. Reduced-motion users get the highlight without the slide.

### Cards and tiles
Loose 24px corners, 1px hairline border, the card shadow, 16 to 24px padding. A stat tile has a bold label, a large number and a small note, and is a button with a lift when it opens a list. Never nest a bordered card inside one.

### Inputs and fields
8px corners, 1px Control Outline, white fill, 14px text, 40px tall. Placeholders use Quiet Text (#686764) and still pass contrast. Native selects get a drawn chevron 16px from the right edge. A field built from a bordered wrapper around a borderless input shows the 2px focus ring on the wrapper when the input has keyboard focus.

### Tags and callouts
A tag is a 24px pill with a tinted surface, a matching 1px border, tinted text, and a 12px leading icon. A callout is the same idea at full width: tinted surface, icon and text, 24px corners. Always icon plus label.

### Navigation
A 256px sidebar on a transparent shell, collapsing to a 64px icon rail; on phones a drawer. Items are 8px-radius rows with an 18px icon; the active item is a white pill with a hairline shadow, and hover is a soft white wash. Groups (Workspace, Brand Assets, Favorites) are collapsible with an eyebrow label and a chevron, and the choice is remembered. The page title lives in the 64px top bar beside the New project button, and a menu button appears there under 768px.

### Dialogs and popovers
Loose 24px corners, hairline border, white fill, large shadow, dimmed backdrop. Escape closes them. The page behind stops scrolling while a modal dialog is open.

### My Day flip board (signature)
A dark, physical-feeling grid of small tiles that flips to spell a greeting and live counts, always in the same dark colors in light and dark mode, drawn only with brand palette steps. It pauses on request and respects reduced motion. Treat it as a one-off signature, not a pattern to reuse.

## Do's and Don'ts

### Do:
- **Do** build from the frontmatter tokens (`primary`, `ink`, `paper`, `card`, the status families) and the three corners.
- **Do** use Green 600 (#08794a) for anything solid green that holds text; keep Green 500 (#089b5e) for graphics and the brand swatch.
- **Do** show status as a pill with an icon and a word, in one of the six tint families.
- **Do** keep every margin, padding and gap on the 8px grid, and every font size on the scale.
- **Do** use `tap`-sized (44px) controls on touch screens and keep a visible 2px focus ring on every interactive element.
- **Do** write controls that name their action ("Save", "Download WebP"), and errors that name the problem and the next step.
- **Do** support both themes by reading tokens, and test a new screen at 390px and at full width.

### Don't:
- **Don't** nest a bordered card inside a card.
- **Don't** use another typeface, a font size off the scale, or a radius other than 8px, 24px or pill.
- **Don't** put white text on Green 500, or leave placeholder text lighter than #686764.
- **Don't** use color alone for status, and don't use gradient text, glows or colored shadows.
- **Don't** use the eyebrow style as decoration above a page title or hero; it labels groups of items only.
- **Don't** hard-code hex values in components, or add a second accent color.
- **Don't** hide core functions on phones; adapt the layout instead.
