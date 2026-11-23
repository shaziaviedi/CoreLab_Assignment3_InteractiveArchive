# Profile, tree camera and pool feedback review

Implemented November 22, 2026. This report supersedes the earlier interaction
report for the behavior described here. No hosted deployment was performed.

## Changes

- Profile choices have equal grid columns, fixed border widths, consistent padding
  and portrait/text gaps. Portraits remain head/shoulder crops of the existing models.
- The narrower visitor list displays circular model portraits, username and one
  location/activity line. F/M markers, avatar-type text and the room heading are
  removed. Profile/status controls appear only on the main map; identity stays in
  the provider and localStorage during all camera/interaction modes.
- Presence-list portraits reuse two cached PNG renders of the existing character
  previews. At most one fallback renderer per avatar type warms the cache, avoiding
  a WebGL canvas for every list entry. This adds no downloaded model or image asset.
- The map's tree action starts the camera transfer first. The composer becomes
  visible only after the camera rig signals completion. Interrupted arrivals can
  be cancelled without subsequently reopening the form. The composer fades in and
  keeps its title, with CANCEL then SUBMIT aligned at its bottom-right.
- SUBMIT only validates/retains the local draft and enters fence placement. The
  server still creates the note only after the selected position is accepted.
- Placed-note discovery is projected beside the actual paper: a plain glowing
  magnifier and View Message text, without a pill background. Hover/focus exposes
  contributor/time using the existing flower tooltip style. Tap or activation
  moves the same camera rig closer to the physical note, without a visual details
  card. Screen readers receive the complete original message.
- BACK TO MESSAGES restores the saved tree orbit. HIDE MESSAGE remains reversible
  and local. The shared bottom controls place LEAVE A MESSAGE immediately to the
  right of the arrow-bearing RETURN TO MAP button, including after cancellation.
- Fence materials now use neutral grey. Paper transforms have an outward normal
  offset, and settling opens away from the metal instead of swinging through posts.
- The pool uses one status area: Hover and click to leave a rose, pending/error
  feedback, then Your flower has been placed only after acknowledgement. Success
  replaces the instruction for three seconds. The separate own-flower notification
  is suppressed. The pool return button sits higher above the bottom safe area.

## Root cause of placement failure after orbiting

The fence hover handler rejected every event while `gesture.current.dragged` was
true. The camera rig intentionally retained that flag after pointerup to suppress
the drag's trailing click; it only reset on the next pointerdown. Consequently,
ordinary pointer movement after an orbit could not update the placement preview.
This was a latched gesture-state problem, rather than an established stale camera
object or an OrbitControls target problem. The project uses its existing custom rig.

`canHover` now blocks an active drag only while pointers remain held. After release,
hover resumes immediately, while `canActivate` still rejects the trailing click.
A deliberate next pointerdown resets the click latch. Regression tests cover this
distinction.

The picker also explicitly refreshes the current camera/world matrices, normalizes
client coordinates with the current canvas rectangle, and intersects the actual
cylindrical fence surface. It converts that intersection through the installation's
world-to-local transform before snapping to the existing validated column/row grid.
The rig refreshes R3F pointer intersections when its camera changes and no pointer
is held. This keeps discovery/placement current after camera motion without
clearing drag protection or adding another camera controller.

## Positioning and camera details

The fence radius remains 0.85 scene units; posts have a maximum 0.019 radius. Tag
attachment transforms now sit 0.027 units outward from the fence along each local
radial normal. Paper, preview, focus targets, tooltip and reading camera all derive
their transform from the same `noteAnchor` function. No fixed world-axis nudge is
used. Existing row/column coordinates and legacy IDs remain valid; collision
validation is unchanged and conservatively reserves the same paper envelope.

Reading frames use a 32-degree lens and approximately 0.4-unit normal distance.
Narrow screens increase the distance to fit the full paper width. Transfers within
the tree interpolate around its cylindrical exterior rather than cutting through
the trunk/fence. Lens, aim and position transition together. Orbit angle and radius
refs remain unchanged while reading, allowing an exact return to the prior view.

Paper texture layout now fits the complete accepted message instead of dropping
lines beyond its old fixed cutoff. Very fragmented line breaks reflow on the
physical paper when necessary; stored text and the screen-reader version retain
the original content. Paper appearance, folds, lighting and texture resolution
remain intact.

## Shared versus local changes

No note/flower payload fields or Socket.io event names changed. Fence coordinates,
server-authoritative collision checks, UUIDs, ISO timestamps, acknowledgements,
idempotent retries and room snapshots remain in use. Rose colors and deterministic
transforms are unchanged.

The shared presence enum adds `photographing`, displayed as Taking a Photograph.
The placement layout version is **4**, covering the normal offset and compatible
presence schema. Publish frontend and backend together; an older server will
reject the newer presence value or fail the existing layout compatibility check.
The current local backend health response was verified with layoutVersion 4.

Composer timing, selected note/reading camera, hover metadata, profile visibility
and flower feedback remain local state. Other visitors' contributions cannot move
the local camera or change its Sun/Moon puzzle state.

## Files

- `src/scene/{useInteractionMode.js,MemorialCameraRig.jsx,MemorialNavigation.jsx,navigation.js}`:
  gesture separation, camera completion/focus transitions and paired controls.
- `src/collaboration/tree/treeInteraction.js` (new): current-camera picking,
  note projection and reading-frame transforms.
- `src/collaboration/tree/{TreeNotes3D.jsx,TreeNoteAccessibility.jsx,TreeNotePanel.jsx,useTreeNotes.js,treeNoteLayout.js,PaperTag.jsx,paperTexture.js}`:
  previews, metadata/reading access, arrival gate, draft stage and paper clearance.
- `src/collaboration/components/{AvatarPreview.jsx,VisitorPresence.jsx,CollaborationStatus.jsx}`
  and `src/collaboration/presence/presentation.js`: cached portraits and concise list.
- `src/collaboration/flowers/{usePoolFlowers.js,FlowerOverlay.jsx}` and
  `src/collaboration/useMemorialSocket.js`: one acknowledged feedback area and
  local contribution-kind/ownership information for notification filtering.
- `src/Experience.jsx`, `src/World3D.jsx`: existing mode/transition state wiring.
- `shared/{memorialLayout.js,protocol.js}`: version, normal offset and photo activity.
- `src/styles/{collaboration,tree-notes,memorial-navigation,flowers}.css`: scoped
  spacing, plain projected discovery, fade/reduced-motion and return controls.
- `server/tests/cameraUI.test.js` (new), existing cameraRig/treeNotes/noteSafety/
  refinements tests and README: behavior checks, updated intentional geometry
  expectations and documentation.

## Verification and limits

The final automated suite passes **84/84 tests**. Checks cover:

- Full-circumference current-camera raycasts at 24 sampled bearings and three
  heights, including an offset canvas and camera matrices left stale by the test.
- Hover recovery after pointer release, drag-click suppression, and continuous
  preview surface/coordinate behavior.
- Actual camera arrival gating, cancellation during arrival, CANCEL/SUBMIT order,
  draft retention without a network submission, and saved-orbit return from reading.
- Normal-relative paper clearance through settling/breeze and reading frames that
  contain the paper at 320×740, 390×844, 768×1024 and 1440×900 camera aspects.
- Full 180-character paper text, including wide glyph and fragmented-line cases.
- Acknowledgement-only flower success in one status region, timer reset and the
  existing real multi-client room, collision, color, metadata and reconnect tests.

Production compilation passes. All 22 public assets and all 33 retained color/alpha
textures verify successfully. No model/texture files or dependencies changed.
The existing large rendering chunk advisory and Three.Clock/CommonJS dependency
notices remain; no incompatible dependency upgrade was introduced.

After the user made Chrome available, native browser testing used two independent
storage origins, `127.0.0.1:5180` and `localhost:5180`, connected to the actual
workspace Socket.io server on port 3001. Both used room `camera-ui-review`, with
Camera A/male and Camera B/female identities. Observed results:

- Both sessions reported two visitors. The expanded list showed the correct model
  portraits, names and one location line, without avatar-type or room text.
- The tree camera transferred before the composer appeared. CANCEL/SUBMIT order
  was correct; SUBMIT entered placement without creating a note.
- A preview remained available immediately after orbit release, before another
  pointerdown; a subsequent fence click attached the note successfully.
- Reading moved to the physical paper with author/time metadata and no visual
  details card. BACK TO MESSAGES returned to the orbit. The second visitor received
  and read Camera A's existing note with the same text, author and timestamp.
- Camera B placed a white rose with one physical click. The single instruction
  area changed to Your flower has been placed, with no duplicate toast, then reset.
  Camera A received the rose without refreshing and exposed Camera B's timestamp
  through click and keyboard focus. All five existing color controls remained.
- All four pool side transitions completed; returning to Side 1 retained the rose
  at its original anchor. Profile/status controls stayed hidden in tree/pool/photo
  views and returned on the map.
- The profile editor was visually checked at desktop and a 390×844 emulated
  viewport: equal cards, centered portraits and balanced spacing.
- Existing photography captured a new image; MEMORIES opened the personal archive
  with that image, and returning to the map restored the profile control.
- The inspected console contained Three.Clock deprecation warnings, React's
  development-tools notice and WebGL context-disposal messages after portrait
  previews unmounted; no application errors were observed during this pass.

The browser pass verified note snapshot receipt, rather than simultaneous note
creation in two visible windows. Real multi-client automated tests cover live note
events, conflict handling and reconnect snapshots. Full-circumference/height and
320/390/768/1440 camera-framing coverage is automated; physical touch devices and
every responsive layout were not manually tested. No performance benchmark was run.

Development Vite and the actual local Socket.io backend were started/checked. A
source-matched temporary frontend copy was used for build/tests and the browser
frontend. The workspace suite eventually passed 84/84 after roughly five minutes
of restricted file-access delay. After the final paper word-wrap refinement, the
complete source-matched suite passed 84/84 outside that filesystem restriction in
roughly three seconds. Source directories were compared byte-for-byte after
verification. No live Vercel or Render deployment/
test was performed. In-memory contributions still disappear on backend restart.
