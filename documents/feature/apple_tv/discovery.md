# Vectrune on Apple TV: discovery and implementation plan

**Status:** Discovery; native tvOS support and the CLI workflow below are not
implemented. Update this document as experiments answer the open questions.

## Goal

Run Rune projects on Apple TV through a reusable native tvOS host that Vectrune
can package into an editable Xcode project. Start with Pixel-3D games and
Glowtide Aquarium; do not imply that all Rune app types or browser APIs work.
The host must be reusable by other projects, not tailored to one aquarium.

## Current evidence

- The existing [mobile WebView prototype](../../../knowledge/runtime/mobile-web.md)
  targets Android and iOS, not tvOS. Apple's
  [WKWebView documentation](https://developer.apple.com/documentation/webkit/wkwebview)
  does not list tvOS availability.
- [`src/apps/pixel3d/desktop.rs`](../../../src/apps/pixel3d/desktop.rs)
  already hosts shared game logic in QuickJS and can present a shared
  framebuffer. Its window, input, audio and lifecycle code is desktop-specific;
  it is prior art, not a tvOS library today.
- A small native SwiftUI probe compiled, launched on a paired physical Apple TV
  using a Personal Team, and its counter responded to remote Select. The probe
  does not run Rune and is not part of the repository; broader remote
  navigation, relaunch and provisioning renewal remain to be checked.
- A separate experimental Rust static library with QuickJS cross-compiled for
  arm64 tvOS device and simulator. `rquickjs` 0.14 needed its `bindgen` feature
  and a working libclang because its packaged bindings did not cover these
  targets. The QuickJS C build also needed an explicit tvOS deployment target
  to match the host; toolchain requirements remain a packaging decision.
- On the development Mac, the library evaluated the actual compiled Glowtide
  script and produced a 640 x 400 RGBA framebuffer. Its output changed after
  30 simulation ticks. The script was extracted from generated HTML solely for
  this experiment; production export should use a deliberate compiler API.
- An experimental native TV app links the device library, bundles the compiled
  aquarium, and requests snapshots from QuickJS on a background thread. It
  builds for device and arm64 simulator, and was installed and launched on
  the paired physical TV. The user confirmed that an aquarium image appeared
  and that Select produced a different snapshot. The simulator app was built
  but not run, and x86_64 simulator builds are not covered by this probe.
- The snapshot probe creates a fresh VM for each request and is not an
  interactive game loop. It has no native audio or persistence bridges, game
  input mapping, lifecycle handling, execution deadline, or GPU integration.
  Its native artifacts and personal signing settings are local-only. Visual
  parity, save behavior and distribution remain untested.
- A follow-up local-only probe retains one QuickJS VM, steps the simulation on
  a worker thread, and presents frames continuously in a native full-screen
  view. It fits the 16:10 aquarium image without stretching, leaving black bars
  on a 16:9 screen. It attempts to pause while inactive, but pause/resume and
  input are not yet verified on-device. The user confirmed continuous animation
  on the Apple TV 4K (3rd generation) and reported approximately **0.9 render
  FPS at 640 x 400**, and **3.3 render FPS at 320 x 200** with visible
  artifacts. These are exploratory on-screen readings, not controlled
  benchmarks. The simulation has a catch-up cap of five ticks per frame, so
  at low frame rates it can also run slower than real time. The test does not
  establish which part of the frame is the bottleneck.
- This second probe sets a QuickJS memory cap and per-call interrupt deadline.
  It does not yet provide audio, persistence or game controls; it is not a
  reusable host or a supported export. The simulator binary was built but not
  run. The temporary renderer resolution is not a recommended shipping setting.
- A newer local-only probe combines the experimental Rust voxel world renderer
  with the shared JavaScript HUD. QuickJS still advances the simulation and
  transfers a world snapshot each frame; immutable model and texture assets
  are loaded at initialization. Unsupported scene features are rejected
  rather than intentionally omitted. On the development Mac, the complete
  probe framebuffer matched the shared enhanced renderer byte-for-byte at
  320 x 200 and 640 x 400, at initialization and after 30 ticks. This is a
  limited parity check, not a general compatibility guarantee.
- The new 640 x 400 enhanced-lighting device build was signed, installed and
  launched on the paired physical Apple TV. The user confirmed the aquarium
  appeared and reported approximately **6.5 render FPS**, with average
  per-frame times of **30 ms simulation**, **31 ms scene transfer**, **93 ms
  native rendering**, and **3 ms shared HUD**. These are exploratory on-screen
  readings, not a controlled benchmark; display animation and image-creation
  time were not explicitly confirmed. The display reports render-loop FPS and
  average simulation, scene serialization/deserialization, native rendering, shared HUD and image
  creation times. It does not measure actual display presentation latency or
  displayed FPS. The probe explicitly enables enhanced lighting, so comparisons
  with earlier measurements must account for potentially different settings.
  At that stage input, audio, saves, and production lifecycle handling were
  unavailable.
- The user initially saw a persistent startup label. A diagnostic rebuild
  showed the scene becoming active and the runtime initializing; a subsequent
  launch displayed the aquarium. The cause of the initial stall is unconfirmed.
  Startup and pause/resume still need controlled lifecycle testing.
- The user later reported a Rune out-of-memory error on the TV. A Mac stress
  run reproduced persistent QuickJS growth during scene preparation, including
  with simulation paused: approximately 9.6 MB allocated at frame 50 and
  59.1 MB at frame 600. Explicit QuickJS cycle collection did not recover it.
  Ordinary-array render queries created temporary spatial-index sessions with
  weak-map reference cycles that remained retained in this QuickJS runtime.
  Query passes now explicitly release their indexes, and render queries outside
  a pass avoid creating a session. With the same 128 MiB QuickJS cap, a
  320 x 200 Mac run of 1,000 additional frames with five ticks per frame stayed
  around 5.7 MB allocated; 200 frames without ticks were also stable. A
  640 x 400 Mac run completed 300 additional frames and showed approximately
  8.4 MB allocated at frame 300. A QuickJS regression test exercises repeated
  actual aquarium scene preparation. These measurements cover QuickJS
  allocations, not total process or Swift image memory. The revised device build
  was installed and launched, and the user reported that it ran for five
  minutes without the error. Longer runs and total device-memory behavior
  remain unmeasured.
- Profiling the experimental 640 x 400 renderer on the development Mac found
  terrain and sky at about 69 ms of a 71 ms native frame, with enhanced lighting
  around 1.5 ms. Profiling-only runs isolated voxel traversal as the dominant
  cost. The native dense renderer now builds a per-frame 4 x 4 x 4 occupancy
  map and skips empty chunks conservatively, retaining fine traversal at
  potential hits and boundary ties. In the same local setup the terrain pass
  was around 31 ms and the native frame around 33 ms; full aquarium frames
  still matched the shared renderer at initialization and after 30 ticks.
  These are exploratory Mac timings, not a controlled TV benchmark or a
  guarantee for other scenes. The revised 640 x 400 build was launched on the
  TV; the user reported approximately **10 render FPS** and **42 ms native
  rendering**. The earlier approximately 6.5 FPS and 93 ms reading was not
  a   controlled comparison. The user subsequently confirmed the image looked
  correct to their eye. Dense worlds fall back to fine traversal.
- The next local-only bridge sends the occupied chunk records for chunked
  worlds, reconstructing a dense world on the Rust side every frame; ordinary
  dense worlds still use the dense snapshot. This is not an incremental cache,
  so modifications, removals and world replacement are reflected without a
  revision protocol. Mac testing compared reconstructed cells after those
  changes and rejected malformed chunks. At 640 x 400, an exploratory reading
  dropped scene transfer from about 25 ms to 0.4–0.5 ms. The probe matched
  complete shared-renderer frames initially, after 30 ticks, and every 100
  frames across 500 additional frames of five ticks each. QuickJS allocation
  was approximately 8.4 MB at frame 300. On the TV, the user reported about
  **16 render FPS** and **1 ms scene transfer**, describing it as much smoother.
  These exploratory readings are not a controlled benchmark; total process
  memory, extended stability and gameplay interactions require separate
  verification.
- A subsequent experimental renderer optimization projects occupied voxel
  bounds into 8 x 8 screen tiles and skips terrain rays outside those bounds.
  It falls back to ordinary traversal for near-plane intersections and large
  numbers of occupied chunks. On the Mac at 640 x 400, an exploratory native
  frame reading dropped from about 34.6 ms to 8.8 ms. Full aquarium frames
  matched the shared renderer initially, after 30 ticks and every 100 frames
  across another 200 frames; randomized tests also check that the projected
  tiles do not hide fine-traversal hits. The TV build was installed and the
  user reported **27.8 render FPS**; native-stage timing and visual appearance
  for that build were not reported. This is not a general parity proof or a
  controlled device benchmark.
- A local-only music probe now runs the aquarium's authored `glowtide_drift`
  score through Rune's shared JavaScript sequencer and native Rust voice mixer,
  with an `AVAudioEngine` source node presenting PCM on tvOS. The mixer sample
  cursor drives the music clock; the host pumps the scheduler during frames
  and pauses audio while the app is inactive. Device audio setup errors are
  surfaced in the probe. The user confirmed that music plays smoothly at a
  comfortable level after a temporary bounded 4x host gain; that gain is not
  a general volume policy; the initial music build had no remote volume or
  mute control.
  Full audio lifecycle, interruptions and long-duration stability remain
  unverified. Local tests generated nonzero PCM from the actual score while
  maintaining the checked framebuffer parity.
- The existing native audio adapter models only one outgoing route per node.
  The aquarium's parallel effects sends replaced its dry route, producing
  extremely quiet output. The session-only probe keeps the first, dry route
  instead. The shared adapter remains unchanged and needs a proper, tested
  graph/mixer design before a reusable host can rely on it. Browser playback
  may wait for a user gesture under autoplay restrictions.
- A subsequent local-only audio experiment adds mono reverb, delay and chorus,
  using the actual aquarium score's effect settings and per-track sends.
  The effect buffers are allocated before audio playback; the callback does
  not access QuickJS. Local tests check individual effect tails, zero-wet
  behavior, bounded output and the actual score's three send combinations.
  A 640 x 400 run with effects retained the checked shared/native framebuffer
  parity and produced audio. The effects build was installed and launched on
  the TV, and the user said the mix sounded good. Device frame rate and
  longer-duration audio stability have not been measured for this build.
  This is an approximation, not Web Audio parity: reverb uses feedback combs
  instead of convolution, sends use the dry-filtered signal, and send levels
  are captured when voices are scheduled rather than dynamically automated.
  Effect-tail cleanup, mute/stop behavior and interruptions need further work.
- A session-only probe connects Siri Remote directions, Select and Back to
  the existing game HUD and controller navigation. The user confirmed that
  remote controls responded, but asked for clearer highlights, intuitive
  directions, subtle menu sounds and a way to rotate the tank. The revised
  prototype navigates HUD controls spatially and adds **Tank View** and
  **Friends** buttons. Select Tank View and use left/right to rotate; select
  Friends and use left/right to cycle fish and critters, then Select to open
  a profile or retrieve a dead resident. Back returns to the HUD, and closes
  menus, profiles or the on-screen keyboard when one is open. Focus corners
  follow the selected tank or resident; Play/Pause toggles diagnostics. The
  Sound button also mutes native effect tails and navigation cues at the
  output. Local tests exercise menu actions, tank rotation, resident profiles,
  keyboard cancellation, mute and bounded quiet cues; local images show the
  revised focus states. The user liked Tank View and Friends and requested
  subtler animated highlighting and wraparound navigation. A later build
  adds both and replaces the tiny top-left detail with a larger pearls and
  friends summary. The revised display still needs device feedback.
  This aquarium-specific focus bridge is not a reusable
  Rune TV-controls API, and saves are not connected in the probe.
- An initial reusable tooling slice adds `vectrune tvos devices`, `build` and
  `run` for an existing Xcode project on macOS. The new commands built,
  installed and launched the session-only aquarium project on the paired TV.
  They do not yet generate a project or build its Rust runtime; signing remains
  configured in Xcode. The user approved an optional separate Rune TV section
  with general defaults for future navigation and focus configuration. That
  declaration and reusable host have not yet been implemented.
- Apple's [account guidance](https://developer.apple.com/help/account/basics/about-your-developer-account)
  describes free Personal Team testing with seven-day provisioning. App Store
  distribution requires program membership and review.

## Proposed architecture

1. The Vectrune CLI runs on the developer's machine, compiling a supported
   `.rune` project and its assets into a self-contained game bundle.
2. A shared, platform-independent runtime library loads the bundle, executes
   game logic, advances simulation and produces frames. Extract the existing
   desktop implementation where practical; a Rust static library with a
   narrow C ABI is a candidate. The disposable experiment is not a stable ABI;
   validate QuickJS and its dependencies on device and under distribution rules
   before committing to it. Do not rely on a WebView or a Mac executable on the TV.
3. A reusable native Swift/tvOS host presents frames, translates Siri Remote
   and game-controller input, drives audio, persists data, and handles
   foreground/background transitions. Keep project identity, icons and game
   assets separate from shared host code.
4. An exported Xcode project links the runtime and game bundle. Developers
   configure their own signing and bundle identifier in Xcode. No credentials,
   provisioning profiles or machine-specific paths are embedded in templates.

The existing CPU rendering path is the initial compatibility target. GPU/Metal
lighting is a separate, measured follow-up; browser WebGL cannot be assumed
available. Define explicit feature support and fallbacks rather than silently
dropping effects or promising visual parity before testing.

## Native rendering investigation

The current full-frame JavaScript renderer in QuickJS is not yet fast enough
for Glowtide on the tested TV. First measure simulation, state preparation,
rendering and presentation separately on device; the reduced-resolution result
suggests pixel work matters but does not prove that it is the only bottleneck.
Test a simpler project too. Avoid treating full-screen presentation or a lower
internal resolution as evidence of acceptable visual quality or speed.

The existing Rust [`raster.rs`](../../../src/apps/pixel3d/raster.rs) is a useful
starting point, but it is a fixed-eye renderer, not a complete port of the
shared TypeScript renderer. The desktop host deliberately switches to the
shared renderer for voxel worlds, camera pitch and other features, and Glowtide
uses a voxel world. Simply linking the Rust rasterizer would not preserve its
visuals. Swift is a good host for windowing, input, audio, storage and lifecycle;
implementing a separate Swift renderer would add another platform-specific
implementation to keep in sync.

Investigate a reusable Rust rendering core that can compile natively for tvOS
and to WebAssembly for the web, with QuickJS continuing to execute Rune logic
and provide scene state. This is a candidate, not an established solution:
validate WebAssembly/toolchain feasibility, transfer costs, browser integration
and native performance before choosing it. A native CPU port, a Metal GPU
backend, or a staged CPU/GPU hybrid should be compared with the current
TypeScript and browser GPU paths. Account for the cost of transferring dynamic
scene data from QuickJS; avoid assuming that per-frame JSON or GPU rendering is
automatically fast enough.

Make parity an explicit acceptance gate. Build deterministic reference scenes
and capture the same game state from the current renderer and each candidate,
covering voxels, camera pitch, models, depth and transparency, lighting,
post-processing, animation and HUD. Compare images and interactions with
documented tolerances where GPU rounding differs; include representative
Glowtide and independent Pixel-3D scenes. Incrementally replace features only
when their parity and device timings are verified, keeping an explicit fallback
or an unsupported-feature error rather than silently dropping effects.

### First parity gate

[`tests/pixel3d_parity.rs`](../../../tests/pixel3d_parity.rs) compiles the real
Vect Breach example, executes the same gameplay state in QuickJS, and compares
the entire shared-renderer RGBA frame to the Rust rasterizer at six camera
angles and with a gameplay message. CI runs the comparison after rebuilding the
shared JavaScript runtime.
This fixture exposed and corrected fixed-eye camera quantization, wall and
sprite projection rounding, and gameplay HUD colors. It also checks that a
pitched camera and Glowtide's voxel world remain on the shared desktop path.
This single fixture is **not** evidence of parity for all grid scenes, models,
HUD states, voxels, or lighting, and it does not accelerate Glowtide on tvOS.

The experimental Rust [`voxel.rs`](../../../src/apps/pixel3d/voxel.rs) renders
dense, unposed voxel terrain with inside/outside cameras, pitch, material
textures, render-distance limits and procedural sky. The native model renderer
also has an experimental pitched-camera and pitched-instance path, and
[`lighting.rs`](../../../src/apps/pixel3d/lighting.rs) implements the standard
voxel point-light pass. The parity suite compares terrain, sky, models, lights
and depth against the shared renderer, including Glowtide at initialization
and after 30 simulation ticks using dense snapshots of its sparse terrain, and
independent pitched shape and
overlapping-light cases. Enhanced lighting, glass, bloom, HUD, interaction and
other effects are intentionally excluded from that scene comparison.

[`enhanced_lighting.rs`](../../../src/apps/pixel3d/enhanced_lighting.rs) adds
separate experimental tiled glass, distance-haze and bloom-compositing
primitives. [`tests/pixel3d_enhanced_parity.rs`](../../../tests/pixel3d_enhanced_parity.rs)
compares glass and haze against the shared renderer in synthetic views and with
all four Glowtide panes. It also compares bloom from shared model emissions and
synthetic visible and stale samples, including edge tiles and partial tile
dimensions. These tests are isolated passes, not complete enhanced aquarium
frames. The experimental native model renderer can now record the nearest
emissive fragment per tile for bloom, and comparisons cover all four shapes,
overlapping emitters, dissolve and later occlusion in synthetic voxel scenes.
Samples are cleared between frames and bloom uses final scene depth to hide
stale samples. A separate experimental contact-shadow pass compares exactly
with selected voxel-floor and horizontal-glass fixtures, including point-light
composition, dissolve and vertical panes. An aquarium fixture also checks the
real initial casters and panes at a close viewpoint: those casters have no voxel
or horizontal-glass support and therefore do not cast shadows there. These
isolated fixtures omit actual model geometry. An additional world-frame fixture
composes the aquarium's terrain, sky, visible models, point lights, shadows,
glass, haze and bloom at initialization and after 30 ticks; its color and depth
match the shared renderer from four viewpoints in each state. Both glass and bloom visibly affect
the fixture, but the casters do not necessarily cast a visible shadow there.
This world comparison excludes HUD, tethers, world-title overlays and
interaction, and does not establish complete game parity.

An experimental Rust HUD compositor accepts the existing shared renderer's
transparent `renderOverlay(frameHud(renderState()))` pixels and copies the
opaque pixels over a native frame. Tests compare it with direct shared HUD
drawing for aquarium buttons, a moved sidebar selection, profile and on-screen
keyboard at 640 x 400, and with enhanced world frames with the menu open and
closed. This retains the shared JavaScript layout, not a native HUD port. The
overlay call clears the shared raycaster buffer, so a host must preserve the
native frame separately. Flash, fade, palette, other overlays, hit testing,
input routing and cross-language transfer remain to be integrated and measured;
these tests do not establish end-to-end TV interaction or performance.

The enhanced voxel-model primitive also applies the shared renderer's
distance-based skyline tint to models in the `y < 4` region when there is no
side backdrop, while retaining the original emissive color for bloom. Synthetic
fixtures cover near and far models, models outside that region, and a colored
sky. Side-backdrop rendering and its separate composition remain unsupported.

The experimental `finish_voxel_lighting` entry point sequences point lights,
contact shadows, glass/haze and bloom, leaving the input frame unchanged on
error. Callers must supply valid casters and panes in scene order and render
terrain and models separately. It currently copies a full framebuffer for
failure safety. The glass and shadow passes scan every tile or pixel per object
rather than using the shared renderer's projected bounds; their performance has
not been measured.

The experimental `voxel_scene::render_enhanced_voxel_scene` assembles those
passes with terrain, sky and ordinary model instances into an owned color/depth
world frame. The aquarium parity fixture exercises this entry point at the
viewpoints and simulation states above. It accepts explicit model metadata,
rejects sprites and invalid input, and returns no partial frame on errors.
It is a deliberately narrow contract, not a general scene deserializer:
callers must detect unsupported features such as tethers, poses, titles and
backdrops before selecting it. It is not connected to desktop or tvOS, and
allocation and frame-transfer costs have not been measured.

These are rendering primitives, not a complete native scene renderer: direct
sparse storage, terrain pose, tether-specific poses, full enhanced-scene composition, HUD
composition and game interaction remain unimplemented or unverified. They are
not wired into desktop or tvOS, and no native device performance has been
measured. Keep the existing shared-renderer fallback until the complete scene
and its interactions meet the parity gate.

Expand this gate feature by feature: use deterministic real compiled state,
exercise multiple viewpoints and interaction states, compare color and depth
where available, and add independent feature fixtures before declaring that
feature supported by the native path. Test live scene changes and runtime
selection as well as still frames. Exact RGBA equality is required for the
current CPU fixture; if a future GPU backend needs tolerance, specify bounded
per-channel and differing-pixel limits per fixture, with documented reasons.
Never widen a threshold or update an expected result merely to make CI pass.
Use explicit unsupported entries and fallback checks for unported features,
and record measured device performance separately from visual correctness.

## Intended workflow

The following is a **proposed** interface, not an available command:

```sh
vectrune <project> --export tvos --build-dir ./my-tv-app
```

Generate an editable Xcode project with the shared host, runtime and compiled
assets. Provide clear prerequisites and signing instructions. Protect existing
unmarked directories and editable exports from accidental replacement, following
the current mobile export's safety model. Design an explicit asset-update
workflow that preserves native edits, signing settings and saved data.

Keep TV-specific navigation, focus targets and remote shortcuts in an optional,
separate Rune declaration, with general defaults when absent. The exact syntax
and compatibility contract are not implemented yet; do not make aquarium
state names or actions implicit requirements for other games.

Decide separately whether the installed CLI embeds prebuilt device/simulator
libraries or builds them locally. Document SDK, toolchain, network, versioning,
licensing and cross-platform export requirements for the chosen approach.

## Milestones

1. **Device probe:** Native launch, Personal Team signing and remote Select
   confirmed. Verify broader navigation, app relaunch and provisioning renewal.
2. **Runtime feasibility:** Device and arm64 simulator builds and on-device
   Rune snapshots confirmed. Measure app size, performance and memory, and
   validate QuickJS, dependencies and applicable Apple distribution requirements.
3. **Reusable host:** Implement frame presentation, focus and remote/controller
   mappings, audio, persistent storage, pause/resume and error reporting. Define
   a versioned host/runtime boundary and lifecycle ownership.
4. **Project generation:** Generate, build and run a minimal Rune Pixel-3D
   example in Xcode, including a safe editable-project handoff.
5. **Compatibility and usability:** Run Glowtide and at least one independent
   Pixel-3D example. Exercise menu navigation, saves after restart, lifecycle
   transitions, lighting, crowded-tank performance and long-running stability.
   Record actual hardware, scene settings and measurements before making
   performance or visual-parity claims.
6. **Public support:** Add tests, runnable examples, source-linked `knowledge/`
   and reference entries, CLI help and relevant public docs. Mark limitations
   and unsupported app types clearly; verify device and simulator builds in CI.

## Open questions and risks

- Does QuickJS and its complete dependency chain build and run on tvOS under
  Apple's device and distribution rules? Evaluate alternatives if not.
- What is the smallest stable API for buffers, input, errors and lifecycle,
  and who owns memory and threading across Swift/Rust?
- How should remote focus, Back/Menu, directional navigation, selection and
  optional controllers map to existing game controls? How are inaccessible
  mouse-only interactions exposed?
- How should save locations, app suspension, audio interruptions and
  termination behave? Avoid promising offline progress or save compatibility
  with browser origins.
- Which Pixel-3D features, including enhanced lighting and GPU acceleration,
  can meet acceptable device performance? Determine quality settings from
  measured results rather than assuming a hardware gain.
- What is the minimum supported tvOS version and how will Xcode, runtime and
  generated-project versions be maintained together?
