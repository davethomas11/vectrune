# Pixel-3d model shapes

`@Model` supports `blocks:` and `shapes:` in the same model. Existing block models keep their behavior. Shapes use analytic ray intersections in the browser and native rasterizer, with depth, curved shading, rotation, scale, and pixel dissolve.

```rune
@Palette/demo
colors = {"c":"#68e1e8","o":"#d59968"}

@Model/demo/marble
palette = demo
unit = 1
shapes:
    {"type":"sphere","center":[0,0,0.55],"radius":0.55,"color":"c"}

@Model/demo/pillar
palette = demo
unit = 1
shapes:
    {"type":"cylinder","center":[0,0,1],"radius":0.4,"height":2,"color":"c"}

@Model/demo/ramp
palette = demo
unit = 1
shapes:
    {"type":"ramp","from":[0,-3,0],"size":[16,6,4],"color":"o"}
```

Coordinates use X/Y for the horizontal plane and Z for height. `center` is the geometric center of a sphere or cylinder; cylinders are capped and extend along Z. A ramp fills a wedge inside its `from`/`size` box: its top rises from zero height at minimum X to full height at maximum X. `angle = 180` on an instance reverses the slope. Instances also accept `scale` and `dissolve` between zero and one.

Every dimension is multiplied by `unit` (default 0.125; greater than zero and at most one). Shape coordinates can be fractional and must be finite and within 32 model units. Radii, heights, and sizes must be positive. Each model needs 1–256 combined blocks and shapes. Colors use nontransparent palette symbols.

Models define visible geometry; collision remains game logic. For a ramp with base `z`, length `L`, and rise `H`, its top is `z + local_x * H / L` inside its footprint. Marble Run uses that continuous plane for ground contact and a downhill acceleration proportional to the slope; it does not approximate the surface with voxel stairs.

## Marble Run / Six Descents

```sh
cargo run -- examples/games/marble_run/marble_run.rune
cargo run -- examples/games/marble_run/marble_run.rune -o html > /tmp/marble-run.html
cargo run -- test examples/games/marble_run --type logic
cargo test --test pixel3d_shapes --test marble_run_app
python3 tests/browser/marble_run.py
```

Steer with WASD/arrows and jump with Space. Press X or Shift to spend a cell and commit to a **0.8-second (24-tick) wind-up**. The marble stays anchored until it automatically fires at full charge; releasing early cannot fire a partial blast or cancel the commitment. A blast reaches **three tiles**, then needs a **three-second cooldown**. Holding the button cannot queue another blast: release and press again when ready.

You get **three cells per course**. Losing a life does not replenish them. Starting the next course or retrying after game over gives a fresh set. The charge cannot suspend the marble in midair; enemies keep patrolling during the wind-up. Later courses have more enemies than cells, so time close-range blasts and dodge or jump the others.

| Course | Turns | Half-pipes | Gaps | Spikes | Challenge |
| --- | --- | --- | --- | --- | --- |
| Copper Cascade | One right-angle bend | One | One, 3 tiles wide | Edge patches | Learn braking into corners and bank steering. |
| Glass Spine | A left/right zigzag | One | Two, up to 4 tiles wide | Bank patches and a full row | Narrow blue ramps and faster patrols. |
| Tempest Ridge | Three corners, including a return leg | Two | Three, up to 4.5 tiles wide | Trough hazards and two full rows | Tight purple ramps, direction reversals, and rapid patrols. |
| Aurora Switchback | Four bends, starting in the opposite direction | One | Three | Bank patches and two rows | Braking into negative-Y runs and sharp switches. |
| Ember Foundry | Four bends | Two | Four | Furnace spike rows | Chain landings through two banks and return ramps. |
| Celestial Crown | Five bends in three directions | Two | Five | Three full rows and a trough trap | Seven sentries, the longest route, and the final beacon. |

Gold floor arrows mark corners. The camera keeps a fixed isometric angle and controls stay relative to the screen through every change of direction. Both horizontal velocity components receive downhill gravity, so rotated ramps behave the same as straight ones.

Half-pipes have a one-tile flat trough and four rising planes per bank. Their visible wedges and collision heights use the same profile. Gravity pulls the marble back toward the center; carrying speed over a bank lip preserves upward momentum for a launch. Raised bank entrances are solid, so enter through the trough instead of passing underneath a bank.

Spikes have gold warning bases and pointed white tips. Touching them costs a life; jump above the tips or steer around them. Spikes survive charged blasts, and the usual respawn grace prevents repeated damage immediately after a fall. Clearing a level requires reaching the actual beacon position, rather than merely passing an X coordinate.

Reach a beacon to unlock the next course, then click **Roll onward** or press **Enter**. Clearing Celestial Crown completes the six-course campaign. Each course starts with three lives and has a checkpoint after its first gap. Game over retries the current course; it does not send you back to course one.

The title has an orbiting marble diorama and its own gentle theme. Press Enter to start a campaign, or L to open the level selector. Choose an unlocked course with the browser cards, or use left/right and Enter on keyboard/controller. Locked courses can be previewed. Unlocks and clears persist through browser reloads and native sessions. Start Campaign begins at course one without deleting unlocks.

A lost life triggers a 1.2-second dissolve and cyan/white pixel shatter. Movement and charge are disabled during the animation, then the marble reforms at its checkpoint with brief invulnerability. The last life plays the same animation before game over. Pausing also freezes the death animation.

The main song now has seven distinct sections: intro, verse, pre-chorus, chorus, bridge, breakdown, and coda. Its nine-cue arrangement is 56 bars, approximately 1 minute 47 seconds at 126 BPM, with plucked lead, strings, bell arpeggios, bass, and drums. The title has a separate four-bar bell theme.

The gameplay HUD uses the existing floating style with transparent backgrounds and game-owned pixel icons in `examples/games/marble_run/hud.rune`. Lives are cyan marble pips and cells are gold battery pips; hollow icons show what has been spent. Charge uses a cyan ready bolt, gold charging bolt, cooldown hourglass, and muted empty bolt, with an outlined progress meter.

The controller uses the left stick, A for jump, and X or the right trigger for charge; touch has a movement stick and jump/charge buttons. P pauses, M mutes, F enters fullscreen, and T returns to the title after pausing an active run.

The native integration test completes all six courses using only inputs and renders representative frames at 144×90. It has a 240-second deadline and runs locally in about 35 seconds. Separate tests check the title camera, partial death frames, pause/resume during death, the 56-bar score, and native saves across sessions. The browser test verifies all six courses, real selector buttons, locked previews, saved unlocks after reload, and audio metadata.
