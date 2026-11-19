# Pixel 3D block models

`@Model/<name>` describes a pixel-style solid model as a small collection of
colored boxes. It reuses `@Palette`, requires no mesh editor or external asset,
and renders genuine top/side faces in both browser and native pixel-3d hosts.
Rune Crypt's enemies, loot, dungeon props, combat markers, projectiles and
stairs use this format; its first-person sword remains a screen-space sprite.

## Authoring

```rune
@Palette/stone
colors = {"s":"#514958","l":"#786b75"}

@Model/stairs
palette = stone
unit = 0.25
blocks:
    {"from":[-2,-2,0],"size":[4,1,1],"color":"s"}
    {"from":[-2,-1,0],"size":[4,1,2],"color":"l"}
    {"from":[-2,0,0],"size":[4,1,3],"color":"s"}
    {"from":[-2,1,0],"size":[4,1,4],"color":"l"}
```

Coordinates are **`[x, y, z]`**, with `x/y` matching map coordinates and `z`
pointing up from the floor. `from` is a box's minimum corner; `size` is its
width, depth, and height. Values are grid integers; `unit` converts one grid
unit to world tiles. The example has a centered, one-tile footprint, rises
along local `+y`, and reaches one tile high.

`unit` defaults to `0.125` and must be greater than zero and at most one.
`from` components must be integers from -32 to 32; `size` components must be
integers from 1 to 32. A model contains 1-256 boxes. Colors are single ASCII
symbols from the selected palette; unknown or transparent colors are errors.
Boxes may touch or overlap; nearest visible surfaces are rendered. Texture
mapping, mesh triangles, animation rigs, and translucent boxes are not part of
this initial format.

## Placement and rotation

Use a model instead of a sprite in a scene's existing `things` state:

```rune
@Scene/dungeon
things = ["landmarks"]
# Other required scene properties omitted.

@Logic/dungeon
state:
    landmarks = [{"x":11.5,"y":11.5,"model":"stairs","angle":90,"scale":0.7,"visible":true}]
```

`x/y` place the model's local origin. Optional `z` lifts it above the floor
(default zero), `angle` rotates around the vertical axis in degrees (default
zero; positive rotation turns local `+x` toward map `+y`), and `scale` multiplies
all dimensions (default one, finite and positive). `visible = false` hides it.
A thing cannot declare both `model` and `sprite`. Model names and transforms
are validated by the shared runtime, including the native host.

### Pixel dissolve

Optional instance `dissolve` is a finite number from 0 to 1: zero (default)
renders the solid model; one renders nothing. Intermediate values discard
progressively more two-pixel screen-space fragments using a deterministic mask.
Discarded fragments do not write depth, so the scene behind shows through;
remaining faces keep their normal shading. This is not alpha blending or
world-space geometry erosion. The mask stays fixed on screen as the camera moves.
It applies only to models, not sprites.

```rune
remains = [{"x":3.5,"y":1.5,"model":"enemy/skeleton","dissolve":0.5}]
```

Bind `remains` through `@Scene things` as with any other model array. Animate
`dissolve` in game logic, then remove the instance at one. Invalid values
report a runtime error. Rune Crypt uses sinking and dissolving models for
one-second enemy death animations; combat/rewards resolve before the visual
effect finishes.

Keep `from` coordinates centered around zero if you want rotation about the
middle of a prop. Unlike a billboard sprite, a model keeps its world-facing
orientation when the camera moves. Faces receive simple axis-based shading:
top/bottom full color, local x faces 80%, local y faces 65%.

## Rendering and behavior boundaries

Models share perspective and per-pixel depth with walls and sprites. A stair
can cover a sprite's feet while leaving its head visible. Floors and indoor
ceiling planes clip model geometry; outdoor sky has no ceiling plane. The
grid-map camera eye remains fixed at half a tile above the floor.
`@Map ceiling_height` raises both the ceiling clipping plane and wall tops;
see [room heights](../runtime/pixel3d.md#room-height).

Opt-in [voxel scenes](../runtime/voxel-worlds.md) instead use player feet
elevation plus a 1.25-tile eye offset and pitched camera rays. Place model
origins at the appropriate terrain elevation using instance `z`; models share
voxel depth occlusion but remain visual, non-colliding props.

For moving creatures, face the model's authored forward axis toward its
target by updating `angle`. Rune Crypt authors enemies facing local `+x`.
Its attack warnings select yellow models with raised weapons, preserving
readability from any camera angle. Loot and wraiths animate through instance
rotation/elevation, and chests and spikes swap between authored model states.
These are ordinary logic updates, not animation rigs. Keep pickup origins at
ground level and lift projectiles explicitly (`z = 0.5` in Rune Crypt).

Models are **visual props only**: they do not change wall collision, line of
sight, raycast combat, player height, or stair interaction. Rune Crypt still
descends via E near cleared stairs; players do not physically climb steps.
For solid obstacles, pair a prop with existing map wall collision. Very large
or numerous block models increase CPU rendering cost; start with a handful of
boxes per prop.

Sources: [compiler](../../src/apps/pixel3d/mod.rs),
[browser model renderer](../../runtime/rune-web/src/pixel3d/model.ts),
[native model renderer](../../src/apps/pixel3d/model.rs),
[example stairs](../../examples/games/rune_crypt/models.rune),
[browser tests](../../runtime/rune-web/tests/pixel3d.test.ts),
[compiler/native tests](../../tests/pixel3d_app.rs).
