# Collaborative interaction refinements

Implemented and verified locally on November 22, 2026. This report describes the
new interaction changes; the preceding connectivity report remains historical.

## Survivor Tree

The map's Leave a message action opens the existing close orbital camera and
composer directly. There is no intermediate wide view or second required click.
Cancelling stays in the close tree environment. Hovering the message installation
reveals a glowing magnifier and View Messages hint; clicking enters browsing.
Keyboard visitors have a focusable View Messages alternative. Browsing has Write
a message and Back to tree controls. Reading a tag restores the previous browsing
or placement state when closed, retaining the draft and camera angle.

One camera rig handles all tree interactions. The orbit eye height is now 1.05
scene units and target height 0.56, compared with 1.7/1.05 previously. Horizontal
orbit remains continuous; vertical rotation remains fixed, with existing bounded
zoom and obstacle avoidance. Writing, browsing and cancellation do not change the
camera's orbit-mode key. Photography keeps its original wide composition.

The model previously used the entire asymmetric canopy bounds as its horizontal
origin. The tree now measures transformed vertices in the lowest eight percent
of the bark geometry and centers that visible trunk before applying the original
height normalization, rotation and outer scale. The fence, camera targets and
shared anchors remain centered on the existing Survivor Tree world transform.
The original tree asset, textures, height and surrounding actor transforms remain.

The reduced fence retains its 0.85 radius, 0.9 posts, original rails and materials.
One subtle wire-lattice draw supports the expanded attachment surface. Tags scale
to 0.38 instead of 0.72: approximately 13 by 16 cm of paper in scene units. Existing
paper textures, folds, shadows and breeze/settling motion are retained. Full text
and author/avatar/time remain available in the enlarged reader.

## Fence placement and server authority

One cylindrical raycast surface replaces the sparse collection of free-anchor
meshes. Intersections convert to fence-local angle/height, then snap to a grid:

- 96 angular columns, 26 height rows: 2,496 possible surface samples.
- Heights from 0.32 through 0.82, at 0.02-unit increments.
- Payload `fencePosition: { column, row }`, with integer bounds 0–95 and 0–25.
- Canonical anchor IDs `fence-column-row`; neither world coordinates nor arbitrary
  rotations supplied by a client are accepted.

The preview smoothly follows the snapped surface position along the cylinder and shows a red tint when it
would overlap an existing tag. Clicking an existing note opens its details. Orbit
drags cannot submit a placement. Keyboard users receive 96 coarser attachment
choices plus a focus target for every existing note, rather than thousands of
Tab stops. Hidden notes still reserve their positions.

The server validates bounds and matching coordinate/anchor identifiers, normalizes
the record, then checks both exact occupancy and neighboring paper envelopes.
Collision checks use wrapped circumferential distance and vertical separation,
including the seam between columns 95 and 0. Check and insert remain synchronous:
the first valid request wins; a conflicting request receives `ANCHOR_OCCUPIED`.
Existing acknowledgements, request fingerprinting, duplicate protection, rate
limits and server author/UUID/ISO timestamp generation remain intact.

Legacy tree-01–tree-24 records resolve to their original angular stations and
upper/lower attachment heights. New accepted records contain both `anchorId` and
validated `fencePosition`. Room snapshots and note:created broadcasts carry these
same authoritative records, so camera movement and reconnects do not move notes.
Shared layout version is now **3**; deploy frontend and backend together.

## Roses

Five compact swatches select white, palePink, red, peach or lavender. White is the
initial default. The selector is above the parapet interaction area, clear of
placement anchors. Preview and accepted flowers use the same geometry and material
palette. Color persists locally for the next gesture, including camera-side changes.

The shared flower adds only `roseColor`. Unsupported values are rejected, omitted
legacy values default white, and existing records without the property render
white. No dedication, recipient, message, flower type or confirmation fields were
introduced. Placement is still one click with server acknowledgement.

One shared procedural rose mesh set supplies all five variants. Only petal material
colors differ; stem and leaf materials and every geometry are shared. A stable
hash of flower ID and anchor ID yields yaw within ±0.045 radians, tangent offset
within ±0.012 and cross-surface offset within ±0.002. No client randomness is used.
The measured parapet normal remains unchanged, avoiding tilted/buried stems. The
same derived transform also drives projected focus targets and attribution labels.

Uncertain retries preserve the complete original payload, including its color and
request ID. Choosing a new color for a different position is a new gesture. This
prevents changing a timed-out request's fingerprint or silently duplicating it.
Hover, focus and tap still reveal only contributor username and locally formatted
server placement time.

## Interface and organization

All RETURN TO MAP controls again show the original left arrow and reuse
`.viewer-back`. The status card has a 22-pixel gap below the 36-pixel profile
control. Collapsed and expanded content share the same responsive constrained
width. The panel scrolls within the viewport and fades downward on opening;
reduced-motion preferences disable that animation.

New reusable files:

- `shared/fenceLayout.js`: coordinate normalization, legacy lookup and collision
  rules shared by validation and rendering.
- `src/scene/treeAlignment.js`: actual bark geometry origin measurement.
- `src/collaboration/flowers/roseAppearance.js`: palette and deterministic transforms.
- `public/svg/magnify.svg`: small cursor/discovery asset.
- `server/tests/refinements.test.js`: the new behavior and multi-client checks.

Existing files modified for this step:

- `shared/{protocol,memorialLayout}.js`, `server/validation.js`,
  `server/storage/contributionRepository.js`.
- `src/Experience.jsx`, `src/TexturedTree.jsx`,
  `src/scene/{navigation.js,MemorialCameraRig.jsx,MemorialNavigation.jsx,assetManifest.js}`.
- `src/collaboration/tree/{useTreeNotes.js,treeNoteLayout.js,TreeNotes3D.jsx,TreeNotePanel.jsx,TreeNoteAccessibility.jsx}`.
- `src/collaboration/flowers/{usePoolFlowers.js,roseGeometry.js,WhiteRose.jsx,PoolFlowers3D.jsx,FlowerOverlay.jsx}`.
- `src/styles/{tree-notes,flowers,collaboration}.css`, README, and existing
  collaboration/flowers/navigation/treeNotes/noteSafety test fixtures plus the
  actual-model geometry helper.

No heavy models, dependencies, new camera systems or top-level application
architecture were added. Existing environment shaders, water, observation
animations, puzzle, photography, archive and presence remain in their existing
components.

## Verification

The complete automated suite passes **73/73** tests, including:

- Two independent real Socket.io clients exchanging fence positions and all five
  rose colors; nearby-position conflicts accept one and reject the other.
- Late joining and reconnect snapshots preserve notes/colors; legacy anchors and
  white defaults remain compatible; unsupported colors/world coordinates fail.
- Immediate composer entry, draft retention when switching to browsing/reading,
  safe color/request retry behavior, drag suppression and listener cleanup.
- Smooth preview motion remains on the fence through the angular seam; orbit
  drags never submit the preview.
- Actual Survivor Tree bark geometry centering; all-angle top/middle/bottom tag
  visibility from the lower camera, including opposite sides.
- Deterministic transforms on all 48 actual pool anchors, sampled rose geometry
  staying on stone within the outer margin, and shared leaf/stem resources.
- Existing camera, puzzle-related interaction gating, metadata, reduced-motion,
  room state, rate-limit and acknowledgement tests.

Production build passes, with 22 verified public assets. All 33 retained textures
pass full-resolution color/alpha verification. Whitespace checks pass. The new
magnifier is the only additional static asset; no GLBs or texture pixels changed.
The existing large rendering chunk advisory and Three.Clock/CommonJS deprecation
notices remain.

Manual Chrome testing used two independent incognito windows with separate
localStorage origins, `127.0.0.1:5180` and `localhost:5180`, in room
`refinement-browser`, connected to the actual workspace backend on port 3001.
A source-matched temporary frontend copy avoided slow workspace file-provider
reads during browser QA. Observed:

- Fence A/male and Rose B/female connected concurrently, with count 2 and the
  correct profiles listed. Status collapsed/expanded widths aligned visually.
- Map tree hotspot immediately opened the composer. A pointer-selected lower
  fence note attached successfully; the smaller paper and centered trunk were
  inspected in the close orbit.
- Hovering the fence revealed the magnifier/hint. Browsing required no new draft;
  dragging moved the orbit without another placement.
- Rose B selected red and lavender, saw matching previews and placed both roses.
  Fence A received both without refresh and opened Rose B's author/time label.
- Rose B attached an upper-position note. Fence A, already browsing at another
  orbit angle, received it without refresh and read “Together, we remember.”,
  Rose B, Female avatar and its server time. Closing restored browsing.
- Independent Sun/Moon states and existing fragment reveal interactions worked.
  Every dedicated view displayed the restored return arrow.
- Console inspection showed the existing Three.Clock notices and renderer context
  disposal messages, with no application exception or React warning in the
  inspected session. The main scene continued rendering.

## Remaining limits

No production deployment or live hosted multiuser test was performed in this step.
The prior report documents the missing public backend/account configuration.
Storage remains in memory and clears on server restart. Coordinate layout version
3 requires publishing both client and server.

Desktop and short-height responsive rendering were inspected. A narrow mobile
viewport could not be reliably set through the native browser-control interface;
physical mobile/touch and the broader browser/device matrix remain unverified.
Responsive widths are constrained in CSS, but that is not a substitute for those
manual checks. Touch/focus event paths continue to have automated coverage.

Dense placement is intentionally fine-grained rather than mathematically continuous.
Occupied paper envelopes reduce usable capacity below the 2,496 grid samples.
Observation actors remain present and can visually obscure a tag from a particular
angle; visitors can orbit or use the projected keyboard targets and enlarged reader.
