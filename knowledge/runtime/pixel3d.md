# Pixel 3D environments and Rune Crypt

`@App type = pixel-3d` uses shared Rune game logic with a browser raycaster or
the optional native desktop rasterizer. Vect Breach remains a separate example.

Unreleased opt-in `@Scene world` adds solid voxel terrain, elevation, mining,
seeded biome generation and cave geometry. See [Voxel worlds and Rune Miners](voxel-worlds.md)
for APIs, authoring, gameplay and the current shared-JavaScript desktop renderer.
The grid-map semantics below remain unchanged.

## Textured floors and ceilings

`@Map floor` and `ceiling` accept an opaque `"#RRGGBB"` color or an existing
`@Texture` name. Textures repeat once per world tile and are perspective-cast
on horizontal planes. Unknown names are compile errors, not color fallbacks.
Textures use the existing power-of-two square sizes: 8 through 256 pixels.

```rune
@Map/crypt
spawn = {"x":1.5,"y":1.5,"angle":0}
floor = stone/floor
ceiling = stone/ceiling
legend = {"#":{"wall":"stone/wall"},".":{}}
grid:
    "####"
    "#..#"
    "#..#"
    "####"
```

Define those three textures with a palette, size, and pixel rows before using
this snippet. Floors and ceilings remain visual planes, not additional
collision geometry; walls still determine movement and visibility.

### Compact texture rows

`@Texture pixels:` accepts existing quoted literal rows and lossless compressed
row objects. This is **source compression**: the compiler expands them into
the same packed pixel arrays used by browser and native renderers. Exported
asset size and runtime texture memory are not compressed, and no decompression
occurs per frame. Sprites still use their existing literal row format.

```rune
@Palette/stone
colors = {"k":"#161620","s":"#514958","l":"#786b75"}

@Texture/brick
palette = stone
size = [16,16]
patterns = {"mortar":"k*16","edge":"k l*14 k","stone":"k l s*12 l k"}
pixels:
    {"pattern":"mortar"}
    {"pattern":"edge"}
    {"pattern":"stone","repeat":5}
    {"pattern":"mortar"}
    {"runs":"k*16"}
    {"row":"kllllllllllllllk"}
    {"pattern":"stone","repeat":5}
    {"pattern":"mortar"}
```

`patterns` is an optional dictionary of texture-local names to run strings.
Run strings contain whitespace-separated palette symbols; `s*12` repeats
`s` twelve times, and `s` alone means one pixel. Counts must be positive
integers. To repeat a row vertically, set `repeat` (defaults to one). A row
object must contain **exactly one** of `pattern` (dictionary name), `runs`
(inline run string), or `row` (literal ASCII pixels), plus optional `repeat`.
Literal quoted rows can be freely mixed with these objects.

Every expanded row must exactly match the declared width, and total expanded
rows must exactly match the height. Repeats must be integers from one through
the declared height. Unknown patterns, invalid symbols/counts, unknown object
properties, and dimensions that underflow/overflow are compile errors.
There is no nesting or recursive pattern expansion. Symbols `*` and whitespace
can be used only in literal rows, not run strings.

Rune Crypt wall textures use seven distinct
designs: stone brick, fluted pillars, moss-covered brick, cracked stone,
ossuary skull niches, rune panels, and gold/cyan rune seals. Map legends select
themed textures without changing walkable geometry; multiple wall types appear
in every layout. Six wall designs are 32x32; fluted pillars are 64x64 with
carved bands, chips and cracks. Floors and ceilings are 32x32, including
stone slabs, moss, inset ceiling ribs and glowing rune patterns.
See [the compact texture assets](../../examples/rune_crypt/assets.rune) and
[authored map variety](../../examples/rune_crypt/maps.rune).

## Dynamically generated skies

Use `sky` instead of `ceiling` for an outdoor map:

```rune
sky = {"seed":731,"zenith":"#202c55","horizon":"#bd8b83","cloud":"#c0bdcf","speed":0.35}
```

The engine generates a banded gradient and smoothly drifting, seeded pixel
clouds without image assets. Clouds wrap around the full panorama and follow
camera heading rather than floor perspective. The same seed and simulation
time give the same sky in both renderers. Time advances at the game's tick rate,
freezes when paused, and resets on a new run.

`seed` must be an unsigned 32-bit integer. All three colors are required, opaque
hex colors. `speed` is cloud-grid cells per second, defaults to `0.25`, and must
be between `0` (static) and `10`. `sky` and an explicit `ceiling` are mutually
exclusive. Skies are map-wide; per-tile open ceilings and variable-height rooms
are not implemented.

## Room height

`@Map ceiling_height = 3` raises the ceiling and wall tops to three world
tiles above the floor. It defaults to `1` and must be numeric, greater than
`0.5` (the default camera eye height), and at most `16`. Fractional heights are
supported. Browser and native renderers project the ceiling texture at its
actual elevation and extend wall textures by repeating vertically, rather
than stretching the stonework. The default camera eye height and x/y collision stay unchanged.
Explicit elevated cameras are described below.

```rune
@Map/vault
floor = rune/floor
ceiling = rune/ceiling
ceiling_height = 3
# Include the normal spawn, legend and grid declarations.
```

For outdoor maps with `sky`, the height sets wall tops without adding a ceiling
plane. Height is uniform across a map; per-tile heights, jumping, climbing,
and height-aware collision are not supported. Models above an indoor ceiling
are clipped against that plane.

Rune Crypt's indoor heights increase with depth: crypt variants `1.5`,
ossuary `2`, approach `2.5`, and vault `3` tiles. The courtyard keeps its
one-tile walls and open sky.

## Block models

`@Model` adds colored block props to the existing scene `things` collection.
Rune Crypt now uses solid 3D models for all world entities: skeletons, wraiths,
the Warden, shards, potions, shrines, chests, tablets, secret caches, the heart,
spikes, projectiles, and combat markers, as well as stairs. The first-person
sword remains a screen-space viewmodel sprite. See
[block-model authoring](../language/pixel-models.md) for the format, rotation,
depth testing, and visual-only collision boundary.

## Reusable presentation and saves

An optional `@Scene presentation` object replaces the legacy shooter HUD and
status wording. It needs string fields `title`, `subtitle`, `objective`,
`victory`, `defeat`, and an `instructions` array with at most five strings.
State or derived `hud_text` supplies the top bar; state `message` supplies the bottom notice.
Without this object, Vect Breach's presentation is preserved.

## Structured HUD and accessible shell controls

`@Scene ui = ui` binds a **declared top-level logic state field** to a portable
HUD in both browser and native rendering. It takes precedence over
`presentation`'s legacy HUD; games without `ui` keep their existing rendering.
Refresh the object in actions when resources, status, or nearby interactions
change. Rune Crypt's [UX logic](../../examples/rune_crypt/ux.rune) is a complete
example.

```rune
@Logic/game
state:
    ui = {"meters":[{"label":"HEALTH","value":75,"max":100,"color":8312492}],"objective":"CLEAR THE DEPTH","detail":"KNIGHT / LV 1","prompt":"E / USE: CLAIM","notice":"","panel":null}

@Scene/game
logic = game
ui = ui
```

Include normal map, camera, assets, and application declarations to make a
complete game. The HUD object requires `meters`, `objective`, `detail`,
`prompt`, `notice`, and `panel`. Up to three meters accept a string `label`,
finite numeric `value`, positive finite `max`, and integer RGB `color`
(`0` through `16777215`). Bar fill clamps to 0-100%; numbers retain the actual
resource value. `panel` is `null` or
`{"title":"SHRINE","body":"Choose a bonus.","choices":["BLADE","RUNE","GUARD"],"selected":0,"footer":"1 / 2 / 3 SELECT - E CLAIM"}`.
It requires those fields, at most three string choices, and a zero-based
integer selection within the choices (zero for an empty list).
An optional string `heading` adds a centered, three-times-scale title banner
above the panel outside `playing` or while paused. It is ignored during active play. At 320x200,
`heading = "RUNE CRYPT"` fits; longer headings are clipped to the banner width.
Invalid bound state reports an error rather than falling back to another HUD.

**Unreleased customization:** optional `textScale` accepts `1` (default) or `2`.
For example, `ui.textScale = 2` enlarges the bitmap text without changing world
resolution. The larger layout wraps objectives/prompts to two lines, abbreviates
meter labels when necessary (H health, G guardian, I impact in Rune Miners), and
reserves panel space for choices/footer before body text. With three meters it
omits secondary detail to keep the scene visible; put essential turn resources
in a short objective or panel. Keep text concise: overflow still has bounded
line limits. Browser/shared QuickJS and native Rust HUDs support both sizes.
Set `pause_ui.textScale` separately if a pause HUD is bound.
Empty detail/objective/prompt strings remove their unused strips, allowing
game-authored compact/minimal presets without hiding essential meters.

The HUD separates resources, detail, objective, notice, and bottom interaction
prompt. Panel bodies and notices word-wrap; `|` introduces a paragraph break.
Panels replace notices but never the objective or prompt. At the example's
320x200 resolution, panel bodies show up to three lines at camp or while paused,
or two during active play; notices show two. Titles, choices, footer, objective, and prompt use
single clipped lines, so keep them concise. Pausing replaces the bottom prompt
with a resume instruction unless the HUD supplies a heading and its own prompt.
HUD panels are display-only and do not automatically
pause the simulation.

Browser shells can invoke parameterized actions with
`button data-pixel-action=select_choice data-pixel-args="[1]" "Rune"`.
`data-pixel-args` must be a JSON array; it defaults to `[]`. The optional
`data-pixel-text` reads a dotted game-state path as text, `data-pixel-disabled`
reads a boolean path to disable a button, and `data-pixel-selected` reads a
boolean path for `aria-pressed`. `data-pixel-hidden` reads a boolean path for
the element's `hidden` property. Invalid bindings report errors. These bind to
the **game** state, not the shell's separate logic state. Action buttons clear
held inputs and return focus to the canvas without unpausing; only starting a
new run or the explicit pause/resume controls resume play.
An **unreleased** opt-in `data-pixel-menu=true` on a shell menu clears held
inputs on opening/closing and releases pointer lock while visible, so the
mouse can select items. Bind its visibility with `data-pixel-hidden` or
`data-pixel-paused`; the game remains responsible for freezing simulation.
Optional `data-pixel-menu-close=close_menu` invokes that game action when
Escape is pressed with the canvas focused. Closing returns focus to the
canvas; click the scene to recapture mouse look. Menus are not automatic
focus-trapped dialogs.
`data-pixel-confirm="End this run?"` on a `data-pixel-start` button requests
browser confirmation before restarting an active run; it does not affect
starting from camp or programmatic `start()`.

### Context-sensitive touch controls (unreleased)

In an `@Controls` touch object, the whole overlay, joystick and individual
buttons can each declare `"visible":"state.path"`. It resolves a **boolean
game-state path**, not an expression or a literal boolean. Missing/nonboolean
values report an error. Omitting it preserves existing controls. The input
compiler validates path syntax; browser hosts resolve it against current
state in both Pixel and Pixel 3D games.

```rune
touch = {
    "visible": "touch_ready",
    "joystick": {"x":"move_x","y":"move_y","visible":"exploring"},
    "buttons": [
        {"id":"mine","input":"mine","label":"MINE","visible":"exploring"},
        {"id":"guard","input":"guard","label":"GUARD","visible":"defending"}
    ]
}
```

Declare/update those boolean state fields in game logic. Hiding an overlay
or control cancels its active pointers and releases held inputs; it does not
silently resume a held joystick/mining input when shown again. This is a
browser touch presentation feature, not a change to native keyboard/gamepads.
Rune Miners uses it for exploration-only movement/mining, turn choices, and
enemy-turn defense, and hides the entire touch overlay while menus are open.

### Pause screens and deliberate start

Optional `@Scene` bindings extend the same portable HUD:

```rune
pause_ui = pause_ui
restart_action = return_to_title
click_to_start = false
```

`pause_ui` must name a declared game-state field with the normal HUD schema.
It replaces `ui` while a playing game is paused; its heading and up to three
body lines render above the bottom prompt in browser and native hosts.
Populate it with current resources and run status when refreshing the normal HUD.
`restart_action` names an existing game action invoked by
`button data-pixel-restart=true "Return to title"`. That action is ignored during
unpaused play; when paused it resumes the host, resets its animation time, and
invokes the action. The action decides what state to reset and keep. A normal
`@Controls` command can name the same action for a keyboard/controller shortcut.
`data-pixel-paused=true` shows a shell element only during paused gameplay;
include `hidden=true` to avoid an initial flash. These shell controls remain
within the fullscreen surface when placed beside its canvas.

`click_to_start = false` makes browser canvas clicks/taps focus-only at menus;
the default preserves legacy click-to-advance behavior. Enter, mapped start
commands and `data-pixel-start` still begin a run. This prevents acquiring focus
from accidentally confirming the default class.

`persistence = {"key":"rune-crypt","state":"legacy"}` saves only that declared
top-level state field, using the existing pixel save implementation. Keys accept
1-64 ASCII letters, digits, hyphens, or underscores. Browser saves use local
storage; native desktop saves use `.vectrune/saves`. Unsupported storage falls
back to session memory. `saveStatus` exposes `saved`, `session`, or `recovered`;
the browser status line reports it. Malformed saves restore declared defaults.
A shell button with `data-pixel-action=train` invokes the game's `train` action.

## Rune Crypt: tactical dungeon roguelite

Rune Crypt and these engine additions ship in Vectrune 0.3.4.
The teaching site provides [play and source browsing](https://vectrune.com/rune-crypt/)
in English, Spanish and French. The game itself is currently English-only.
Its stable same-origin standalone URL is
`/assets/games/rune-crypt/index.html`, preserving browser saves across site
locale changes. [`teaching_website/build_site.py`](../../teaching_website/build_site.py)
exports the game from `examples/rune_crypt/rune_crypt.rune`; site builds require
0.3.4 or newer so older embedded renderers cannot silently omit engine features.

```sh
vectrune examples/rune_crypt/rune_crypt.rune -o html > rune-crypt.html
vectrune test examples/rune_crypt --type logic
```

Open the exported HTML in a browser. Five depths cross the outdoor courtyard,
one of two crypt layouts, the ossuary, the cursed approach, and the Warden's
vault. Geometry is **authored, not procedurally generated**. Seeded supply
contents and the second-depth layout vary between runs; enemy roles alternate
so every depth includes melee and ranged pressure.

### Title screen and soundtrack

The initial title screen displays a large Rune Crypt logo above class choices
over a static courtyard view, with the weapon hidden. Class selection stays
at camp; canvas clicks/taps only focus the game. Select a class using the
buttons or 1/2/3, then Enter or **Begin a new run** starts gameplay.
The title banner also identifies the game on death and victory menus.

Four original synthesized chiptunes live in
[`sound.rune`](../../examples/rune_crypt/sound.rune): `crypt_title` (84 BPM,
looping title/death theme), `crypt_dungeon` (104 BPM, looping depths 1-4),
`crypt_warden` (132 BPM, looping final-depth boss theme), and `crypt_victory`
(100 BPM, one-shot fanfare). Music switches on state transitions rather than
restarting each frame; restarting a run starts a fresh dungeon loop.
There are no downloaded audio files.

Browser autoplay rules apply: title music waits for a user gesture, such as
selecting a class; beginning a run immediately switches to the dungeon theme.
Native audio starts without that browser gesture requirement. **Sound / M**
mutes music and effects together; Pause suspends music and gameplay, and
Resume continues the score. Declared tracks use the existing shared `@Music`
synthesizer in browser and native hosts.

WASD moves; mouse/arrows turn; click/Space swings; Q casts a single-target rune
bolt; Shift dodges; E interacts. **1 / 2 / 3** select a visible class or reward;
stairs offer two routes (**1 / 2**). Read all effects before confirming with
**E / USE** or the shell's **Confirm choice** button. Camp class selection does
not start a run; **Enter / Begin a new run** does. C remains a cycling fallback;
touch **BUILD** and gamepad X also cycle choices. Gamepad B dodges; the existing
triggers attack/cast and A interacts. Three kills grant a run-local RPG level
with damage and health bonuses. The HUD shows experience, mana, shards and
dodge readiness in labeled bars; the objective includes remaining foes and a
cardinal direction toward the nearest foe. Interaction prompts take precedence
over the progressive movement, sword, rune, and dodge hints. Notices never hide
an interaction; low health adds a healing reminder. Weapon recovery, misses,
and unavailable mana have distinct feedback. Enemies continue moving while
choosing rewards; use Pause if you need time to read.

**P / Pause** displays resources, class, depth, level, kills and relic while
freezing combat and music. **Resume / P** continues the same run.
**Return to title / T** ends the run and returns to class selection, preserving
shards, training and the chosen class. T does nothing during unpaused play.
The browser pause menu also provides accessible resume/restart buttons.

### First-person weapon animation

[`weapon.rune`](../../examples/rune_crypt/weapon.rune) animates 24x24
palette sprites: a shaded steel sword with a gold guard and gloved grip,
a diagonal slash, and a glowing rune cast. Sword attacks animate anticipation,
a lateral sweep and recovery over ten simulation ticks; casting uses a
separate hand/orb animation. Movement bobs the weapon; stopping clears the bob.
Restarts reset animation state. Combat reach, immediate damage and cooldown
rules are unchanged; these animations are visual feedback, not new collision.

### Enemy death animation

Defeated skeletons, wraiths and the Warden leave a visual-only copy of their
normal model in `death_effects`. It sinks slightly for four ticks, then dissolves
into two-pixel fragments, disappearing after 30 simulation ticks (one second).
The effect freezes when paused and clears on changing depth or restarting.
The defeated enemy is immediately untargetable and cannot move or attack;
kill rewards occur once and stairs do not wait for the animation to finish.
The scene behind shows through discarded fragments in browser and native hosts.
See [`combat.rune`](../../examples/rune_crypt/combat.rune) and the
[model dissolve field](../language/pixel-models.md#pixel-dissolve).

### Combat readability

Skeletons telegraph a marked melee strike for 18 ticks (0.6 seconds); moving
away from the marked point avoids it. Wraiths keep their distance and telegraph
an aimed projectile for 24 ticks. The Warden telegraphs for 30 ticks and, below
half health, fires faster three-bolt volleys. Yellow sprites and a sound mark
windup. Enemy models face the player; yellow model variants raise weapons or
casting hands during windup. Skeleton target markers lie on the floor; hit
markers appear above staggered foes. Wraiths hover and shards rotate/bob,
using ordinary instance `angle` and `z` updates (not skeletal animation).
Aim locks when windup begins, not when the projectile fires.

Sword hits interrupt windup and briefly stagger; spells do not. Enemy bolts
travel, expire, and collide with walls. Dodge moves for eight ticks with damage
immunity, respects wall collision, and uses the current movement direction
(backward if stationary). Its cooldown is 60 ticks normally or 40 for Scout.
Damage grants 12 ticks of immunity to prevent multiple simultaneous hits.
Armor reduces each hit, to a minimum of one damage. Diagonal movement is
normalized.

After the courtyard, spike traps repeat a 120-tick cycle: idle for 70, yellow
warning for 30, red/damaging for 20. They can be walked around or dodged.

### Classes, equipment, and exploration

At camp, buttons, 1 / 2 / 3, or C select **Knight** (100 starting HP, two armor), **Arcanist**
(80 HP, stronger runes, eight mana, regeneration every 60 ticks), or **Scout**
(90 HP, faster movement/sword/dodge). Training adds its existing bonuses to
each class. Other classes have six mana and regenerate every 90 ticks.

Each depth offers one shrine blessing: **Blade** (+2 sword damage), **Rune**
(+2 spell bonus, +1 maximum mana and refill), or **Guard** (+25 max HP and heal).
The panel shows every effect; select with 1 / 2 / 3 or C, then E claims.
There is no forced random blessing.

Each depth's chest offers **Fang** (sword cooldown reduced by three ticks),
**Lantern** (mana regeneration period reduced by 30 ticks), or **Aegis**
(two armor). Equipment has one relic slot: replacement removes the old
effect before applying the new one; it cannot stack by reopening a chest.
Equipment and blessings reset between runs, not between depths.

Tablets reveal lore and tactical clues. Gold-flecked cracks hide optional
caches containing three permanent shards and 15 healing. These are searchable
landmarks, not dynamically opened wall passages; each rewards only once per
depth. They are reachable without defeating every foe.

Clear every foe to unseal stairs. Before descending, choose **Sanctuary**
(25 healing) or **Cursed** (no exit healing, next depth's ordinary foes gain
three HP, kills award two shards rather than one). Mana refills on either
route. The five-depth final boss keeps its fixed 42 HP on either route.
The final heart requires all foes defeated and an explicit E press.

Collected shards, training rank, run count, and wins survive death and reload.
At camp (title, death, or victory), R or **Train** spends five shards for one
permanent rank, up to rank ten. Each rank adds ten starting health and one sword
damage. Class selection also persists; older saves receive the default Knight
class without losing existing progress. Run-local levels, shrine bonuses,
relics, enemies, and health reset on a new run. Claiming the heart at depth five
awards five bonus shards.

Sources: [compiler](../../src/apps/pixel3d/mod.rs),
[native renderer](../../src/apps/pixel3d/raster.rs),
[browser renderer](../../runtime/rune-web/src/pixel3d/raycaster.ts),
[sky generator](../../runtime/rune-web/src/pixel3d/sky.ts),
[game](../../examples/rune_crypt/rune_crypt.rune),
[combat](../../examples/rune_crypt/combat.rune),
[exploration and builds](../../examples/rune_crypt/exploration.rune),
[portable HUD](../../runtime/rune-web/src/pixel3d/hud.ts),
[native HUD](../../src/apps/pixel3d/hud.rs),
[UX and choice state](../../examples/rune_crypt/ux.rune),
[logic scenarios](../../examples/rune_crypt/crypt.logic.test.rune),
[browser regressions](../../tests/browser/rune_crypt.py),
[compiler/raster tests](../../tests/pixel3d_app.rs).

## Declarative cameras and cinematic title scenes (unreleased)

Vect Breach's [title scene](../../examples/vect_breach/title.rune) demonstrates
an elevated, pitched camera tour of its actual first level, with glowing bitmap
lettering. The game scene opts in with `title_scene = breach_title`; its normal
`camera = player`, briefing, controls, combat and run state are preserved.

```rune
@Perspective/tour_view
fov = 76

@Camera/tour
duration = 24
loop = true
points = [
    {"x":2,"y":2,"height":4,"angle":0,"pitch":-35},
    {"x":6,"y":2,"height":3,"angle":90,"pitch":-25},
    {"x":6,"y":6,"height":4,"angle":180,"pitch":-35},
    {"x":2,"y":6,"height":2,"angle":270,"pitch":-15}
]

@Scene/breach_title
map = e1m1
things = ["enemies", "pickups"]
camera = tour
perspective = tour_view
sky = {"seed":731,"zenith":"#050b1c","horizon":"#25445c","cloud":"#28435a","speed":0.2}
heading = VECT BREACH
subtitle = CYBERNETIC SECTOR INFILTRATION
prompt = PRESS ENTER OR CLICK TO BEGIN MISSION
```

`@Perspective` declares horizontal `fov` in degrees, from 20 through 120;
omitting it preserves 66 degrees. Both game and title scenes can reference it.
A scene's `camera` can reference an `@Camera` track or retain a legacy state
path. Tracks require a positive duration in seconds and 2–128 points containing
finite `x`, `y`, and `angle`. Optional `height` defaults to 0.5 tiles above the
floor (allowed 0.05–256); optional `pitch` defaults to zero, from -85 through
85 degrees. Negative pitch looks down. This height is independent of voxel
camera feet elevation `z`.

Tracks use smooth cubic interpolation and shortest-path angles. `loop` defaults
to true and joins the final point back to the first with continuous motion;
false holds the final point after the duration. Cubic paths can overshoot their
points: author routes with clearance from walls and map boundaries. Height and
pitch are clamped to keep the interpolated eye above the floor and pitch within
85 degrees. Tracks are visual cameras; they do not move the player, perform
collision avoidance, or implement third-person following yet.

A title scene activates only for game `status = "title"`. Its independent
presentation clock advances at the app tick rate, freezes when paused, and
resets on reentry. Vect Breach already freezes combat in this state. The title
scene hides the weapon, damage flash, and gameplay HUD; `heading`, `subtitle`
and `prompt` supply its overlay. Enter/click use the existing start/briefing
flow and never wait for the camera path. `things` selects game-state entity
collections, defaulting to the game scene's bindings. A scene-local `sky` uses
the normal map sky schema and opens the roof without changing the gameplay
map. The opaque floor remains in place; wall height comes from the map.

Grid cameras now support true height and pitch: finite-height wall columns
have visible tops, and floors, ceilings, billboards and block models share
per-pixel depth. Open sky permits views above the walls; opaque ceilings still
occlude indoor views. Browser and desktop use the shared JavaScript renderer
for these cameras and title scenes (as voxel worlds do). Ordinary grid games
retain their existing browser/native rendering paths. Desktop titles with a
custom perspective or camera track also use the shared renderer. The standalone
Rust `Rasterizer3D` API retains its fixed-eye camera interface.
