# ELSEWHERE performance and stability

## Findings and scope

The original public GLBs total 32,370,536 bytes. Fourteen models actually used
by the app total 27,143,480 bytes; the unused 5,227,056-byte plaza tree is not
part of that initial transfer. See `assets-baseline.json` for geometry,
materials, animation and embedded-image inventory. No original models changed.

The main transfer costs were Oculus (11.41 MB), Survivor Tree (5.11 MB), and
the reference pool (3.53 MB). Oculus has 362,250 triangles and seven materials;
its cost is predominantly geometry. The pool has only 293 triangles, but a
3.19 MB color PNG that its renderer already discards. The museum has 10,819
triangles, 25 materials and small embedded WebPs. TexturedTree clones geometry
and materials for vegetation; the module name in Network's Initiator column
identifies the request's caller, rather than proving a repeated download.

The original loader already cached stable model URLs. The original-code and
optimized HAR samples each contain one request per loaded GLB, with no duplicate
GLB URLs. The new shared cache also ensures grouped pedestrian consumers reuse
the same idle model as the avatar previews. Previews previously loaded both
walking clips even when only idle previews were shown.

`src/main.jsx` does not enable React StrictMode. Development double mounting
was therefore not the cause. Presence/status updates could reconcile the world;
Experience and World3D now memoize unchanged props. Material clones remain per
object where appearance or custom uniforms require them. Shared geometry stays
shared.

Camera collision bounds and dreamy material discovery previously traversed the
whole scene every 0.5 seconds. Shader discovery happened after drawing began,
which could trigger another compilation. Ghost trees and the ghost pool also
traversed materials every frame just to reassign constant opacity. Pedestrian
foot grounding skinned vertices every frame, including paused/offscreen actors.
These CPU costs are separate from network transfer and initial GLTF decoding.

The project initially contained macOS `dataless` model files. Reads hydrated them;
warm Vite startup was 69 ms, while a later dependency-cache rebuild took 34.19 s
and one cold production build took 51.25 s. Final warm builds took 1.40–1.84 s.
This variability points to filesystem/cache work as an additional contributor,
not a demonstrated universal root cause of the original 72-second report.
No cloud settings were changed and the project was not moved.

## Changes

- `src/scene/assets.js`: one Meshopt-enabled GLTF loader and Suspense cache,
  shared across previews, grouped consumers and staged preloading. Pools/museum
  load first, then vegetation, then surrounding architecture. The complete
  initial composition is ready before entry; large structures do not pop in.
  Walking models wait for observation pedestrians.
- `src/App.jsx`, `src/Experience.jsx`: lazy scene code, restrained pastel loading
  interface, explicit asset/GPU readiness and gated entry/camera interaction.
  The existing entrance animation remains. Experience and `src/World3D.jsx`
  memoize unchanged props.
- `src/scene/LoadingScreen.jsx`, `src/styles/loading.css`, `src/style.css`:
  loading and optional diagnostic UI only; existing scene styling is retained.
- `src/ReferenceMuseum.jsx`, `src/ReferencePool.jsx`, `src/TexturedTree.jsx`,
  `src/UploadedArchitecture.jsx`, `src/AnimatedVisitor.jsx`: shared optimized
  model paths. Reuse computed tree geometry bounds and remove constant-opacity
  frame traversals. Idle-only preview loading is set in
  `src/collaboration/components/AvatarPreview.jsx`; its code is lazy-loaded by
  `VisitorEntry.jsx`.
- `src/scene/objectLifecycle.js`, `src/scene/cameraObstacles.js`,
  `src/scene/MemorialCameraRig.jsx`: observe topology changes and cache collision
  bounds. Padding includes the existing vegetation sway. No repeated whole-scene
  collision scan in a stable scene.
- `src/DreamySurfaceLight.jsx`: patch live materials before first draw, preserve
  their existing shader hooks, and restore/release hooks when objects leave.
  Atmospheric shader math and uniform animation are unchanged.
- `src/scene/visitorVisibility.js`, `src/AnimatedVisitor.jsx`: skip expensive
  foot-grounding work while paused or outside a conservative camera frustum.
  Animation mixer time and route alignment continue, and meshes remain renderable
  for shadows.
- `src/scene/ScenePerformance.jsx`: warm-up and opt-in rendering/resource samples.
- `src/collaboration/config.js`, `socket.js`, `useMemorialSocket.js`,
  `components/CollaborationStatus.jsx`: offline feature flag and status;
  enabled connections retain reconnection with backoff up to 30 seconds and
  existing listener cleanup. No server implementation or protocol was replaced.
- `.env.example`, `.env.offline`, `.gitignore`, `vite.config.js`, `package.json`,
  `package-lock.json`: documented flags, offline/asset scripts, strict frontend
  port, explicit dependency prebundling and external temporary dependency cache.
- `scripts/optimize-assets.mjs`, `scripts/verify-asset-textures.mjs`,
  `public/models/optimized/*.glb`: reproducible asset copies and verification.
- `server/tests/performance.test.js`: topology, collision-cache, visibility,
  offline connection and material-hook regression coverage.

Fiber 8's `shadows={true}` selects deprecated `PCFSoftShadowMap` with the installed
Three.js 0.186.1. `shadows="percentage"` selects supported `PCFShadowMap`, the same
fallback Three was already using. DPR [1, 1.8], antialiasing, exposure, 2048 shadow
maps, bloom, clouds, fog, water and celestial shaders remain unchanged. No
instancing conversion, decimation or adaptive-resolution compromise was needed.

## Asset results

All sizes below are bytes, before → after:

- reference-pool: 3,532,192 → 60,964
- reference-museum: 902,164 → 430,752
- survivor-sakura: 5,113,220 → 3,234,932
- jabami-bush: 282,052 → 195,988
- jabami-tree-v1: 817,540 → 646,460
- jabami-tree-v4: 515,376 → 445,084
- oculus: 11,407,032 → 5,414,124
- city-lowpoly: 641,988 → 436,528
- city-newyork: 885,148 → 729,908
- one-world-trade-center: 1,441,856 → 764,988
- male-idle: 520,216 → 266,248
- female-idle: 452,556 → 235,396
- male-walk: 310,696 → 174,968
- female-walk: 321,444 → 182,952

All active assets: **27,143,480 → 13,219,292 bytes (51.3% smaller)**.
Initial GLBs: **27,143,480 → 12,861,372 bytes (52.6% smaller)**, because the
357,920 bytes of optimized walking clips load later. The architecture was not
replaced. Meshopt is lossless here: no quantization transform, simplification or
vertex reorder is applied. Its encoder may cyclically rotate triangle indices;
verification normalizes that rotation while preserving winding. Accessor values,
node transforms and animation data were compared after decoding every output.

Color PNGs become full-resolution lossless WebP. The verifier checked all 33
retained material-slot textures, including alpha; RGB beneath fully transparent
pixels is ignored. Existing non-color maps remain. Only color maps already
removed by the runtime pool/museum/Oculus materials are pruned. Texture dimensions,
visible pixels and placement geometry are preserved. Originals also remain in
production's public directory as backups; their presence does not cause them
to download during a visit.

## Measurements and limits

The user-reported cold baseline was approximately 72 seconds, 34.8 MB and 142
requests. That report is retained as context, not a controlled benchmark.

A separate checkout of the original HEAD source/assets was served for a warm
comparison, with the current installed dependencies and a separate temporary
Vite cache. Native Chrome used Disable cache and no throttling. Browser
extensions stayed enabled and added requests/bytes. The baseline code was
unchanged; only its temporary Vite cache/server configuration differed.

- Original warm sample: Network displayed **36,577,420 bytes, 145 requests**,
  DOMContentLoaded 336 ms, window load 450 ms, Network finish 2.19 s. Its HAR
  contained 14 unique GLBs totaling 27,143,480 content bytes; last GLB completed
  at approximately 1.147 s.
- Optimized first recorded sample: **22,378,918 bytes, 137 requests**, window
  load 7.83 s and Network finish 9.11 s. The model content was 12,861,372 bytes
  over 12 unique GLB requests. The last GLB completed at 8.307 s. Most elapsed
  time preceded asset requests: development code loading/transform/cache work
  mattered in this sample. Total displayed transfer fell approximately 38.8%.
- Optimized warm offline sample: DOMContentLoaded **320 ms**, window load
  **443 ms**, initial model requests finished by the early 1.07-second Network
  snapshot. Extension activity extended finish to 2.20 s and total to 22.38 MB.
  Entering later fetched an extension font; enabling pedestrians fetched the two
  walking clips once. Those user-triggered requests extend Network's finish
  timestamp and must not be interpreted as initial load time.
- Renderer diagnostic samples: approximately **120 FPS, 1,146 render calls and
  1,125,880 triangles** initially; approximately **84–116 FPS** with the sun/tree
  observation activity. Counts include rendering passes, including shadows.
  No pre-change comparable FPS recording was captured, so there is no supported
  percentage FPS improvement. Compression preserves geometry/draw counts.
- Final warm production build: **1.40 seconds**, versus an earlier untouched
  baseline build of 13.96 seconds. Filesystem/cache conditions differ; this is
  not a controlled compiler-speed improvement. App entry JS is now about
  199.04 kB (64.52 kB gzip), separated from the ~959.77 kB Three/actor chunk and
  ~159.13 kB scene chunk. The old single entry was ~1,291.09 kB.

Window load and Network finish do not measure complete WebGL readiness.
Code splitting also changes when the load event can fire. Asset/decode and GPU
compilation have separate Performance marks for repeatable follow-up. An exact
before/after time-to-interactive and GPU compilation duration could not be
obtained in this session and are not claimed.

## Validation and remaining work

`npm test`: **29 passing tests**. Real Socket.io clients verify health, CORS,
joining, usernames/avatar edits, room isolation, presence, reconnects and
contribution acknowledgements. The running existing backend returned
`{"status":"ok","service":"elsewhere-memorial"}` at localhost:3001.
Offline regression verifies no socket factory call on mount, rerender, reconnect
or zone changes. Mounted camera tests cover main/tree/all four pool sides/all
photography views, mouse/touch orbit, wraps, drag ownership and previews. Actual
pool geometry still supplies all 48 valid anchors. Material tests preserve
existing shaders and verify removal cleanup.

All 14 optimized assets passed decoded geometry/animation checks during generation.
`npm run assets:verify` passes for retained texture pixels. `npm run build`
passes. An offline production build also passes, and its preview serves HTML,
JS, CSS and compressed pool geometry with HTTP 200.

Native Chrome confirmed the original and optimized memorial compositions, avatar
entry, offline status, sun puzzle placement, tree observation reveal and
Survivor Tree interaction controls. Images retained architecture, vegetation,
water and atmosphere; they are qualitative checks, not pixel-identical captures
of time-varying shaders. Later native browser actions returned stale state and
`noWindowsAvailable`; the browser access host was unavailable. Full manual moon
drag, four-side navigation, photo capture/archive, two-window identity and
production visual checks remain unverified in this session. Automated camera
and two-client checks passed; they do not replace those manual checks.

Remaining costs: the detailed Oculus geometry, many vegetation/material draws,
transparent atmospheric overdraw, post-processing, shader compilation on
appearance changes and cold file-provider/dependency reads. These were not
traded away for visual simplification. A future controlled benchmark should
use the same camera, puzzle state, foreground viewport and warmed filesystem,
record scene-ready plus a foreground frame trace, and repeat on target hardware.

A Vite large-chunk advisory remains for the shared rendering chunk. Fiber 8 and
its test renderer also emit Three.Clock / CommonJS deprecation warnings with
this newer Three version. Those originate in dependencies; a compatible
React/Fiber migration is separate work, rather than a silent dependency rewrite.
The application no longer asks for PCFSoft shadows. No note or flower placement
UI was added.
