# Pixel 3D environments and Rune Crypt

`@App type = pixel-3d` uses shared Rune game logic with a browser raycaster or
the optional native desktop rasterizer. Vect Breach remains a separate example.

The opt-in `@Scene world` in v0.3.6 adds solid voxel terrain, elevation, mining,
seeded biome generation and cave geometry. See [Voxel worlds and Rune Miners](voxel-worlds.md)
for APIs, authoring, gameplay and the current shared-JavaScript desktop renderer.
The grid-map semantics below remain unchanged.

## Starfall Protocol: side-scrolling space adventure (v0.3.6)

[Play Starfall Protocol](https://vectrune.com/starfall/) or explore its
[Rune source](../../examples/games/starfall/starfall.rune). It is a space
metroidvania built on pixel-3d, with movement confined to one plane and a fixed
side-on camera. Explore Kepler Station, recover jump jets in the cargo bay,
enter the overgrown Hydroponics sector, unlock air dash, and restore its relay.
Return through the cargo shortcut, climb the western ledges with jump jets,
then air dash across the thirteen-tile gap to the plasma perch above the ship.
Jump jets alone cannot bridge this gap; a missed crossing lands on the lower
docking deck for another attempt. Plasma collection also requires the dash module.
With plasma, breach
the powered violet seal, restore the Gravity Foundry, defeat the Crypt Warden,
and carry its core to the ship. The station's 128 x 21 x 20 volume, the garden's
80 x 21 x 20 volume, and the Foundry's 96 x 21 x 20 volume use sparse terrain
chunks. The shared sparse factory supports up to 4,096 tiles on each horizontal
axis, subject to the logical-volume and resident-chunk budgets described below.

```sh
cargo build --bin vectrune
target/debug/vectrune examples/games/starfall/starfall.rune -o html > starfall.html
target/debug/vectrune test examples/games/starfall --type logic
cargo test --test starfall_app
python3 tests/browser/starfall.py
```

Open `starfall.html` and choose **Board station**. A/D or left/right arrows move;
Space jumps, left click or X fires (J remains an alternate), and W/Up aims vertically.
Hold S/Down to duck on the ground, move slowly and fire from a lower muzzle.
The crouched combat height is 0.85 tiles versus 1.6 standing: the Warden's leap
and high projectiles can pass overhead, while low bolts, grounded contact and
slam shockwaves still hit. Release or jump to stand; airborne ducking is disabled.
Controller right shoulder or left stick down ducks; on touch, push the movement
stick down to duck or up to aim.
Hold left click or X to charge plasma and release to fire; mouse firing does not
lock the cursor or change the side-on aiming direction. Jump jets unlock a second
press of jump in midair. P pauses and shows the map, V mutes, F toggles fullscreen, and Enter
starts an expedition. Controller left stick moves, A jumps, X fires, left shoulder
aims up, View/Back starts, and Start pauses. Touch supplies a movement stick,
Jump, Fire, and Pause. E uses nearby hatches; after collecting the air-dash module,
jump and press Shift/K for a brief horizontal burst. Dash is limited to once per
airborne trip and recharges on landing, with brief damage protection during the
burst. Controller B dashes and Y uses hatches; touch shows DASH after unlocking
it and USE only near an interaction.

### Exploration, optional upgrades and combat cues

The map appears only on the pause screen. P, controller Start/left trigger,
or the touch PAUSE button opens it. Gameplay freezes while paused; resume with
the same control. Cyan marks the pilot's room,
green marks explored rooms, red marks locked routes, and grey marks unknown rooms.
Restored shortcuts appear as dotted cyan links. Exploration is saved alongside
sector progression and survives game over. Old saves receive empty exploration
and upgrade fields through the existing shape-based save migration.

The starting upgrades occupy crypts reached through visible energy portals.
Use E/USE at the **PROPULSION CRYPT** gateway near cargo x=49 for jump jets.
Hydroponics' **DASH CRYPT** gateway is on the upper canopy at x=23.5, z=17:
climb past the repair pod, then double jump onto the four-tile-higher ledge.
Both gates stand on solid platforms; walking past one cannot teleport the pilot.
Each connects to a 56x21x24 crypt with descending steps, a guard, a solid item
pedestal and two return portals. Leaving without the upgrade returns beside its
gateway safely. Parent terrain, enemies, checkpoints and bosses stay preserved.
Animated energy fragments and six orbiting motes mark each gateway. Arrival adds
a short expanding, dissolving ring while the pilot and rifle materialize. Portal
animation follows the game clock and freezes while paused. A dedicated portal
sound accompanies the existing door chime.

Purple hatches lead to the optional Signal Archive (72x21x20) and the expanded
Gravity Observatory (96x28x20):

- **Signal Archive:** enter from the station's western middle ledge at x=33,z=10
  with jump jets and air dash. Climb, cross a thirteen-tile breach, then climb to
  the capacitor. It reduces plasma charge time from 24 to 18 ticks (0.8 to 0.6s).
- **Gravity Observatory:** enter from eastern containment at x=74 after acquiring
  the magnetic glove. Its console enables low gravity; combine jets and dash across
  the raised route to suit armor, adding two cells to the current maximum.
  Descend beyond the armor for the optional **Void Curator** chamber.

Both rooms have a return hatch at the entrance and another beside the reward.
They return to the original station entrance and preserve its enemies, bosses,
checkpoint and broken seals. Rewards are banked immediately and survive game over;
starting a new campaign after the ending clears them. Repair pods, beacons,
sector transitions and lethal recovery heal the upgraded maximum health.

Standard drones, spore skimmers and forge sentries brighten during their firing
windup and play a short lock-on cue. Approaching an enemy whose cooldown has
already elapsed grants a full 24-tick warning before its first shot. Directional
red edge markers point toward lateral damage sources for 20 ticks, supplementing
the existing flash and suit reaction. Ground and overhead impacts retain their
normal hit reaction without inventing a lateral direction.

### Hydroponics and connected sectors

The cargo hatch at x=52, beside the jump-jet bay, leads to a dark greenhouse of
glowing flowers, alien trees, hanging vines, glass shelves, and a broken canopy.
E/USE is press-edge triggered, so holding it cannot bounce between sectors.
Door transitions preserve the station's enemies, pickups, checkpoints, seal,
and Warden state; projectiles and transient effects are cleared between rooms.

Explore the western canopy for a repair pod, then use jump jets to climb to the
higher dash-crypt entrance. Use its portal for air dash, return to the upper ledge, and
combine jumping, jump jets, and dash to cross the
twelve-tile greenhouse breach. Four spore skimmers patrol the garden, with
animated wings, pollen deaths, and slower green projectiles. The **Rootheart**
miniboss telegraphs a vine eruption and fires spores; jump or dash to evade,
then shoot its exposed bloom. Its health bar and battle camera track the fight.
Fatal deaths restore an undefeated Rootheart's health, as with the Warden.

Defeating Rootheart reveals the garden relay. Collecting it powers the reactor
seal and opens a two-way shortcut between the eastern garden and cargo near the
first beacon. Plasma alone cannot break an unpowered seal. The relay also banks
Hydroponics completion, jump jets and air dash under `starfall-campaign-v1`.
Game over, returning to title, and browser reload preserve that completed sector
and its traversal gear. Plasma resets with a new attempt until the Foundry is
also completed and banked. The final reactor fight always belongs to the attempt.
Completed Hydroponics remains visitable
through either hatch. Winning and choosing **New campaign** clears the banked
sector for a fresh full adventure. Restricted storage falls back to session saves.

The greenhouse has its own bell/string exploration track and Rootheart battle
variation. The reactor crypt remains the finale; the existing ship opening,
three-life system, ghost recovery, plasma charging, and ending remain in use.

### Gravity Foundry

Past the violet seal, E/USE at the containment hatch (x=69) enters a furnace
hall of coils, pistons, iron columns and glowing pools. Entry requires the garden
relay and plasma. First inspect the **overhead carrier** at the west dock. Its scan
unlocks the service workshop above the entrance: backtrack with jump jets over
two upper ledges and recover the **magnetic glove** from its pedestal. Jump beneath
the carrier to grip its underside, then hang across the 27-tile furnace span.
Space releases into a jump; a short grace period prevents an immediate re-grab.
Without the glove, the carrier cannot catch or support the pilot. Pause and ghost
recovery freeze its motion.

At the far dock, E/USE at a gravity console switches between **normal and low
gravity**. Low gravity reduces acceleration from 0.035 to 0.012 tiles per tick
squared. Combine it with jump jets to reach the high gantry, eight tiles above
the dock. A second console in the lower arena lets you restore normal gravity
before the **Iron Cantor** fight. Watch its raised hammers, jump the pair of heat
waves, and release charged plasma while its furnace vent is open. The Cantor has
24 HP, a dedicated life bar, vent/hammer/hit animations, and a separate battle
score; fatal deaths reset an undefeated Cantor.

Collecting the Foundry relay opens a two-way cargo shortcut at x=58 and releases
the crypt bulkhead. The save adds `foundry` under the existing
`starfall-campaign-v1` key; older Hydroponics saves retain their completed garden
and start with Foundry incomplete. A banked Foundry restores the magnetic glove,
plasma, jump jets and air dash after game over or reload, and keeps both access
barriers open. The title, game-over screen and pause map explain saved progress.
**New campaign** after victory clears both saved sectors for a full replay.

The overhead carrier uses a game-authored grip range beneath its slab above the
static voxel terrain. Carry runs before player movement; hanging poses, a raised
glove and a magnetic contact effect show the attachment. Jumping detaches cleanly.
The background pistons animate visually; they do not collide with the pilot.
Foundry music pairs a 96 BPM mechanical exploration score with a 120 BPM Cantor
variation. Both use the existing portable synthesizer.

The title screen flies around Kepler Station using a separate looping camera.
Starting an expedition plays a 20-second introduction: the salvage ship leaves
the Helios Ark, shrinks to a distant light, and disappears while the mission
story scrolls. The Ark's failing starcore threatens its gardens and air supply;
the pilot must recover a replacement from abandoned Kepler Station. This leads
into the 3.6-second approach, thruster landing, and pilot disembarkation.
Returning with the core starts boarding and a four-second takeoff, followed by
a nine-second homecoming that restores the Ark's lights and a 23-second credit
roll, including **Game by Dave Thomas**. Victory follows the credits.
Enter, the controller's confirm button, or the touch **Skip** button advances
the introduction, homecoming, and credits. Pause freezes every sequence and
its music; movement and weapons remain locked until disembarkation. Original
title, mission, and homecoming scores use the shared synthesizer.

The reusable `ui.cinema` HUD supports up to 64 text `lines`, a pixel scroll
`offset`, normalized `top`/`bottom` clipping bounds (defaults 0.55/0.94), font
`scale` (1 or 2), line `spacing` (12–48 pixels), and a `fade` from 0 to 1.
The fade darkens the world beneath the letterboxed text, keeping the story
readable in both browser and shared desktop rendering. Starfall's cinematic
worlds, ship animations, and text timing are authored in
[`cinematics.rune`](../../examples/games/starfall/cinematics.rune).

After finding plasma, hold fire for 24 ticks (0.8 seconds; 18 ticks with the optional capacitor), then release to fire
a six-damage charged blast. The muzzle orb grows as it charges, the HUD displays
charge progress, and a sound signals readiness. Short taps release weaker shots;
only a fully charged projectile can break the violet seal. Charge cancels on
death and resets for a new expedition. A broken seal clears collision immediately,
then its visual shell shakes and dissolves over 36 ticks with fragments and a
small, brief camera shake. Pause freezes charge and seal animation.

The HUD starts with four suit-health segments and grows with permanent boss
containers and optional armor, turning red at two HP or less, plus
**three total lives**. Blue beacons repair the suit and set a respawn point;
they do not replenish lives. Ordinary hits reduce HP in place and grant brief
protection. A depleted suit loses one life, collapses through two death poses,
and dissolves. While lives remain, a cyan ghost floats back to the saved beacon
with a trailing signal and a smoothly following camera. The suit rebuilds there
automatically with full HP and protection. Falls use the same recovery sequence,
costing two HP and preserving the remainder; a fall consumes a life only if fatal.
Combat freezes during recovery; pause also freezes the ghost. Upgrades, broken
seals, defeated enemies, and the recovered core survive the first two deaths.
The third death finishes its collapse and opens **Game Over**. Enter or **New
expedition** resets attempt progress, checkpoints and bosses, restores three
lives, and replays the landing. Completed sectors and their gear remain banked;
the button reads **Continue campaign** when that save is available. Returning to
title also preserves completed sectors. Beyond containment, jump up two temple steps to an
overlook beacon, then descend five tiles into a broad sanctuary lined with
stone columns, cyan braziers, a wall sigil, and a raised core altar. The exit
steps are climbable with jump jets, including on the return trip.

The larger **Crypt Warden** has 48 life, an illustrated portrait and a dedicated
life bar. Descending to the sanctuary floor wakes it. Four walking poses animate
patrol and recovery; raised arms telegraph a marked leap, a crouching landing
releases shockwaves in both directions, and moving ribs animate its exposed-core
breathing. Avoid the marked landing spot, jump the slam wave, then fire during
the cyan-core phase. Armor blocks shots outside that phase. The camera widens
and frames both combatants. A fatal player death restores an undefeated Warden
to all 48 HP, its home position, and its dormant phase for a fresh fight.
Nonfatal hits and falls preserve boss damage. A defeated Warden stays defeated
through the remaining lives. Defeating it reveals the core on the eastern altar. Recovery
alone does not win; climb back out and return the core to the docking bay.

The Warden's death arms three one-shot security encounters for the return trip.
After collecting the core, crossing x=116, 74 and 46 spawns one **hunter** and
one **deck crawler** in the crypt, containment and cargo areas respectively.
Hunters flash an orange windup before a directed flying lunge; crawlers animate
their legs, stop to charge, then fire a low bolt that can be jumped. Both have
distinct damage flashes and particle deaths, and charged plasma kills either
in one hit. Distant enemies remain idle until the pilot approaches. Encounter
flags and defeated enemies survive ghost recovery and sector trips for the
current expedition; a fresh expedition clears them. There is no escape timer.

Models, textures, synthesized effects, music, HUD, and game logic are authored
in Rune. The pilot has layered armor, a reflective visor, an oxygen pack, a
four-frame walk cycle, airborne and upward-aiming poses, and an independently
recoiling rifle. Drones animate their thrusters; the guardian's shutters open
around its exposed core. Damage flashes brighten the pilot and enemies, while
enemy deaths throw sparks and spinning armor fragments through expanding blast
rings. Particles expire automatically and are capped at 96. Jump jets leave a
short cyan exhaust trail. The original eight-bar, 72 BPM E Phrygian score layers
low bass pedals, sustained string chords, sparse bell echoes, and tom percussion.
A separate eight-bar, 132 BPM battle variation brings brass, driving bass and
heavier percussion when the Warden awakens. It continues through the fight without
restarting each tick. Defeat, leaving the arena, or ghost recovery restores the
exploration score; re-entering an unfinished fight starts battle music again.

The browser and QuickJS regression share an input-only route through
the complete expedition, render its major milestones, and verify a round trip
without losing a life. Browser checks also cover keyboard, controller, touch, pause, and
replay; presentation fixtures render aiming, recoil, walking, airborne poses,
hit flashes, drone debris, and the guardian explosion. The route renders every
boss phase, checks its life bar against damage, and completes both the temple
descent and return ascent with real movement inputs. Recovery fixtures check
the life bar, collapse, ghost travel, pause, camera continuity, automatic rebuilding,
and equipment retention. Logic scenarios also cover nonfatal hits and falls,
equipment gates, effect expiry, and restart cleanup.
Weapon fixtures cover hold/release behavior, charged-projectile seal gating,
the dissolving wall, pause, and cancellation on death. Browser checks also sample
the actual boss synthesizer output for nonzero audio energy.
Lifecycle fixtures render the title flyover, introduction, landing,
disembarkation, boarding, takeoff, homecoming, credits and Game Over. They verify
natural cinematic completion, skipping, pause, three deaths, boss healing, and
a complete expedition reset.
Garden scenarios cover door debounce, preserved station state, dash gating and
recharge, relay progression, miniboss armor and death reset, and saved gear after
game over. The browser regression also reloads the real saved campaign and checks
the actual keyboard and touch hatch/dash adapters.
Foundry scenarios cover entry gating, magnetic carry and jumping off, console
press-edge behavior, save migration, banked glove/plasma and released bulkheads,
and Cantor armor and death reset. The shared browser/QuickJS route rides the
shuttle, verifies pause freezes it, performs the low-gravity ascent, defeats the
Cantor and returns through the shortcut before continuing to the crypt.
Return-enemy fixtures exercise the Warden death hook, core gating, all three
waves, hunter lunge and crawler charge/shot phases, pause, damage flashes,
particle deaths, recovery without duplicate spawns, and restart cleanup. The
input-only campaign route completes the return journey with all six spawned.
Enemy patrols and lunges sweep their animated bounds against terrain, including
wings/thrusters; crawlers also require ground beneath both feet. The greenhouse
skimmer over the raised terrace starts at its correct deck height. Movement
fixtures scan complete patrol cycles in all three sectors, test wall tunneling
and platform edges, and compare standing versus crouched Warden contact and
projectile damage. Keyboard, controller and touch ducking use the real adapters.

## Skybound: third-person platforming (v0.3.5)

[Skybound](../../examples/games/skybound/skybound.rune) is an original, Mario-inspired
3D platform game built in Rune: six floating islands, twelve collectible coins,
three patrolling bugs to stomp, three hearts, a blue checkpoint flag, and a
golden summit star. Coins are optional for victory and remain collected after a
fall. Reaching the flag refills hearts; losing all three ends the run. A new
adventure resets everything. Progress is session-only.

Build the current CLI from source, then export a self-contained browser game:

```sh
cargo build --bin vectrune
target/debug/vectrune examples/games/skybound/skybound.rune -o html > skybound.html
target/debug/vectrune test examples/games/skybound --type logic
```

Open `skybound.html`, then select **Begin adventure** or press Enter with the
canvas focused. WASD/arrows move relative to the camera; Space jumps; Shift
runs; Q/E orbit; R centers the camera behind the character. P pauses, F toggles
fullscreen, M toggles sound. Gamepad left stick moves, A jumps, X runs, and
right stick/shoulders orbit. Touch has a movement stick, jump/run buttons and
camera buttons. Jump near the edge for wide gaps; land on bugs from above to
bounce. The authored course is fully traversable at walking speed.

The scene binds `camera` separately from its visible `avatar` model. Game
logic smooths the elevated orbit camera and acceleration, implements press-edge
jumping, and animates the character, coins and enemies. Camera placement is
bounded to the voxel volume and looks toward the player; the open course is
authored with camera clearance. This is an example of a game-authored follow
camera, rather than a general camera collision solver. `mouse_look = false`
keeps the pointer free in browser and desktop hosts.

Skybound uses [optional voxel movement tuning](voxel-worlds.md#volume-tools-and-movement)
for a higher jump arc and to disable automatic ledge stepping. Existing voxel
games retain their movement defaults. Models, voxel depth, synthesized effects,
and the original chiptune use the shared browser/QuickJS runtime. The source
includes logic scenarios; `tests/browser/skybound.py` traverses the full course
with real inputs and checks desktop/mobile controls, and `tests/skybound_app.rs`
checks QuickJS rendering without opening a window.

## Skybound 2: Beyond the Concept (v0.3.5)

[Skybound 2](../../examples/games/skybound_2/skybound_2.rune) is a separate campaign;
the original Skybound sources and exported game remain intact. Its protagonist
is **Nix, a lantern moth** with six feet, antennae, folding wings and a glowing
abdomen. Hold jump while descending to glide. Movement, camera orbit, running,
keyboard/controller/touch controls and a portable HUD build on the first game.

Its art uses sixteen 16x16 palette textures with authored grass tufts, ceramic
seams, moonstone veins, leaf patterns and ice facets. Each biome pairs its
walking surface with a matching lower cliff material. Code-native block models
add patterned ivory wings, reflective eyes and a lantern abdomen to Nix, with
alternating walking feet and a spread-wing glide pose. Lantern cages, branching
crystals, layered trees and segmented boss armor share the same palette style;
the bosses expose bright cyan cores during recovery. Models contain at most 37
boxes and continue to use the CPU renderer.

All seven destinations now mix broad landing areas, slim ledges, elongated
islands and connected shelves, with tapered undersides on larger islands.
Two bonus stepping stones in each world form an optional three-seed detour.
The campaign contains 45 squashable creatures: slow reed grubs, faster ember
crabs and crystal hoppers with a periodic jump. Patrol endpoints stay on solid
ground, with room to land before engaging. Descend onto a creature to flatten
it and bounce; holding jump gives a higher bounce. Side contact costs a heart
and returns Nix to the current checkpoint. Flattened creatures become harmless
immediately and disappear after a short delay. A per-attempt HUD counter tracks
stomps; defeated creatures stay defeated through checkpoint respawns and reset
when entering a destination again. Boss arenas retain their dedicated encounters.

The 3D **Lantern Atlas** connects seven authored destinations, unlocked in order:

| Destination | Challenge |
| --- | --- |
| Reedwake Reach | Eight reed islands, first flights, a beacon checkpoint and an extended southern ascent. |
| The Cinderworks | Six furnace platforms, a longer approach and **Kilnback**, a charging ceramic beetle. |
| Moonglass Tide | Eight crystal islands winding north, east and south, with a high eastern summit. |
| Sunken Canopy | Eight treetop islands, hanging lantern groves and broad glide crossings. |
| Aurora Causeway | Nine icy switchbacks climbing to the highest lantern in the campaign. |
| Emberglass Relay | Eight alternating furnace/glass islands around a winding relay route. |
| The Storm Roost | A seven-island final ascent and **the Tempest Regent**, a mechanical storm owl. |

Select with 1-7, arrows, N/V, controller D-pad or destination buttons; Enter
or controller Back/View enters. In a level, WASD/arrows move, Space/controller A
jumps and glides, Shift/controller X runs, Q/E/right stick/shoulders orbit,
and R centers the camera. Touch has MOVE, FLY, RUN and camera buttons.
Escape exits fullscreen, including CSS fallback fullscreen in restricted embeds
and when focus stays on a toolbar button; it also releases the game's mouse lock.
**P pauses; B or Return to atlas leaves the attempt from Pause.** Returning to
the atlas resets the current attempt. Four hearts and amber seeds belong to
the attempt; restored lanterns and best seed counts from completed destinations
persist with the separate `skybound-2` save key. Completed stages remain
replayable, including after the ending. The four original levels have longer
approaches or exits, and level volumes now span 48 x 40 x 20 tiles. Each new
destination has its own layout, material, sky, props, seed trail, checkpoint
and variation of Nix's theme.

**Existing four-level saves migrate automatically:** the old Storm Roost clear
and best score move to slot seven, while the first three slots stay intact.
Players who finished the original campaign can enter all three new destinations;
players who had unlocked the old finale continue at Sunken Canopy. Completed
lanterns and best scores are preserved, and the atlas selects the first available
uncleared destination. Browser storage restrictions fall back
to session saves; native hosts use the existing game save directory.

Kilnback marks a target, charges to that locked position, then opens its blue
core. Dodge the charge and land on the open core from above three times.
The Regent telegraphs an expanding red ground wave; jump or glide over it,
then stomp its lowered crown during recovery, four times. Both have an armored
phase, a distinct recovery model, stagger protection and faster late attacks.
Boss cameras widen and frame both combatants. Beacons refill hearts, and boss
arenas provide a nearby checkpoint. Falling/contact costs a heart; defeat
retries the selected stage while preserving campaign progress.

```sh
cargo build --bin vectrune
target/debug/vectrune examples/games/skybound_2/skybound_2.rune -o html > skybound-2.html
target/debug/vectrune test examples/games/skybound_2 --type logic
python3 tests/browser/skybound_2.py
```

The browser regression traverses the entire campaign and defeats both bosses
with movement/jump inputs, without changing player positions or progress.
It also samples actual synthesized audio, reloads campaign saves, and checks
keyboard, controller and touch glide. `tests/skybound_2_app.rs` compiles the
score and renders each destination in QuickJS without opening a window.

### Reusable music sections and arrangements

The sequel's ten original arrangements share Nix's rising-fifth leitmotif:
an atlas theme, seven exploration scores, and two faster boss variations.
Brass leads, string harmony, plucked arpeggios and bells use the same synth in
browser and native hosts, with no downloaded audio. The shared music engine
now supports reusable named sections and ordered/repeated song forms:

```rune
@Music/flight
tempo = 128
time_signature = 4/4
loop = true
volume = 0.1
instruments = {"lead":"brass","harmony":"strings","bells":"bell"}
sections = {
    "verse":{"bars":1,"lead":"D5:4 A4:4 B4:4 D5:4","harmony":"[D4,F#4,A4]:1"},
    "chorus":{"bars":2,"lead":"A5:1 D5:1","bells":"D6:1 A5:1"},
    "bridge":{"bars":1,"harmony":"[G4,B4,D5]:1"}
}
arrangement = ["verse",{"section":"chorus","repeat":2},{"section":"bridge","repeat":2},"chorus"]
```

Each section declares integer `bars` (1-64) and channel-to-note-string fields;
channel names are arbitrary, with `lead`, `bass` and `drums` retaining their
defaults. Short or absent channels are padded with rests so all section
boundaries align. Phrases exceeding their section duration fail during runtime
registration, before playback. Compiler checks reject missing names, invalid
repeats or metadata, unknown instruments and ambiguous forms. Repeats accept
integers 1-16; there may be 1-32 sections, 1-128 cues and at most 512 expanded
bars, in `4/4` or `3/4`. Section channels accept up to 16 tracks per section.
Use either legacy top-level `lead`/`bass`/`drums`/custom tracks and `bars`, or
`sections` plus `arrangement`; put all arranged note content inside sections.

`instruments` maps channels to `square`, `sine`, `triangle`, `bass`, `sawtooth`,
`synth`, `pluck`, `drums`, or the new `brass`, `strings`, and `bell` voices.
It also works on legacy songs. Arrangements expand once at registration and
share the existing hardware-clock scheduler, pause, resume, mute and looping.
`loop = true` repeats the complete arrangement. Non-looping scores let the
final note finish before stopping. Existing songs retain their syntax and
instrument defaults. See [the complete score](../../examples/games/skybound_2/sound.rune),
`runtime/rune-web/src/music_arrangement.ts`, and `tests/music_arrangement.rs`.

## Camera movement performance (v0.3.5)

The shared JavaScript block-model renderer now rejects boxes wholly behind the
camera near plane before scanning pixels. Previously any behind-camera corner
selected conservative full-screen bounds, including when **all eight corners**
were behind the camera. Camera orbit could consequently trigger a full-frame
ray/box scan for every hidden model block. Boxes crossing the near plane and
views from inside models keep their conservative rendering.

Homogeneous side, top and bottom frustum tests also reject boxes entirely
outside the view, including off-screen boxes that cross the near plane. This
avoids unnecessary full-frame scans for nearby scenery during camera orbit.

Model rays use scalar components instead of temporary arrays per pixel, and
face colors are shaded once per block. Terrain rendering reuses a scratch hit
record, while gameplay targeting continues to return independent hit objects.
Voxel traversal advances a flattened cell index along with its x/y/z position
instead of recalculating the index at every cell. These changes apply to browser
and shared QuickJS rendering, including the original Skybound and voxel games.
They preserve resolution, simulation timing and model/terrain depth semantics.

`tests/browser/pixel3d_performance.py` measures 80 CPU render calls around each
of three 40-angle camera orbits in Skybound 2. Its reports contain median, p95,
worst-case timings, optional Chromium CPU samples and sampled color/depth
buffer hashes. Compare exports of the same game on the same browser/machine:

```sh
python3 tests/browser/pixel3d_performance.py --html before.html --output before.json --profile
python3 tests/browser/pixel3d_performance.py --html after.html --output after.json --profile --compare before.json
```

Local headless Chromium measurements at 432x270, with CPU profiling enabled:

| Orbit | Median before / after | p95 before / after |
| --- | --- | --- |
| Reedwake start | 37.9 / 25.4 ms | 108.7 / 30.1 ms |
| Canopy trees | 69.6 / 26.5 ms | 151.7 / 32.5 ms |
| Storm arena | 35.2 / 25.2 ms | 121.0 / 34.5 ms |

All 24 sampled color/depth hash pairs matched. These are renderer measurements,
excluding simulation and browser presentation, and are reports rather than CI
timing thresholds. Regression tests check behind-camera geometry access counts,
near-plane/inside-model visibility, DDA traversal in both directions, and hit
record ownership. After these changes, voxel traversal is the dominant sampled
cost.

### Empty-space acceleration and contiguous terrain writes

A second CPU pass adds a 4x4x4 occupancy grid for sparse voxel worlds. Coarse
traversal rejects empty rays and advances toward the first potentially occupied
chunk; fine DDA still resolves the final voxel, face and depth. Near-coincident
chunk boundaries conservatively use fine traversal. Prefix clock increments
retain the original floating-point additions so sampled depth buffers remain
bit-exact, including edge and corner hits.

Occupancy originally rebuilt each rendered frame; the incremental snapshot
validation described below now updates affected chunks while still detecting
mining, `voxel_fill`, direct cell edits, cell-array replacement and resized volumes.
Dense volumes retain regular DDA. Terrain color/depth
buffers are written in row order, and below-horizon sky pixels use the exact
opaque horizon color without cloud noise or longitude calculations.

Fresh local Chromium measurements at 432x270, without CPU profiling:

| Orbit | Median before / after | p95 before / after |
| --- | --- | --- |
| Reedwake start | 24.6 / 16.0 ms | 29.3 / 21.4 ms |
| Canopy trees | 26.1 / 15.8 ms | 31.0 / 21.2 ms |
| Storm arena | 25.1 / 14.8 ms | 34.3 / 20.7 ms |

The same 24 sampled color/depth hash pairs matched. Seeded traversal tests
compare accelerated and ordinary hits exactly across 12,000 rays, non-aligned
volumes, both directions, tied boundaries and very small direction components.
Geometry-read tests verify that empty regions are skipped without unstable
wall-clock assertions. These remain CPU renderers in browser and QuickJS.
A future GPU backend should explicitly retain CPU fallback for unavailable
adapters, initialization failures and device/context loss; GPU fallback is not
implemented by this CPU optimization pass.

### Shared camera rays and exact voxel crossings

Starfall's starting-platform descent exposed CPU terrain costs while the camera
tracks downward. Unpitched voxel cameras now share horizontal ray components
and reciprocals by screen column, and vertical components by row. Each renderer
owns bounded typed-array caches keyed by its depth buffer; rotation, FOV and
resolution changes rebuild the appropriate data. Pitched cameras keep the
general ray calculation path.

Empty-space traversal can also reuse per-axis voxel-boundary crossing tables.
The tables use the same repeated additions as ordinary DDA, preserving floating
point depth values. An estimated crossing index is corrected against those exact
values before resuming fine traversal. Only axes whose camera position or ray
configuration changed need their tables rebuilt. Coarse and fine traversal check
volume exit on the stepped axis. Terrain snapshots detect edits on validation,
so direct cell edits, mining and fills remain visible; these ray caches
contain ray geometry rather than terrain. At Starfall's 432x270 resolution the
ray and crossing tables use about 572 KiB for its station world.

Local headless Chromium measurements at 432x270, comparing the same Starfall
content before/after this pass (CPU rendering only, excluding browser presentation):

| Scene | Median before / after | p95 before / after |
| --- | --- | --- |
| Starting-platform descent | 20.5 / 18.0 ms | 22.8 / 20.5 ms |
| Cargo | 21.8 / 19.0 ms | 22.3 / 19.2 ms |
| Hydroponics | 26.4 / 19.0 ms | 26.6 / 19.3 ms |
| Gravity Foundry | 24.9 / 20.0 ms | 25.2 / 20.2 ms |
| Crypt Warden | 26.1 / 19.8 ms | 26.4 / 20.0 ms |
| Heavy explosion | 26.1 / 19.6 ms | 26.2 / 19.8 ms |
| Rotating station camera | 16.9 / 15.4 ms | 21.0 / 19.8 ms |

All 63 sampled Starfall color/depth hash pairs matched. A separate Skybound 2
pitched-camera orbit comparison retained all 24 sampled pairs, with timings
within a few percent of baseline. These measurements describe local rendering
cost, not guaranteed end-to-end frame rates or CI timing thresholds. The heavier
descent samples remain above the 16.7 ms budget for 60 FPS.

```sh
python3 tests/browser/starfall_performance.py --html before.html --output before.json
python3 tests/browser/starfall_performance.py --html after.html --output after.json --compare before.json
```

The benchmark includes a simulated dock descent, static sector/combat views,
and a rotating camera. Regression tests compare cached depths directly against
scalar rays across camera movement and world-dimension changes, check cache
refresh after pitch/FOV/viewport changes, and retain the existing boundary-ray,
mining and terrain-edit coverage. Full Starfall browser and shared QuickJS
campaign checks exercise the optimized renderer.

### Incremental terrain metadata, expression scopes and presentation reuse

Legacy flat-array voxel validation retains a per-world typed snapshot and per-chunk population
counts. It scans cell values to detect arbitrary writes, including writes through
an alias captured before validation, but validates changed IDs and updates only
affected chunks. Material-count changes revalidate IDs; dimension changes rebuild
the snapshot. Invalid data discards its partial snapshot. This retains direct
array-write compatibility without a Proxy on every ray/voxel access. A rendered
engine frame consumes the metadata from its immediately preceding validation,
avoiding a second full terrain scan. Standalone renderer calls still inspect
their world, and mining/fill/read APIs retain validation.

Synchronous pixel-3d actions copy only potentially referenced names when building
an expression scope. The bounded lexical-name cache preserves snapshot values
and local > derived > state precedence. Games with helpers keep complete scopes,
because a helper may implicitly read caller locals. Regular web apps retain the
existing full-scope behavior. Tests cover scope shadowing, snapshot values and
helper fallback.

Browser and shared-renderer desktop hosts use `frameIfChanged()` to reuse the
framebuffer between simulation updates. Ticks, actions, start/restart and pause
changes invalidate presentation. Audio pumping, controls and host UI keep running.
Public `frame()` still always renders; tooling that directly edits state outside
an action/tick can call `invalidateFrame()` to request host presentation. This
keeps the original simulation cadence and animation steps while avoiding duplicate
CPU rasterization and browser framebuffer uploads.

In a local paired Chromium sample with identical Starfall content, median descent
simulation time fell from 4.3 to 1.1 ms, with p95 from 5.8 to 1.5 ms. Median render
time was approximately unchanged at 18.7 versus 18.6 ms; these changes primarily
reduce simulation and redundant-frame work. All 63 sampled color/depth pairs
matched. Game additions are measured separately from this engine-only comparison.
The full browser campaign, shared QuickJS campaign and desktop-feature compile
also cover the expanded game.

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
See [the compact texture assets](../../examples/games/rune_crypt/assets.rune) and
[authored map variety](../../examples/games/rune_crypt/maps.rune).

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

For a floating course, add an opaque `"below"` color to the sky object and
omit `floor`. The sky then extends beneath the horizon with a second gradient
and two cloud layers that drift at different speeds. Models can still appear
below world height zero, as in [Marble Run](../../examples/games/marble_run/).

## 3D tethers

Add `tethers = ["leash"]` to a gameplay or title `@Scene` to read a tether
from logic state. A path can also name a list of tethers. Each tether lists
two to 32 world-space points, a radius in tiles (.002 to 2), and an RGB
integer color. Set `visible = false` or use null state to hide it.

```rune
leash = {"points":[[2,1,0.9],[3,2,0.5]],"radius":0.04,"color":13292015,"slack":0.2}
```

With two points, `slack` lowers the midpoint by the given number of tiles
(0 to 32). Use three or more points for an authored bend, tow line, or a
whip or swing whose motion is calculated in game logic. The engine draws
rounded segments with world depth, including palette outlines. It does
not solve tension, collisions, or swing physics. CPU and GPU rendering
use the same sampled path. The native desktop host uses the shared CPU
renderer for scenes with tethers. [Dog Walker](dog-walker.md) updates a
leash between the walker's hand and the dog's collar.

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

An optional `ui.map` draws a portable exploration diagram. It contains `current`
(a node ID), `expanded` (boolean), up to 24 nodes and up to 48 links. Nodes have
unique `id`, `label`, normalized `x`/`y` in 0..100, `visited` and `locked` booleans.
Links name `from`/`to` node IDs and may set `shortcut = true` for a dotted cyan
connection. Expanded maps label rooms; compact maps show their state and current
position. `ui.damageDirection` accepts -1, 0 or 1 for left, no cue or right impact.
Both work with the floating HUD. Native scenes using a map select the shared
renderer so the diagram matches browser output, including pause maps.

`@Scene ui = ui` binds a **declared top-level logic state field** to a portable
HUD in both browser and native rendering. It takes precedence over
`presentation`'s legacy HUD; games without `ui` keep their existing rendering.
Refresh the object in actions when resources, status, or nearby interactions
change. Rune Crypt's [UX logic](../../examples/games/rune_crypt/ux.rune) is a complete
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

**Customization (v0.3.6):** optional `textScale` accepts `1` (default) or `2`.
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

**Floating icon HUD (browser/shared QuickJS):** set `style = "floating"` on the
HUD object to draw directly over the world, with outlined text and pixel icons
instead of opaque background strips or a crosshair. Meter `icon` and `emptyIcon`
fields reference ordinary Rune `@Sprite` assets; the HUD's optional `noticeIcon`
does the same. Sprite palettes own every pixel's color, outline and transparency.
There are no built-in icon names or renderer-owned icon artwork. Unknown sprite
references report an error.

Meters default to `display = "counter"`. Use `display = "pips"` with `icon` and
`emptyIcon` to show up to sixteen full/empty resource icons (wrapping within the meter slot), or `display = "bar"`
for an icon counter with a compact bar. Pips require an integer maximum of 1–8.
Use an empty label and `showValue = false` on a floating bar to display only
its icon and gauge.
The layout uses the actual sprite dimensions and draws at integer scale; small
icons around 8–12 pixels work well. Meter `color` controls bar fill; icon colors
come from their palettes.

For example, Skybound 2's [hud.rune](../../examples/games/skybound_2/hud.rune) owns its
six HUD sprites and palette. Its [UX logic](../../examples/games/skybound_2/ux.rune)
selects the resources and display modes:

```rune
{"label":"NIX","icon":"beyond/hud/heart","emptyIcon":"beyond/hud/heart_empty","display":"pips","value":hearts,"max":4,"color":16740754}
```

Edit the Rune sprite's `pixels:` rows to redraw it, or its `@Palette` colors to
recolor it. Import the asset file from the game's entry point as usual. The same
assets work in the normal and pause HUDs, browser exports and shared QuickJS
desktop host. The standalone Rust rasterizer retains the standard meter layout.

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
The opt-in `data-pixel-menu=true` on a shell menu clears held
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

### Context-sensitive touch controls (v0.3.6)

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
exports the game from `examples/games/rune_crypt/rune_crypt.rune`; site builds require
0.3.4 or newer so older embedded renderers cannot silently omit engine features.

```sh
vectrune examples/games/rune_crypt/rune_crypt.rune -o html > rune-crypt.html
vectrune test examples/games/rune_crypt --type logic
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
[`sound.rune`](../../examples/games/rune_crypt/sound.rune): `crypt_title` (84 BPM,
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

[`weapon.rune`](../../examples/games/rune_crypt/weapon.rune) animates 24x24
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
See [`combat.rune`](../../examples/games/rune_crypt/combat.rune) and the
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
[game](../../examples/games/rune_crypt/rune_crypt.rune),
[combat](../../examples/games/rune_crypt/combat.rune),
[exploration and builds](../../examples/games/rune_crypt/exploration.rune),
[portable HUD](../../runtime/rune-web/src/pixel3d/hud.ts),
[native HUD](../../src/apps/pixel3d/hud.rs),
[UX and choice state](../../examples/games/rune_crypt/ux.rune),
[logic scenarios](../../examples/games/rune_crypt/crypt.logic.test.rune),
[browser regressions](../../tests/browser/rune_crypt.py),
[compiler/raster tests](../../tests/pixel3d_app.rs).

## Declarative cameras and cinematic title scenes (v0.3.6)

Vect Breach's [title scene](../../examples/games/vect_breach/title.rune) demonstrates
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


## Sparse worlds and nearby actors

Large authored terrain can use `voxel_world(...)`; see
[voxel worlds](voxel-worlds.md) for dimensions, chunk budgets and save format.
`@Scene render_radius = 96` optionally bounds entity rendering around the camera.
Without it, sparse worlds use their `renderDistance`; legacy scenes keep their
existing visibility. Culling includes model bounds and entity scale, so a large
model crossing the radius remains visible.

Real-time game logic can use the shared `entity_group` and `nearby` expressions
in either pixel engine:

```rune
action start:
    enemies = entity_group()
    enemies.push({"x":10,"y":8,"z":3,"visible":true,"model":"game/guard"})
action tick(input):
    for enemy in nearby(enemies, player, 28):
        call update_enemy enemy
```

`entity_group([entities])` returns an array-compatible, owned collection with
persistent 16-unit spatial buckets. It shallow-copies incoming ordinary records;
use the returned records for subsequent mutations. Duplicate records within an
import remain duplicates referencing the same owned entity. Push/pop, splices,
indexed replacements, position/visibility changes and scale changes update or
invalidate the index. Rewrap a JSON-restored array with `entity_group`.

`nearby(collection, origin, radius)` returns visible entities within an inclusive
Euclidean radius, preserving collection order and duplicates. An origin with
`z` uses 3D distance; an origin without `z` uses 2D distance. Coordinates and
radius must be finite, radius nonnegative. Ordinary arrays also work: they are
indexed once per synchronous tick and reused for queries in that tick. Managed
groups retain their index across ticks and are preferred for large populations.
Their movement journal is bounded and safely rebuilds an index if it falls behind.
Rendering queries declared collections directly, so managed scenery/enemies do
not require a full coordinate scan every frame.

Sleeping is explicit game logic: use a radius with margin beyond the visible
screen, update local actors, and keep campaign state, quest timers and transient
cleanup running. Projectiles should query actors around the projectile rather
than reuse the player activation list. Starfall uses 28 tiles for enemy AI,
24 for pickups, and 2 around each projectile. Waking enemies restart their attack
telegraph to avoid an immediate surprise hit. Skybound, Skybound 2 and Vect Breach
also use local enemy updates. Turn-based games retain their existing turn rules.


`python3 tests/browser/chunks.py` reports browser scaling with identical nearby
terrain at widths 256, 1,024 and 4,096, and nearby actor updates with populations
10,000 and 100,000. It asserts equal color/depth hashes, equal resident chunk
counts and equal active actor counts; timings are diagnostic, not CI thresholds.
On a local Chromium run, these worlds each allocated 48 chunks and rendered the
128 x 80 fixture in about 2 ms. Both actor populations updated 15 local actors.
Starfall's 432 x 270 dock descent simulation median fell from about 1.1 ms to
0.7 ms. Rendering retained exact sampled color/depth output, with modest remaining
lookup overhead (roughly 0.6–1 ms in static views, more during camera rotation).
These measurements describe this fixture and machine, not a frame-rate guarantee.


Gap chevrons have distinct left/right block models so the face stays readable
from the side camera. The western plasma jump points left; greenhouse and
optional-room crossings point right. The jet and root tunnels are 56 tiles long
and 24 tiles high, with seven tiles of clear space over each descending step.
Their guards patrol an open approach bay, have 2 HP, and remain 15 tiles from the
upgrade pedestal. The final chamber has extra landing space and a return portal.


Hydroponics extends to depth 26 to frame its upper canopy and ghost return.
The old dash hole on the low shelf is solid floor. Its new gateway stands on the
z=17 ledge beyond the repair pod; a four-tile rise requires the second jump.
The portal bay has a roof and east bulkhead, with a spacious underpass to the
lower dash approach, keeping jump jets from bypassing the main breach.

## Browser viewport fitting and Starfall touch layout

Each Pixel 3D game sets its default framebuffer size with `@App resolution`.
A browser shell can add `select data-pixel-resolution=true` with option values
such as `"384x240"` and `"768x480"`. Use the app's aspect ratio for each option.
Changing resolution rebuilds the framebuffer and scales the HUD to keep its
on-screen size. The simulation continues at its authored tick rate.

A `select data-pixel-palette=true` can offer `original` and options containing
2 to 16 comma-separated six-digit RGB colors, without `#`, ordered from
dark to light. The renderer maps each finished pixel by brightness to the
selected color ramp. [Marble Run](../../examples/games/marble_run/shell.rune)
uses both controls.
Add `data-pixel-outline=true` to a palette option to draw depth-based
silhouettes in its darkest color. Marble Run uses it for the Pocket palette.

Marble Run also opts into an experimental WebGL 2 backend with
`input data-pixel-gpu=true`. It draws model geometry and the procedural sky
using cached meshes and shaders, with the shared HUD layered on top. The
experiment supports scenes built entirely from models over a sky with
`below` set. A browser that lacks accelerated WebGL 2 keeps the CPU renderer.
The `data-pixel-fps` readout measures frames drawn by the active backend.
A `select data-pixel-frame-rate=true` can offer `simulation`, `60`, and
`display`. These draw at the simulation rate, cap rendering at 60 FPS, or
draw on every browser animation frame, respectively. The browser and display
still limit the last mode. Simulation always uses the authored tick rate.
At higher render rates WebGL interpolates camera and model poses between
simulation ticks, batches copies of each model, and retains the HUD until
it changes.

A Pixel 3D shell can opt a canvas into `data-pixel-fit=viewport`. In fullscreen,
the browser host resizes the render target to the available aspect ratio while
keeping approximately the selected pixel count and preserving the vertical
field of view. Wider phones show more world horizontally, with no cropped HUD
or stretched models. Leaving fullscreen restores the selected resolution, or
the authored resolution if there is no dropdown.
Shell CSS must let the fullscreen canvas fill its surface; canvases without the
attribute keep their existing aspect ratio. This presentation option is in the
current website runtime; it does not change desktop game rules or save data.

Starfall keeps Start inside the fullscreen surface. Its touch stick moves,
aims upward, and ducks; Jump and Fire stay in a compact lower corner. Dash
appears after unlocking it, and Use appears only near an interaction. Pause
opens the map. Fullscreen keeps a small EXIT button visible, including during
the title and story scenes. Portrait fullscreen shows a two-line rotation hint.

Opt-in `data-pixel-touch-padding=14` expands touch targeting by 14 CSS pixels
without enlarging the artwork. The closest visible button wins where buffers
overlap; presses farther away do nothing. This also guards the game surface
against selection, context menus, double-tap and pinch gestures. Page content
outside the game remains scrollable and selectable.

Browser regression checks cover native and fallback fullscreen in the site
iframe, touch-only launch, rotation, contextual actions, near misses, inert
background taps, pinch suppression, a persistent exit, and resolution recovery.

Starfall's hosted standalone game also exports a web app manifest with
`fullscreen` display and a `standalone` fallback, landscape orientation, a
same-origin start URL and an icon. Android browser fullscreen requests
`navigationUI: "hide"`. iPhone Safari cannot grant native fullscreen to the
canvas: use Safari's Hide Toolbar for the current tab, or add the standalone
game to the Home Screen and launch its icon for a browser-bar-free window.
The site explains that iPhone Home Screen apps use a separate save container.
An opt-in `data-pixel-app-fullscreen=true` expands the game at launch when
installed display mode or iOS `navigator.standalone` is detected. It avoids a
gesture-only native request at startup; the visible EXIT control restores the
cabinet and its link back to Vectrune.

Hosted game examples show a loading panel before the iframe downloads and keep
it covered until the runtime reports readiness. Pixel and Pixel 3D hosts signal
after drawing the first canvas frame; DOM games signal after their initial
render. The parent validates the same-origin frame and its document readiness
marker before enabling interaction. Source tabs remain available while loading.
After 30 seconds the localized panel offers Retry, while continuing to wait for
successful initialization. Older cached exports use a compatibility fallback.
`tests/browser/game_loading.py` covers delayed downloads and engine startup,
retry, cached exports and every hosted game in Chromium and WebKit.

## Floating destination titles

Pixel-3d things can opt into world-anchored pixel-font plaques:

```rune
portals.push({"x":52,"y":6.3,"z":3,"model":"sf/garden_hatch",
              "title":"HYDROPONICS","titleColor":10283741,"visible":true})
```

`title` accepts 1-48 printable ASCII characters. The renderer places it above the
model's highest block, accounting for scale; `titleHeight` overrides that offset
in world units (0-64). `titleColor` is an RGB integer, default mint. Text tracks
camera motion and pitch, clips at the viewport and tests terrain/model depth.
Hidden or fully dissolved things have no plaque. Titles use the shared browser
and QuickJS renderer; they are drawn before the regular HUD and do not alter
geometry depth or collision. Starfall labels every sector door, shortcut, crypt
gateway and return portal with its destination.


## Health containers, extra lives and the Void Curator

A fresh expedition starts at **4 health** and **3 lives**. Rootheart, the Iron
Cantor, the Crypt Warden and the optional Void Curator each award one permanent
health container immediately on defeat, refill the new maximum, and display a
rising container. Each boss reward is unique across deaths, room rebuilds,
game over and reload. The Observatory armor adds two more cells, giving a maximum
of **10** with all four boss containers. Existing saves infer the main-boss
containers from completed sectors; the versioned reward fields are part of the
saved campaign shape, including cells earned before collecting a sector relay.

Four green **1-UP** capsules reward optional exploration, away from the main
route and upgrade pedestals. Claims are tracked per expedition and survive
deaths and area revisits; a new expedition starts with three lives and restores
the capsules. They do not refill health. The dock, crypts and Observatory no
longer supply routine extra lives.

| Area | Extra-life location |
|---|---|
| Containment | x=73, z=11.6, service loft beyond the seal |
| Hydroponics | x=5, z=17.6, upper western canopy shelf |
| Gravity Foundry | x=6, z=17.6, maintenance shelf above the workshop |
| Signal Archive | x=65, z=7.6, far wall shelf beyond the upgrade balcony |

The **Void Curator** is optional: the existing return door beside the armor
remains available, and a retreat portal is available on the chamber floor.
Continuing east drops into a larger chamber with a beacon and a gravity console
before the encounter. The guardian has 16 HP,
a dedicated bar and battle score, a moving iris/shield cycle, a marked starfall
pillar, low star waves to jump and higher bolts to duck. Only its open iris takes
damage. Fatal deaths refill an undefeated Curator and return it to its dormant
phase; defeating it permanently opens the chamber's return portal. Its health
container is awarded once even if the player revisits the room.

## Starfall item discovery

Major pickups and first-time boss health containers pause gameplay for a
five-second discovery sequence. The pilot raises both hands and lifts the
actual item overhead, with gold sparkles and an original fanfare. The HUD names
the item and explains keyboard, controller and touch use. Jump, fire, use or
Enter confirms after the initial 1.2-second lift; held pickup inputs cannot
skip it. Instructions remain visible after play resumes. Enemies, projectiles,
physics and machinery stay frozen during the reveal, and damage is blocked.
Rewards are granted before the animation and saved under the existing campaign
rules. Repairs remain quick, and rare extra lives get sparkles without a pause.
