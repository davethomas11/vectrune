# Vectrune UX Review

Reviewed 12 November 2026. Site: [vectrune.com](https://vectrune.com/). Companion: [Style recommendations](STYLE_RECOMMENDATIONS.md).

Vectrune has a recognizable visual identity and useful working examples. The largest opportunity is to make the first successful interaction easier to reach, understand, and repeat. Repair language routing and navigation behavior first, then simplify the mobile shell and onboarding. Preserve the teal palette, readable source, and real compiled previews.

## Review scope and evidence

This is an expert walkthrough of the live site in Chromium, covering the homepage, quickstart, REST GET tutorial, Rune-Web components lesson, builtin reference, VectRaiders, VectWorms, Rune Studio, and language switching. Layout checks used 1440 × 1000, 390 × 844, 320 × 640, and a 720 × 500 reflow viewport. Interactions included keyboard entry, section navigation, sandbox Run and Send Request, reference filtering, and source filtering.

Findings below distinguish observed behavior from proposed designs. They are not conversion measurements or a complete accessibility certification. Clean-machine installation, screen readers, Safari/Firefox, audio quality, and controlled performance benchmarks remain validation work. The 720 px check is a reflow spot check, not a browser zoom audit.

[Recorded measurements and reproduction evidence](reviews/vectrune-ux-2026-11-12/evidence.json) accompany the screenshots. Repository implementation references use the source present at commit `94a21a8`.

## What to preserve

- The warm light surfaces, deep teal text, and dark code panels give the site a coherent identity.
- The English pages checked fit the viewport without horizontal page overflow, including the 320 px homepage.
- The live source explorer now exposes five files for each game and all 15 Rune Studio files. Formatting, filtering, copy/download affordances, and a visible focus ring provide a useful foundation. This review does not classify the earlier source defect as still open.
- The API sandbox returned a visible `Status: 200`, log output, and `"OK"` after Run followed by Send Request.
- The builtin reference already has category filtering, a no-results message, and Reset filters. Improve these existing patterns rather than replacing them.

## Priorities

P0 blocks a primary journey for an affected audience. P1 materially impairs onboarding or navigation. P2 improves clarity and efficiency. P3 is an expansion to validate after the fundamentals work. Effort is relative: S is a contained change, M spans components or runtime behavior, and L introduces a new interaction or packaging capability.

| ID | Priority | Improvement | Effort |
| --- | --- | --- | --- |
| UX01 | P0 | Repair French and Spanish entry routes | M |
| UX02 | P1 | Make the install-to-first-response path self-contained | M |
| UX03 | P1 | Reset route scroll and move focus predictably | M |
| UX04 | P1 | Reduce the mobile header and remove badge obstruction | M |
| UX05 | P1 | Serve shareable lesson and locale routes successfully | M |
| UX06 | P1 | Improve keyboard access, navigation semantics, and contrast | M |
| UX07 | P2 | Put a working interaction before the feature catalogue | M |
| UX08 | P2 | Explain the sandbox lifecycle and simplify its first use | S–M |
| UX09 | P2 | Evolve source browsing into project navigation | L |
| UX10 | P2 | Organize documentation around learning journeys | M |
| UX11 | P2 | Align tutorial instructions with the current demo controls | S |
| UX12 | P3 | Add cross-site search after fixing route and content foundations | L |

## Findings and acceptance criteria

### UX01 Repair language entry routes

**Observed:** Opening [French](https://vectrune.com/fr/) changes the address to `/fr/fr` and leaves `main.content-area` empty. [Spanish](https://vectrune.com/es/) similarly becomes `/es/es`. Clicking Français from Rune Studio also ends at the empty `/fr/fr` route. The translated shell remains visible, making the missing page look like unfinished content. [Screenshot](reviews/vectrune-ux-2026-11-12/home-fr-mobile.png).

Treat the locale prefix separately from the page route, with an empty page segment resolving to the locale homepage. Preserve the current destination when changing languages where a translation exists. An unknown route needs a useful recovery page rather than an empty main region.

**Done when:** `/`, `/fr/`, and `/es/` each render home content after direct entry and refresh; language switching from Studio or a lesson preserves the destination; Back and Forward work; invalid paths offer a link to the appropriate language homepage. Test deployed URLs as well as locally rendered locale HTML.

**Implementation:** [Navigator](../runtime/rune-web/src/navigator.ts), [language selector](../teaching_website/parts/components/language-selector.rune), and [Pages workflow](../.github/workflows/pages.yml). The navigator currently treats a single path segment such as `fr` as a route; investigate this as the likely cause of the duplicated locale path.

### UX02 Make the quickstart self-contained

**Observed:** The quickstart presents three installation routes, then asks the reader to run `vectrune examples/app.rune`. It does not explain how a release or Homebrew user obtains that example file. The source-install card begins with `cargo install --path .` without first establishing a checkout. These are missing prerequisites in the displayed journey; a clean-machine install was not executed during this review.

Offer two explicit paths: **Try in browser** and **Run locally**. For local setup, show one selected platform at a time, installation prerequisites, the complete creation or download of `app.rune`, its run command, and the expected response. Keep building from a checkout under an advanced disclosure. Add copy buttons to installation and request commands.

**Done when:** A new macOS, Windows, or Linux user can follow only the displayed instructions from an empty working folder to a successful request. Commands state their working directory, local filenames exist before use, and the expected terminal and HTTP results appear beside the relevant steps.

**Implementation:** [Quickstart](../teaching_website/parts/components/header.rune), [English copy](../teaching_website/parts/i18n/en_us.rune), and corresponding translations.

### UX03 Restore orientation after navigation

**Observed:** After using Quickstart, a real sidebar click on GET Requests retained `scrollY = 529`. The destination heading was approximately 288 px above the viewport, and focus was on the body. Other section changes also retained an old scroll position. [Screenshot](reviews/vectrune-ux-2026-11-12/navigation-scroll-retained.png).

On a new route, render the destination, position its title below the header, and move programmatic focus to the main heading. For an explicit in-page anchor, honor the anchor. Back and Forward should restore the reader's previous position rather than always force the top. Replacing the DOM should not silently discard keyboard orientation.

**Done when:** Mouse and keyboard navigation from the middle of one page reveal the next page's title; screen reader navigation receives a meaningful heading or page announcement; anchor links and history restoration retain their distinct behaviors. Test both cached and lazy-loaded routes.

**Implementation:** [Navigation actions](../teaching_website/parts/logic.rune), [navigator](../runtime/rune-web/src/navigator.ts), and [event handling](../runtime/rune-web/src/events.ts).

### UX04 Give mobile content the first screen

**Observed at 390 × 844:** The development banner occupies about 112 px, the header 323 px, and the documentation toggle 52 px. Together they consume about 487 px, or 58% of the viewport, before the content area. The primary hero button begins around y = 796. The fixed badge spans x = 239–374 and y = 784–828, intersecting that button. Opening documentation adds an approximately 817 px inline navigation section. [Screenshot](reviews/vectrune-ux-2026-11-12/home-mobile.png).

Use a compact brand/menu header, a concise development notice, and one navigation entry point. Move translation contribution links to the localization page or footer. Put the Rune-Web attribution in normal flow. Group mobile navigation into collapsible sections and make close/back behavior obvious.

**Done when:** At 390 × 844 the main promise and complete primary action are visible without scrolling; no fixed element intersects controls at 320, 390, or 768 px; opening navigation exposes the current page and a clear way to close it. A modal drawer, if chosen, must support Escape, focus containment, and focus return.

**Implementation:** [Header](../teaching_website/parts/components/header.rune), [layout](../teaching_website/parts/components/layout.rune), [attribution](../teaching_website/parts/components/built-with.rune), and [responsive styles](../teaching_website/parts/style.rune).

### UX05 Make shared URLs dependable

**Observed:** Direct requests to `/web_components`, `/fr/studio`, and `/es/studio` returned HTTP 404 even though the fallback runtime subsequently displayed content. `/studio` returned 200. The lesson title also used the fallback name “Web_components” instead of its reader-facing title. This affects the reliability of links shared outside the running app; crawler and preview effects should be verified separately.

Generate the public routes for each supported locale, or use hosting that serves valid application routes with a successful status. Give lessons explicit titles and metadata. Keep aliases canonical and give genuinely missing destinations a real not-found experience.

**Done when:** A route inventory test confirms 200 responses and the correct language, title, and main content for every supported public route. Refresh and pasted links work without first visiting the homepage. Unknown routes remain distinguishable from valid pages.

**Implementation:** [Pages workflow](../.github/workflows/pages.yml), [SEO definitions](../teaching_website/parts/seo.rune), and [navigator](../runtime/rune-web/src/navigator.ts).

### UX06 Make navigation accessible and easier to read

**Observed:** The sidebar contains 22 route buttons, without `aria-current`. The first 16 Tab presses reached only the header and the first few navigation entries; no skip link was present. The builtin search has a placeholder but no visible label or explicit label association. Sidebar group headings compute to 10.88 px and `#6c8983`; this color has only 3.79:1 contrast even against white, below the normal-text 4.5:1 threshold. See the [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Use real links for destinations, retain enhancement for in-app routing, identify the current route semantically, and provide a first-focusable “Skip to content” link. Make the page title the main content heading; the site brand should not substitute for each lesson's title. Add a persistent builtin search label. Increase small navigation labels and darken them.

**Done when:** Skip to content reaches a focusable main region; routes support normal link actions such as opening a new tab; the active destination is announced; search remains labeled after text entry; normal text reaches 4.5:1 against its rendered surface; keyboard focus remains visible. Include iframe controls such as directional arrows and repeated mute buttons in the accessible-name pass. [W3C bypass-blocks guidance](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html).

### UX07 Demonstrate value sooner

**Observed:** At 1440 × 1000, the Studio and VectRaiders previews begin around y = 1215, and VectWorms around y = 1189. Feature descriptions, instructions, and a repeated preview heading come first. Studio's first viewport contains no workstation controls. The homepage is roughly 6226 px tall on desktop and 11653 px at 390 px width. [Studio screenshot](reviews/vectrune-ux-2026-11-12/studio-top.png).

Use the order **title and short promise → live example → one suggested action → explanation → source → next step**. On the homepage, demonstrate a small editable response near the top, then offer installation. Keep the richer descriptions available below the interaction. These are hypotheses about discovery and learning efficiency, to validate with new users.

**Done when:** A working demo or a clear action to open it appears in the first viewport of a desktop showcase. On mobile, it follows the short introduction directly. A new learner can identify an action to try without reading the feature list.

### UX08 Explain what Run actually does

**Observed:** Pressing Run creates endpoint controls whose output still says “Press Send Request to execute the endpoint.” A second action is necessary for the HTTP result. The model works, but the main Run label alone does not explain the distinction. JSON, Show Document, and Show AST also sit beside the first-use action.

Use “Apply code” or “Run app” with a short description, then make “Send request” the obvious next step. Consider selecting and sending a safe starter GET automatically on the initial example only. Group document/AST inspection under an advanced control. Explain that this is a browser simulation, identify unsaved edits, and provide Reset example and specific recovery messages.

**Done when:** The initial state explains what to do next; applying code confirms success; requesting an endpoint produces a clearly labeled result; syntax errors point to the relevant code and preserve edits; resetting is predictable. Preserve the existing pending-changes notice and successful response output.

### UX09 Make the explorer work at project scale

**Observed:** Studio's source is now complete, but its 15 files form a flat accordion. Filtering `parts/logic` shows `4 / 15`, opens a matching file, and exposes copy/download controls. Download file saves one file; it does not provide a runnable project with its imports. [Screenshot](reviews/vectrune-ux-2026-11-12/source-explorer-filtered.png).

Keep the current compact pattern for small examples. For larger projects, group files by folder, show a selected path beside a dedicated code pane on desktop, and use a file picker on mobile. Keep selection visible while scrolling code. Add line numbers without copying them, an optional wrap control, a file permalink, and a **Download project** archive preserving relative paths. Retain the single source-bundle parameter.

**Done when:** Readers can move between two files without losing which one is selected; filtering reports “4 of 15 files”; empty results offer Clear filter; copy preserves exact source; project export includes all imports in the correct folders and runs using the displayed command. Support keyboard navigation appropriate to the chosen pattern; avoid declaring a tree widget without implementing its keyboard behavior.

### UX10 Give learners a clear path

**Observed:** The desktop sidebar exposes eight groups and 22 destinations. Header anchors, homepage example cards, Example Lab, and dedicated showcase routes provide several different ways to reach related material. The Rune-Web lesson reviewed does not provide a visible previous/next lesson sequence.

Organize around **Start**, **Learn**, **Reference**, and **Explore**. Keep application topics as subsections. Add lesson position, prerequisites, and one recommended next action. Clearly distinguish the example catalogue from the editable playground. Suggested learner paths are “First API” and “First interactive app”; games and Studio serve as motivating showcases.

**Done when:** A novice can identify a starting lesson and its next step; a returning user can locate a known builtin directly; mobile navigation reveals the active group without presenting every destination at once.

### UX11 Keep instructions aligned with the interface

**Observed:** Studio's surrounding instructions say “Save to Storage” and “Download .rune”, while the workstation buttons say “SAVE” and “EXPORT .RUNE”. Its run-local text says “Save as rune-web.rune” above commands that use the multi-file Studio path. Internal storage calls and clipboard bindings also appear in the main feature descriptions.

Use the actual action labels, explain outcomes in ordinary language, and move language implementation details into “How it works”. For Studio, distinguish browser-local Save/Load, exported song code, and downloading the whole example project.

**Done when:** Each instruction names an existing control, says where the result goes, and uses the same filename/project structure as its command. Review all three translations against the current interface.

### UX12 Extend search after navigation is reliable

**Observed:** Builtin filtering works within the reference and offers a resettable empty state. The main navigation provides no cross-site search entry.

First improve the reference with a visible label, result count, selected category state, and links to individual builtins. Later introduce a clearly labeled site search across lessons, concepts, and examples, with keyboard access and an explicit scope. This is a proposed capability, not a defect in the existing builtin filter.

**Done when:** Search results identify the content type and destination, open stable URLs, preserve the query on Back, and provide useful recovery when there is no match.

## Delivery sequence

1. **Repair journeys:** UX01–UX06. Fix locale routing, usable deep links, prerequisites, scroll/focus behavior, and mobile obstruction before increasing visual polish.
2. **Clarify first use:** UX07, UX08, UX10, and UX11. Reorder the live examples, explain the sandbox, and establish a short learning sequence.
3. **Improve repeated use:** UX09 and UX12. Develop project browsing and search after route semantics and export expectations are stable.

Use the [style recommendations](STYLE_RECOMMENDATIONS.md) throughout these changes. Implement the shared shell first so every lesson benefits.

## Validation plan

Run a small formative study with five new developers across desktop and mobile. Ask them to get a response without installing, follow local setup, change a value and see its effect, find a builtin, locate Studio's playback source, and switch language while retaining context. Record task completion, time to first result, navigation reversals, and places requiring help. This sample identifies usability problems; it does not establish statistically reliable conversion gains.

Set prospective targets: a first browser result within 60 seconds, complete local instructions without guessing a missing file, the main mobile action visible without scrolling, and no lost context after route or language changes. Establish baselines before claiming improvement. Repeat keyboard and screen reader checks, Safari/Firefox testing, 200%/400% zoom checks, reduced-motion checks, and deployed route/status tests before closing the related roadmap tasks.
