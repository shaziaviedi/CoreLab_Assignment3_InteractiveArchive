# ELSEWHERE integration and deployment review

Reviewed November 22, 2026. Local integration checks passed. Publication and a live
GitHub Pages-to-Render two-visitor check are **not complete**.

## Functionality and assignment coverage

The application has a React/Vite frontend, a Node/Express HTTP server, and Socket.io
on the same HTTP server. `CollaborationProvider`, `VisitorEntry`, connection/presence
components, tree components and flower components satisfy the component requirement.
`useMemorialSocket` stores shared notes, flowers and visitors using `useState`,
registers listeners once inside `useEffect`, and removes those exact handlers with
`socket.off` plus manager/visibility listeners and heartbeat timers on cleanup.

Room links join without authentication. The server supplies authoritative snapshots,
contribution IDs/timestamps, validated author information, occupancy and idempotency.
Profile edits, presence, contribution broadcasts and reconnect snapshots work locally.
Visible avatars reuse the existing male/female models. No camera, puzzle, observation
playback, sun/moon or photographic state is sent to peers.

Tree interaction includes a dedicated camera, close horizontal orbit, a 180-character
composer/live preview, discrete attachment anchors, keyboard placement, shared paper
tags, author details and reversible local hiding. North Pool interaction includes
four measured camera sides, direct rose placement, previews and projected author/time
metadata on hover, focus and tap. All roses share one model. Flower payloads and UI
have no dedication, recipient, message, type selection, confirmation or customization.

## Fixes and deployment preparation

- Added configurable, validated Vite base paths. Local/root hosting keeps `/`;
  Pages uses the repository path returned by GitHub's configuration action.
- Added `npm start`, explicit `0.0.0.0` binding and a Render Blueprint with the
  production install/start commands, health path and exact Pages/Vercel origins.
  Render supplies `PORT`; `.node-version` selects Node 22.
- Added CI and Pages workflows. Pinned action commits were checked against GitHub
  and returned HTTP 200. YAML parses locally; the workflows have not run on GitHub.
- Added a production gate that checks HTTPS configuration, actual ELSEWHERE health
  and the frontend CORS origin before Pages upload. Supplying the existing Vercel
  frontend as the backend correctly fails with `/health` HTTP 404.
- Centralized the runtime asset manifest and added built-file checks for repository
  prefixes, all 14 GLBs, seven SVG assets, embedded GLB resources and the compiled
  backend URL. No model or texture was replaced.
- Added a reusable network verifier for published URLs, two transports, multiple
  clients, shared notes/flowers, conflicts, late joining and reconnect snapshots.
- Added a layout-version compatibility guard: an outdated deployed client cannot
  place contributions against an incompatible server layout and must reload.
- Fixed the photography flash timeout so it is cancelled on unmount and before a
  later capture. Existing visual styles and local scene behavior are unchanged.
- Reorganized README coverage around development, state ownership, protocol,
  interactions, deployment, verification and limitations.

## Automated checks actually performed

The validation copy's `src`, `server` and `shared` files match the working source.
It used a normal temporary filesystem to avoid the workspace's intermittent slow
file-provider reads. Test host: Node 24.21.0. CI/Render target Node 22; a hosted CI
run on that target is still pending.

- `npm test`: **56 passed, zero failures**, including real Socket.io servers and
  mounted frontend hooks. Checks cover rooms/counts/profiles, broadcasts, room
  isolation, simultaneous occupancy races, invalid text/coordinates/extra fields,
  contribution/presence throttles, successful retry idempotency, late joining,
  reconnect snapshots, layout mismatch and repeated mount/unmount listener cleanup.
- Mounted Fiber tests cover every camera mode/transfer, all pool sides/wraps,
  close tree mouse/touch orbit, collision clearance, drag/click ownership,
  preview behavior, retained drafts, flower focus/tap metadata and reduced motion.
- Geometry tests read the original actual pool GLB and validate all 48 parapet
  hits, orientations and complete rose footprints. Camera/lighting rerenders keep
  the flowers' world positions. Optimized model geometry was preserved by the
  earlier verified asset pipeline; this review also checks the built GLB contents.
- Production build with `/CoreLab_Assignment3_InteractiveArchive/`: passed.
  `build:verify`: **21 public assets passed**, including all runtime character GLBs.
- A separate offline/root-path build and its 21-asset verification also passed.
- `npm run assets:verify`: **33 retained full-resolution color/alpha textures passed**.
- The final deployment verifier passed against the repository-path production
  preview and isolated backend: WebSocket plus polling, two independent identities,
  shared note/flower broadcasts, one-winner placement race, third-client snapshot
  and reconnect reconciliation. This was a local network test, not a live deployment.
- Render's production install (`npm ci --omit=dev`, using the local npm cache)
  succeeded in a separate disposable copy. `npm start` with `PORT=3003` started;
  its health response and exact frontend CORS were verified with no dev packages.
- `npm audit --omit=dev`: **zero reported production vulnerabilities** at review time.
- `git diff --check`: passed. Render and workflow YAML syntax parsed successfully.

## Manual two-session browser checks actually performed

Native Chrome used two separately stored identities/origins against the same room:
`127.0.0.1:5180` as **Integration A / male** and `localhost:5180` as
**Integration B / female**, both with the repository base path and
`?room=integration-review`. These were simultaneous independent browser sessions,
not two views backed by the same identity. The unavailable browser-access host was
worked around with native UI control.

Confirmed:

- Both showed **Connected · 2 visitors**, the correct peer name/avatar and zone.
- A used Sun while B used Moon. B's pool photography remained **EVENING** and its
  captured archive photograph retained that state while A navigated separately.
- B entered the actual 3D North Pool hotspot and placed a rose with one click.
  A saw B's rose and author metadata without a page reload.
- Clicking the placed rose and keyboard focus exposed **Integration B** and
  **November 22, 2026 at 3:20 AM**. A read-only observer snapshot confirmed server
  time `2026-11-22T08:20:38.963Z` at `north-pool-north-07`, which formats to that
  displayed time in America/New_York.
- Pool navigation reached and settled on **1/4 north, 2/4 east, 3/4 south,
  4/4 west**. Photography returned to the preserved west-side interaction view.
- Photo capture changed **Memories 0 → 1**; the archive showed the captured North
  Pool image and observation-derived pedestrian count.
- A entered the actual 3D Survivor Tree hotspot, wrote a message, saw its live
  preview, tabbed to attachment point 1 and pressed Enter to attach it.
- B received that tag without refreshing, opened it by keyboard, and read A's full
  message, male avatar description, author name and date/time.
- B hid and restored that message locally. A close tree drag changed the orbit
  and the visible attachment points without moving the installation.

Automated tests, rather than this manual pass, establish simultaneous races,
third-visitor reconciliation, reconnect edge cases, all camera-pair combinations,
full orbit sampling, touch events and reduced-motion event changes. A physical
mobile/touch-device pass and a clean-profile browser matrix remain outstanding.

## Console and performance observations

The reviewed browser console showed the known Three.Clock dependency deprecation,
WebGL context-loss informational messages during disposable avatar-preview Canvas
cleanup, and browser-extension warnings. No React warning, failed shader/model
load or application exception was observed in the reviewed interactions.

DevTools also listed one CSP `eval` issue without a source location. The application
source has no `eval`/`new Function`, and the preview response sets no CSP header.
Its origin is unconfirmed; recheck in a clean profile before claiming an entirely
clean browser console. No security policy was weakened to suppress it.

The shared rendering chunk still produces Vite's >500 kB advisory. Detailed geometry,
shadows and atmospheric postprocessing retain their existing costs. This review
makes no new FPS or load-time improvement claim. See `docs/performance.md` for the
previous asset measurements, methodology and dependency limitations.

## Actual published status and remaining account steps

- Existing frontend: https://core-lab-assignment3-interactive-ar.vercel.app/ returned
  HTTP 200. Its public entry bundle's socket factory throws
  `Set VITE_SOCKET_URL to connect to the memorial server.` No backend is compiled
  into that deployed version. Its `/health` returns HTTP 404, so it is not the backend.
- GitHub's public repository metadata reported `has_pages: false`. The expected
  Pages project URL returned HTTP 404:
  https://shaziaviedi.github.io/CoreLab_Assignment3_InteractiveArchive/
- No actual Render service URL was supplied or found. No Render API credential is
  available, and opening Render Dashboard reached its sign-in form. No service
  creation or authenticated deployment was performed.
- The project still contains uncommitted work, including earlier feature work and
  untracked optimized models/components. Nothing was committed, pushed, published,
  or marked as a successful hosted CI run during this review.

To finish:

1. Sign into Render and deploy this repository's `render.yaml` as a Blueprint, or
   create the equivalent Node Web Service using the README commands/environment.
2. Verify its real `/health`, then set repository Actions variable `VITE_SOCKET_URL`
   to that actual HTTPS service origin.
3. Enable GitHub Pages with **GitHub Actions** as the publishing source. Commit/push
   the complete project and run **Deploy GitHub Pages**. Review the resulting URL
   and the workflow's health/CORS/build checks.
4. Run `deployment:verify` with the actual published frontend/backend URLs, then
   repeat the manual two-session checks there. Those live tests remain unperformed.
5. To keep the existing Vercel frontend connected too, set its production socket
   URL and collaboration flag, keep base `/`, and redeploy it. The Blueprint already
   allows that origin alongside Pages.

All shared contributions are in memory and disappear on backend restart/redeploy.
Use one server instance until persistence and a Socket.io adapter are added.
Identity is anonymous continuity; rooms/CORS are not authentication. The public-note
control is local hiding, not global moderation.

## Files added or modified in this review

Deployment configuration:

- `.node-version`, `.env.example`, `package.json`, `vite.config.js`, `render.yaml`
- `.github/workflows/ci.yml`, `.github/workflows/pages.yml`
- `server/index.js`

Verification and assets:

- `scripts/deployment/config.mjs`, `check-config.mjs`, `verify-backend.mjs`,
  `verify-build.mjs`, `verify-live.mjs`
- `src/scene/assetManifest.js`, `src/scene/assets.js`
- `server/tests/deployment.test.js`

Integration fixes/documentation:

- `src/collaboration/useMemorialSocket.js`
- `src/Experience.jsx`
- `README.md`, `docs/integration-review.md`

Earlier feature files and user changes remain intact. The backend, shared protocol,
collaboration components, scene helpers and scoped CSS retain their established
separation; deployment checks live together under `scripts/deployment`.
