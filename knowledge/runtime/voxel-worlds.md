# Voxel worlds and Rune Miners (unreleased)

Pixel 3D scenes can opt into **solid, mineable 3D terrain**, independently of
the existing grid-map renderer. Rune Crypt and Vect Breach keep their 2D wall
collision and fixed-eye rendering. Voxel terrain uses x/y for the horizontal
plane and z for elevation; each occupied cell is a one-tile cube.

## Scene and generation

```rune
@Scene/miners
logic = miners
map = atmosphere
world = world
camera = player
things = ["landmarks"]

@Logic/miners
state:
    world = null
    player = {"x":4.5,"y":4.5,"z":3,"angle":0,"pitch":0,"vz":0}
    landmarks = []
action initialize:
    world = voxel_generate(319, "meadow")
action start:
    world = voxel_generate(319, "meadow")
action tick(input):
    player = voxel_move(world, player, 0, 0, false)
```

This is a scene/logic excerpt, not a complete app. See
[`examples/rune_miners/`](../../examples/rune_miners/) for the required
atmosphere map, material textures, controls, models and shell.
`world` must name a declared state field, populated before the first frame.
The map supplies the optional generated sky; its grid, plane textures and
ceiling height do not determine voxel geometry.

`voxel_generate(seed[, biome])` returns a deterministic **20 x 20 x 10**
starter world. Seed is an integer from 0 to 4294967295. Biome defaults to
`"meadow"`; `"ember"` changes surface materials and terrain variation.
The generator combines seeded hills, trees and ore with a guaranteed safe
camp on protected bedrock, nearby crafting resources and a terraced cave entrance. The starter
landmarks/entrance are intentionally fixed; this is not arbitrary procedural
dungeon generation.

The world object contains `width`, `height`, `depth`, `seed`, `biome`,
`materials`, `cells`, and `spawn`. Cells are flattened as
`(z * height + y) * width + x`. Zero is air; positive IDs are **one-based**
indices into `materials`, an array of compiled `@Texture` names.
For custom volumes, width/height accept integers 1-48 and depth 1-24.
There must be exactly width x height x depth cells and 1-256 materials;
every cell ID must reference air or an existing material.

Starter IDs: 1 bedrock, 2 stone, 3 grass/ash, 4 timber, 5 copper,
6 leaves/embers. Required textures are `miners/bedrock`, `miners/stone`,
`miners/grass`, `miners/wood`, `miners/copper`, `miners/leaves`;
Ember substitutes `miners/ash` and `miners/ember`. Unknown texture names,
invalid dimensions, IDs, seeds and arguments report errors.

## Volume tools and movement

These functions are Rune **game-logic expressions**, shared by browser and
QuickJS desktop hosts; they are not server run-block builtins.

| Expression | Result and behavior |
|---|---|
| `voxel_get(world, x, y, z)` | Reads an integer block ID; coordinates must be in bounds. |
| `voxel_fill(world, from, size, block)` | Mutates a box volume and returns the world. `from` and `size` are `[x,y,z]` integer triples, sizes positive. Block 0 carves air. Validates the entire box before writing; this is an authoring tool, not player mining. |
| `voxel_move(world, player, dx, dy[, jump[, options]])` | Returns updated player position and vertical velocity. Finite horizontal deltas must total at most one tile; jump defaults false. Optional platformer tuning is described below. |
| `voxel_target(world, player)` | Returns nearest block within three tiles, or `null`. Hit fields: `x`, `y`, `z`, `block`, `distance`, `face` (x=0, y=1, z=2). |
| `voxel_mine(world, player)` | Removes the targeted cell in place, returning `{block, hit}`. Block 0 means miss or protected bedrock (ID 1). Rewards/cooldowns are game logic, not engine side effects. |

```rune
# Carve a passage, then author a copper vein. All coordinates are in bounds.
world = voxel_fill(world, [12,10,1], [3,2,3], 0)
world = voxel_fill(world, [12,9,2], [3,1,1], 5)
result = voxel_mine(world, player)
if result.block == 5:
    copper += 1
```

Player fields are finite `x`, `y`, `z` (feet), `angle` (degrees),
`pitch` (degrees, positive looks up, within 90 degrees), and `vz` (within
-1 through 1). Player position must fit inside movement bounds.
Movement uses a 0.48-tile-wide,
1.6-tile-high collision body, gravity and swept small steps. Supported
one-block ledges auto-step when grounded with headroom; jump adds an impulse.
Pass jump on its press edge and call movement once per 30 Hz game tick.
World edges and z below one tile are solid movement boundaries.
Camera eye is feet z + 1.25; it must remain inside the volume.
Rendering accepts pitch -85 through 85; Rune Miners clamps to -65 through 65.

For platform games, the optional sixth argument accepts `jumpSpeed` (greater
than zero, at most 1), `gravity` (greater than zero, at most 0.3), and boolean
`autoStep`. Defaults remain `0.28`, `0.035`, and `true`. Gravity is applied
before each tick's vertical movement; falling speed is capped at 0.3 tiles per
tick. Unknown options and invalid values report errors. For example,
[Skybound](../../examples/skybound/skybound.rune) uses:

```rune
player = voxel_move(world, player, dx, dy, jump_pressed, {"jumpSpeed":0.44,"gravity":0.035,"autoStep":false})
```

This creates an approximately 2.5-tile jump and requires jumping onto ledges.
It preserves the existing swept collision body and headroom checks. Air control,
acceleration, press edges, enemies, fall recovery, and checkpoints are game logic.

Voxel terrain uses per-pixel 3-axis DDA, tiled material textures, face shading,
real cave floors/ceilings and depth occlusion shared with `@Model` entities.
Models remain visual props, not solid terrain. World entities require models,
not billboard sprites; first-person weapons may still be screen-space sprites.
Touch look supports optional `y` alongside `x`:
`"look":{"x":"look_x","y":"look_y","sensitivity":1}`.

**Desktop rendering boundary:** voxel scenes currently use the same shared
JavaScript renderer inside QuickJS and copy its typed framebuffer into the
native window. Legacy grid scenes still use the Rust rasterizer. This keeps
voxel pixels and gameplay portable without claiming a native Rust voxel
backend. Volumes are bounded/in-memory, not streamed chunks or infinite worlds.

## Play Rune Miners

```sh
vectrune examples/rune_miners/rune_miners.rune -o html > rune-miners.html
vectrune test examples/rune_miners --type logic
```

Open the HTML. Choose Meadow/Ember and a seed, then explicitly begin.
WASD moves, mouse/arrows aim, hold click/E mines, Space jumps.
Gather **3 timber, 3 stone and 2 copper**. At camp, 1 crafts a pick
(2 timber + 3 stone, faster mining), 2 crafts a blade (1 timber + 2 copper,
stronger attacks), R recruits Mira (adds 4 damage per attack), and 3 rests.
The cyan flag marks camp. Follow the torch posts south past camp, then east
into the cave; its terraces descend to z=1. These are visual landmarks, not
collision obstacles or dynamic lights.

### Backpack and camp workbench

Press **I** (or touch BAG) for resources and four equipment slots: tool, weapon,
armor and charm. Select Equipment to browse owned/locked gear. **K** opens the
camp workbench; it cannot be used remotely. Use 1/2/3 to select, **N/V** to page,
and I to close. Browser overlays also have labeled buttons and scroll on mobile.
Menus freeze exploration and mining. Inventory inspection is allowed on the
player's battle turn, but gear swaps require exploration; enemy wind-ups and
practice cannot be interrupted by inventory.

| Recipe | Timber | Stone | Copper | Effect |
|---|---:|---:|---:|---|
| Stone pick | 2 | 3 | 0 | Mine every 9 ticks instead of 18. |
| Copper blade | 1 | 0 | 2 | Strike 9 / skill 15 damage instead of 4 / 8. |
| Copper mail | 0 | 4 | 3 | Reduce incoming damage by 3 (unguarded 13, guarded 1, dodge 0). |
| Heart charm | 2 | 0 | 2 | Maximum health 80 instead of 60; rest to fill it. |
| Copper pick | 0 | 2 | 3 | Mine every 6 ticks; requires a crafted stone pick. |
| Herb bundle | 2 | 1 | 0 | Two herbs; craft only when carrying at most four, maximum six. |

Crafting consumes the displayed costs and automatically equips gear. Gear
recipes can be made once; equipping owned items is free. Starter equipment
remains available to swap back to, including the empty charm slot. Removing
the heart charm clamps current health to 60; re-equipping does not heal.
Rest restores maximum health/focus and supplies at least two herbs, preserving
crafted extras. The original camp 1/2 shortcuts still craft the stone pick/blade.
The initial objective still targets those two items and Mira; other recipes
are optional upgrades, not new requirements to enter the cave.

### HUD and usability preferences

**O** cycles Guided (default), Compact and Minimal; **U** toggles larger
bitmap HUD text. The same labeled buttons appear above the scene and in Pause.
Guided shows the goal, resources and control hints. Compact removes the
exploration resource line; Minimal also removes the exploration goal.
Health/targeting remain, and every preset retains combat meters, turn cues,
focus/herb information and practice instructions. Larger text uses concise,
wrapped prompts and may abbreviate meter labels to H/G/I. Full material counts
remain in the browser goal readout or backpack/workbench. Preferences survive
fresh expeditions/return-to-title in the current page or process, **not reloads**;
there is no settings persistence.

The browser shell separates title setup, exploration tools and contextual
camp/player-turn/defense actions. Active-run restart is no longer a main
toolbar action; use Pause then Return to title. Defense buttons say to wait
before their actual timing windows. Sticky action docks keep current choices
reachable on small screens. Unavailable recipes show material shortfalls,
prerequisites, ownership or herb-cap explanations beside their effects.
Backpack/workbench use viewport-bounded, scrollable panels with a sticky Close
button and stop background scrolling. Opening a menu releases mouse capture;
I or browser Escape closes it, and clicking the scene recaptures mouse look.
Portable menus retain the I shortcut. Touch controls show movement/mining only
in exploration, action choices on the player turn (or at camp), and defense
on the enemy turn; menus hide/cancel the touch overlay.

Exploration shows a gold wireframe around the block in mining reach and names
its yield in the bottom prompt. Bedrock instead displays a protected prompt
with no mining frame. Successful mining emits a short, rising/dissolving chip
burst (12 ticks); rewards remain immediate and once per removed cell.
Brief mining/crafting notices expire rather than permanently covering terrain.
The objective counts **remaining** materials for uncrafted gear, including
materials already spent on completed recipes; when supplied it directs you to
craft, recruit, then follow the cave trail. Browser action buttons disable
unavailable recipes, already-equipped gear, unaffordable battle actions and
recruitment outside camp. Keyboard/gamepad/touch actions keep their explanatory
failure messages.

Approaching the guardian freezes exploration and starts turn combat.
The view switches to a wider, authored cave camera without moving the player;
retreat restores the exploration camera. The encounter leaves the guardian
uncovered by choice panels. At tick 40 it raises gold arms and changes eye/core
color, alongside a green impact bar and explicit GUARD NOW prompt. A defense
attempt changes the prompt to its result and disables the browser defense
buttons for the rest of that attack. The impact bar resets on the player turn.
1 strikes/builds focus, 2 spends two focus on a skill, 3 consumes an herb to
mend. Every action triggers a 50-tick wind-up. Each attack allows **one**
defense attempt: Shift guards on ticks 40-49 (damage 4 instead of 16,
+1 focus); Q dodges on ticks 44-49 (zero damage). Early presses fail; holding
a button does not generate repeated attempts. The impact bar and changing
prompt show when to act. Retreat keeps inventory but restores the guardian.
**B / Return to camp** also rescues miners from deep pits during exploration;
the protected camp floor cannot be dug away.

The guardian uses an ivory/gold model palette with bright cyan details,
separate from the darker stone terrain. The first encounter starts a safe
four-step lesson: **Strike, Guard, Skill, Dodge**. No health, focus, herbs or
guardian HP are spent during practice; guard holds at tick 40 and dodge at 44
until the correct input. Early/wrong inputs can be retried. **G** skips the
lesson; **H** replays it on a player turn or starts an optional camp practice.
Camp practice returns to exploration and never grants guardian rewards.
Practice completion at the real encounter starts actual combat on the next
player action. Real defense windows are not held open. A fresh expedition
resets lesson completion.

Reclaiming the Rune Heart wins. Pause freezes the battle timer and dissolving
death/mining effects. Victory and defeat show distinct outcome panels.
Returning to title resets terrain, inventory and party; there
is **no persistence yet**. First-slice scope: two seeded biome variants, one
cave, six recipes, one recruit and one guardian. Portals/realms, block
building, saved worlds and larger parties are future work, not implemented.

Sources: `runtime/rune-web/src/pixel3d/voxel.ts`, `model.ts`, `raycaster.ts`,
`engine.ts`, `src/apps/pixel3d/mod.rs`, `desktop.rs`,
`runtime/rune-web/tests/voxel.test.ts`, `tests/rune_miners_app.rs`,
`examples/rune_miners/miners.logic.test.rune`,
`miners.inventory.test.rune`, `miners.tutorial.test.rune`,
`miners.ux.test.rune`, `ux.rune`, `runtime/rune-web/src/pixel3d/hud.ts`,
`src/apps/pixel3d/hud.rs`, `runtime/rune-web/src/input/touch.ts`,
`tests/browser/rune_miners.py`.
