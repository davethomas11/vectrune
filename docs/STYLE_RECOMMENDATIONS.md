# Vectrune Style Recommendations

Proposed design direction following the [live UX review](UX_REVIEW.md), 12 November 2026. These are implementation targets; they do not describe changes already applied to the site.

Keep Vectrune's teal and warm neutral identity. Make the teaching interface quieter and more compact, with clear emphasis on the next action, readable explanations, and working code. Reserve the expressive arcade treatment for the games and music workspaces.

## Visual hierarchy

Use one dominant page title and one primary action in each decision area. The homepage should explain the language plainly, show a working example, and offer the next step. A suggested headline is “Build APIs and interactive web apps in readable .rune files”, with **Try in browser** as the primary action and **Install Vectrune** as secondary. Validate the wording with new learners.

Reduce the number of nested cards, badges, uppercase eyebrows, and repeated titles. A tutorial can be a readable document containing a practical workspace; every paragraph does not need its own elevated surface. Keep a larger decorative hero on the homepage and a compact title block on lessons and showcases.

[Current desktop homepage](reviews/vectrune-ux-2026-11-12/home-desktop.png) and [mobile homepage](reviews/vectrune-ux-2026-11-12/home-mobile.png) illustrate the starting point.

## Color system

Use semantic tokens consistently in [the Rune style definition](../teaching_website/parts/style.rune). The core palette already supports legible combinations; the main adjustment is stronger secondary navigation text and less decorative layering.

| Role | Proposed value | Usage |
| --- | --- | --- |
| Canvas | `#F3F7F4` | Page background |
| Surface | `#FFFFFF` | Main workspace and content panels |
| Subtle surface | `#EAF3EF` | Selected groups and restrained callouts |
| Primary ink | `#193A3F` | Titles and body text |
| Secondary ink | `#526C6C` | Supporting prose |
| Navigation label | `#52706F` | Small navigation group labels; replace `#6C8983` |
| Primary action | `#285F64` | Filled action with white text |
| Primary hover | `#173E44` | Hover and pressed emphasis |
| Link | `#285F64` | Underlined links within prose |
| Accent ink | `#A5432E` | Limited warm emphasis on pale warm backgrounds |
| Decorative border | `#D5E3DD` | Nonessential panel separation |
| Code surface | `#142F35` | Code and terminal panes |

Calculated opaque color pairs: primary ink on canvas is approximately 11.30:1; secondary ink on canvas 5.22:1; white on the primary action 7.21:1; proposed navigation labels on canvas 4.97:1. The current navigation label reaches only 3.79:1 on white. Validate the final composited surfaces, hover/disabled states, and every syntax token separately. These pair calculations are not a complete contrast audit.

Target at least 4.5:1 for normal text and 3:1 for large text under [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Keep the pale border for decorative separation; give essential control boundaries and focus indicators independently verified contrast. Do not communicate errors, selection, or success through color alone.

## Typography

Keep the existing system sans-serif stack; use a system monospace stack for code. Add another font only if a measured brand or readability benefit justifies its loading cost.

| Element | Desktop target | Mobile target | Treatment |
| --- | --- | --- | --- |
| Homepage title | 44–48 px | 30–34 px | 700 weight, 1.12 line height |
| Page title | 32–36 px | 26–30 px | 700 weight, 1.2 line height |
| Section title | 24–28 px | 22–24 px | 650–700 weight |
| Subsection title | 18–20 px | 18–20 px | 600–700 weight |
| Body | 16–18 px | 16 px | 1.55–1.65 line height |
| Navigation and controls | 14–16 px | 15–16 px | Sentence case, clear selected state |
| Supporting labels | 12–14 px | 12–14 px | Reserve uppercase for short, infrequent labels |
| Source code | 14–15 px | 14 px | 1.55–1.65 line height, preserved indentation |

Constrain explanatory prose to approximately 65–75 characters per line. Let code, demos, and reference grids use the wider workspace. Use one main page heading per teaching page, with the brand treated separately. Do not size typography by heading level alone: a document title and a small card title need distinct classes.

## Layout and spacing

Use a shared spacing scale of 4, 8, 12, 16, 24, 32, 48, and 64 px. Use 24–32 px panel padding on desktop and 16–20 px on mobile. Separate major document sections by 32–48 px, while keeping labels within 8 px of their controls.

| Region | Proposed behavior |
| --- | --- |
| Desktop shell | Approximately 72 px header; retain the current 232 px sidebar as a starting point; reading content centered within the workspace |
| Mobile shell | Approximately 56–64 px brand/menu row; concise notice above it; avoid a second full row of duplicated navigation |
| Development notice | Aim for one desktop line or two short mobile lines; show detailed compatibility information through a link |
| Documentation navigation | Group by task; keep the current section easy to locate; use a bounded panel on small screens |
| Long documents | Optional compact “On this page” navigation and previous/next lesson links |
| Showcase | Compact introduction followed immediately by the live preview |
| Attribution | Footer or other normal-flow placement; it must not overlay tasks |

Keep current responsive breakpoints initially and test their behavior before changing them. Use content-driven adjustments at 320, 390, 768, 1000, and 1440 px. At 390 × 844, require the primary action to be entirely visible with no overlay. If the desktop sidebar becomes sticky, bound it to the available viewport height and preserve keyboard access to its scrollable area.

## Surfaces and decoration

Use flat white surfaces and subtle borders for most teaching content. Limit the soft background gradient to the page or homepage hero. Remove inset highlights and blur from routine cards; reserve a soft shadow for menus and genuinely elevated controls. Keep radii consistent: about 8 px for controls, 12 px for ordinary panels, and 16–20 px for major workspaces. Reserve pill shapes for compact filters and status tags.

Keep one clear surface boundary around a workspace. Avoid a card inside a card inside another card for code, controls, and output. Use labeled regions and spacing to separate them. The dark code palette is useful; give code enough visual contrast without making every small syntax snippet a dominant block.

## Component recommendations

### Header and navigation

Use the brand, a clear documentation entry, and compact language access. Place translation contributions in the footer or localization page. Show the active route with background, weight, and `aria-current="page"`. Use links for route destinations. Supply a visible-on-focus skip link and restore focus after navigation.

Keep the mobile menu operable with one hand and through a keyboard. A drawer requires a clear Close action, Escape behavior, and correct focus handling; an inline accordion can be a simpler alternative. Choose one pattern consistently.

### Buttons and links

Use a solid teal primary button, a bordered secondary button, and quiet text actions. Describe outcomes: **Try in browser**, **Apply code**, **Send request**, **Copy file**, and **Download project**. Avoid several equally prominent filled buttons in the same region. Keep prose links underlined; pair icons with readable labels unless an explicit accessible name and familiar context suffice.

Use 44 × 44 px as the preferred minimum interaction area for primary controls. This is a product usability target: [WCAG 2.2 AA target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) specifies 24 × 24 CSS px with exceptions, while the enhanced criterion uses 44 × 44. Do not classify every smaller control as an automatic AA failure.

### Forms and feedback

Give search fields persistent visible labels; placeholders should provide examples rather than carry the label. Keep field labels, hints, and validation together. Use inline error messages that explain recovery without clearing the user's work. Express loading, success, empty, and failure states in text, with appropriate live-region behavior for asynchronous updates.

For copy, show “Copied” near the activated button. On failure, provide a selectable source fallback. For storage and export, state whether the result is browser-local, an individual file, song code, or a complete project.

### Sandbox

Label the stages **Source**, **Request**, and **Response**. Keep source and response side by side on a sufficiently wide screen, then stack them in task order on mobile. Give the response an obvious status and a concise first-use instruction. Place document/AST inspection under an advanced menu. Make Reset example visible without competing with the main action.

### Source explorer

Preserve the existing exact source and filter behavior. For large examples, use a 220–260 px folder/file list next to a flexible code pane on desktop; use a compact file selector above code on mobile. Show the full selected path in a toolbar with copy, download, and an optional wrap toggle. Say “4 of 15 files” rather than relying on an unexplained fraction.

Make the code pane keyboard-focusable, with visible scroll boundaries. Keep line numbers out of copied/downloaded text. Give file selection a stable URL if it will be shared. Keep download labels precise and expose a project archive separately from individual-file export. [Current filtered explorer](reviews/vectrune-ux-2026-11-12/source-explorer-filtered.png).

### Games and Rune Studio

Retain their neon, dark surfaces and playful identity inside the preview. Use the quieter documentation style outside it so the interactive work remains the focus. Put the preview early, followed by a short “Try this” instruction, then deeper implementation notes and source.

For Studio, make Play/Stop, the active voice, and Save/Export outcomes easy to distinguish before showing advanced editing options. Give repeated controls contextual accessible names such as “Mute bass” and “Delete E4 note in bar 2”. Keep a clearly labeled path into and out of fullscreen. Evaluate pause, sound, and keyboard behavior as part of the interaction design rather than relying only on screenshots.

## Motion and interaction states

Use short 120–180 ms transitions for opacity and color. Avoid moving the page or enlarging elements on hover where it disrupts reading. Respect `prefers-reduced-motion` for decorative transitions and smooth scrolling. Animated demos should expose the controls needed to stop their activity and remain understandable without animation.

Specify default, hover, focus-visible, pressed/selected, disabled, loading, success, and error appearances for shared controls. A 2–3 px high-contrast focus ring with a small offset is a useful starting point; verify it on both light and dark surfaces and ensure sticky UI does not obscure the focused element.

## Application order

Apply the shell, navigation text, attribution placement, and shared controls first. Then simplify the homepage and quickstart. Follow with lesson layouts, sandbox states, source browsing, and the demo wrappers. Keep these changes small enough to validate the corresponding [UX acceptance criteria](UX_REVIEW.md) as each area changes.

Before calling the styling complete, compare real page states at the target widths, test long French/Spanish labels, inspect code overflow and nested scrolling, and verify keyboard, contrast, zoom, and reduced-motion behavior. Record performance separately using controlled measurements; the walkthrough's network timing is not a Core Web Vitals benchmark.
