# Connectivity, entry and camera revisions

Reviewed November 22, 2026. This report supersedes the earlier integration review
for the changes and verification described here. No deployment was performed.

## Connection diagnosis and fix

The old local process on port 3001 answered HTTP health requests but rejected the
current client's room join: `INVALID_PAYLOAD: Unexpected fields are not allowed.`
It was running an older event schema that did not accept the current presence
activity field. A healthy HTTP response alone did not establish room membership.
The client correctly remained disconnected after the rejected join.

Development startup now starts both services, waits for backend health and checks
the shared layout version before reusing an existing process. An incompatible
server produces an actionable error; the script never kills an unrelated process.
The source watcher compares file contents and watches only server/shared source,
avoiding dependency hydration events that repeatedly restarted Node's broad watch
mode and discarded in-memory rooms. Genuine server edits still restart it.

The public Vercel build inspected during this review had no compiled
`VITE_SOCKET_URL`. Its frontend URL is not a Socket.io backend. No existing public
backend URL or authenticated deployment access was available. The production
client rejects localhost and insecure backend URLs. Vercel's build now requires
a real HTTPS backend, checks its health and builds with root asset base `/`.

## Local startup

Use Node 22.9 or newer:

```sh
npm install
npm run dev
```

The defaults are frontend `http://localhost:5173`, backend
`http://localhost:3001`, enabled collaboration and room `memorial` unless the URL
supplies `?room=...`. Confirm the health response at `http://localhost:3001/health`:

```json
{"status":"ok","service":"elsewhere-memorial","layoutVersion":2}
```

Optional `.env` values (copy `.env.example`):

```dotenv
PORT=3001
VITE_SOCKET_URL=http://localhost:3001
VITE_ENABLE_COLLAB=true
VITE_BASE_PATH=/
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

If Vite uses another port, include its exact origin in `CORS_ORIGINS`. To run in
separate terminals, use `npm run server:dev` and `npm run dev:client`. Stop the old
backend before restarting if startup reports a version mismatch. Publish client
and backend together when the shared layout version changes.

## Interface and camera behavior

- One App-owned loading state coordinates code, scene assets and GPU readiness.
  Loading finishes before the existing landing and introductory transition.
  First-time identity entry follows that transition; saved identities skip setup.
- Existing character models are cropped to circular head/shoulder portraits.
  The main portrait sits immediately right of Reset, with connection/count below.
  Editing retains the existing identity persistence and shared profile updates.
- Pool camera ordering follows the viewer's right/left direction on every side,
  including wraparound. Stable shared pool-side and flower-anchor IDs are unchanged.
- The default tree view uses the original wide photography composition. Choosing
  Leave a message enables the closer orbit/composer/placement state. Completion or
  cancellation restores the wide view.
- The tree installation radius is 0.85 scene units, its upper rail 0.82 and posts
  0.9 high. Tags scale to 0.72 and use recalculated shared anchor transforms.
  Observation routes reserve 1.25 units around the installation. Tree geometry,
  fence materials and actor models remain intact. Shared layout version is 2.
- Dedicated tree/pool views use RETURN TO MAP with photography's button styling.
  Photograph This Place and transition helper labels were removed. Photography
  retains capture/archive behavior and has no note or flower placement entry.

Notes, flowers and presence remain server-authoritative. Camera positions, sun/
moon puzzle state, observation playback and the photographic archive remain local.
Flower data and the single rose model are unchanged; there are no new flower fields
or forms.

## Files changed

- Startup/deployment: `package.json`, `package-lock.json`, `.env.example`,
  `render.yaml`, `vercel.json`, `server/app.js`, `scripts/dev.mjs`,
  `scripts/watch-server.mjs`, `scripts/deployment/build-vercel.mjs`.
- Entry/identity: `src/App.jsx`, `src/Experience.jsx`,
  `src/collaboration/components/{VisitorEntry,AvatarPreview,CollaborationStatus}.jsx`,
  `src/collaboration/{config,socket}.js`, `src/scene/LoadingScreen.jsx`.
- Camera/installation: `src/scene/{MemorialCameraRig,MemorialNavigation}.jsx`,
  `src/scene/navigation.js`, `shared/memorialLayout.js`, `src/World3D.jsx`,
  `src/collaboration/tree/{TreeNotePanel,TreeNotes3D}.jsx`,
  `src/collaboration/tree/treeNoteLayout.js`.
- Scoped styles: `src/styles/{arrival,collaboration,loading,memorial-navigation}.css`.
- Tests: new `server/tests/{development,entryFlow}.test.js`; updated cameraRig,
  collaboration, flowers, navigation and treeNotes tests. Documentation: README
  and this report.

## Verification performed

Automated suite: 64 tests passed. Coverage includes real Socket.io clients, room
snapshots, contribution conflicts/idempotency/rate limits, identity/presence, listener
cleanup, automatic reconnect after an actual server restart, loading/profile order,
portrait framing, every camera transition including wide/close tree, all pool-side
directions and wraparound, anchor geometry, reduced motion and placement metadata.
Watcher verification distinguishes identical file rewrites from real source edits.

Manual Chrome verification used two independent incognito windows and separate
localStorage origins (`127.0.0.1:5180` and `localhost:5180`) in room `revision-review`,
both connected to the actual workspace backend on port 3001. A synchronized temporary
frontend copy avoided the workspace's slow file-provider reads during browser QA.

Observed:

- First-time loading/intro/profile order and returning visitor identity persistence.
- Revision A/male and Revision B/female, correct portraits and two-visitor count.
- B placed a rose with one click; A saw it without refreshing and opened its
  contributor/time label. The label showed Revision B and the server timestamp
  formatted locally as November 22, 2026 at 2:52 PM.
- A composed, orbited and attached a note to the resized installation. B received
  the live notification and read the exact text, Revision A, Male avatar and time.
- Pool navigation visited all four sides and wrapped back to the first.
- A used Sun while B used Moon, preserving independent environmental state.
- Tree wide view, close message orbit, return controls, photograph capture and
  personal archive worked. The archive contained the captured Survivor Tree image.
  Photography exposed no placement controls.

Production compilation and built-asset verification passed. Missing production
backend configuration is intentionally rejected by `build:vercel`. These are local
build checks, not proof of a deployed Socket.io connection. Asset verification also passed for all 33 retained full-resolution color/alpha
textures. The production build verified all 21 public assets under the root base.

## Exact remaining deployment steps

1. Reuse the existing persistent backend if one exists; otherwise create the
   Render web service from `render.yaml`. Build: `npm ci --omit=dev`; start:
   `npm start`; health: `/health`. Render supplies `PORT`.
2. Set backend `CORS_ORIGINS` to the exact frontend origins, including
   `https://core-lab-assignment3-interactive-ar.vercel.app` and the actual Pages
   account origin when publishing Pages. Use comma-separated origins, no paths.
3. Deploy the updated backend and obtain its actual HTTPS origin. Check health
   and layout version 2. Contributions disappear on restart under current storage.
4. In Vercel Production (and Preview if used), set `VITE_ENABLE_COLLAB=true`,
   `VITE_SOCKET_URL` to that HTTPS origin with no trailing slash, and
   `VITE_BASE_PATH=/`. Set optional `FRONTEND_URL` to the Vercel frontend URL to
   enforce its CORS check during the build. Redeploy using `vercel.json`.
5. For the assignment's separate Pages requirement, configure the repository
   `VITE_SOCKET_URL` variable and enable the existing Pages Actions workflow.
6. Run `npm run deployment:verify` with the actual `FRONTEND_URL` and
   `VITE_SOCKET_URL`, then repeat two-window UI verification on those public URLs.

Authenticated Vercel deployment tools and a public backend URL were unavailable,
so redeployment and live Vercel/Pages-to-backend tests remain unperformed. The known
Vercel URL identifies the existing frontend, not a verified revised deployment.

## Remaining limitations

Room storage remains in memory; restarting a backend clears contributions. Use a
single backend instance until shared durable storage is implemented. Vite still
reports the existing large rendering chunk; Three.Clock/CommonJS dependency
notices remain. No React/Fiber upgrade or shader/model replacement was introduced.
Full physical touchscreen, narrow-screen and cross-browser visual testing remain
manual follow-up; automated input checks do not replace that device matrix.
