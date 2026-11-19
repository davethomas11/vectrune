# Dog Walker

[Dog Walker](../../examples/games/dog_walker/dog_walker.rune) is a score
attack game built with the Pixel 3D renderer. The teaching site builds a
showcase at `/dog-walker/` and a standalone game at
`/assets/games/dog-walker/index.html`. The embedded and standalone games
share a same-origin save. The walk automatically moves
through the neighborhood. Up or W speeds up, Down or S backtracks, and
Left/Right or A/D steer across the street. The same actions are mapped to
the controller stick and touchscreen.

Press Space when the marker appears at a stop. The dog lifts a hind leg to
mark hydrants and street lampposts for 10 points. Each of the eight lawn
patches scores 40. The dog squats, plops, and hops up just before an angry
neighbor comes out. X or Shift dashes
on cooldown. A catch costs one of three hearts and up to 25 points.

Garbage trucks occupy street lanes and cost a heart and up to 15 points
if you run into one. Couriers pull your dog's attention toward the curb.
Steer away or dash before the leash snaps. After a snap, movement changes
to free running. Catch up and press Space to clip the leash back on
within 4.5 seconds, or the walk ends.

The park ends the chase. Move into the lane with the lit ring and press
Space to throw. A fetched ball scores 20, or 50 for hitting the target.
Each consecutive target hit adds another 15 points to the bonus. A walk
ends after three returns or when the last heart is lost. The browser keeps
the best score in local storage.

The browser shell opens in Blue Pocket, a six-color blue ramp with
depth-based silhouettes around the dog, buildings, and obstacles. The
original colors and the experimental WebGL renderer are available in the
toolbar. The street and park are built from models over a sky with a
lower color, so they can use either browser renderer.
The leash demonstrates the engine's [3D tether](pixel3d.md#3d-tethers)
between the walker's hand and the dog's collar.

```sh
vectrune examples/games/dog_walker/dog_walker.rune -o html > dog-walker.html
vectrune test examples/games/dog_walker --type logic
```

With the development binary and Playwright installed,
`python3 tests/browser/dog_walker.py` exercises the full walk with game
inputs, including the chase, three fetches, and saved high score.
