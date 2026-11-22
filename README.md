# ELSEWHERE

ELSEWHERE is an experimental interactive memorial: an immersive React and Three.js
reconstruction of the 9/11 Memorial, with a sun/moon puzzle, observational pedestrian
animations, cinematic viewpoints, visitor photography, Survivor Tree paper messages,
and shared colored roses around the North Pool. Collaboration stays quiet and requires
no account. Camera movement, puzzle progress, atmosphere and photographs remain local.

Technical stack: React 18, Three.js, React Three Fiber, postprocessing and Vite;
Node.js, Express 5 and Socket.io 4. Shared room data uses React `useState`. Socket
listeners are registered in `useEffect` and removed with the same handlers through
`socket.off` when the provider unmounts. `.node-version` selects Node 22 for CI/Render;
local Node must be at least 22.9. The dependency lockfile is committed.

## Install and run locally

```sh
npm ci
cp .env.example .env
npm run dev
```

One command starts the existing Express/Socket.io backend on port 3001 and Vite on
port 5173. Open `http://localhost:5173/?room=memorial`. The launcher waits for a healthy,
compatible backend and reuses an already-running compatible server. It never kills
an unrelated process. If an old backend occupies 3001, stop its terminal process
and rerun the command. `PORT` and the local `VITE_SOCKET_URL` port must match.

`GET http://localhost:3001/health` returns `status`, `service`, and `layoutVersion`.
Development watching checks actual source contents under `server`/`shared`, so
file-provider hydration or dependency reads do not repeatedly restart the backend.
Actual server edits still restart it and clear its in-memory contributions.

For separate terminals, run `npm run server:dev` and `npm run dev:client`.
`npm run server` loads `.env` without watching. `npm start` is the production entry
point and reads the host's environment. `npm run dev:offline` preserves scene-only
work without a socket or reconnect loop. If changing Vite's port, update CORS origins.

## Environment variables

Backend variables:

- `PORT`: Render supplies this; local default is `3001`. The HTTP server binds to
  `0.0.0.0` and attaches Socket.io to the same server/port.
- `CORS_ORIGINS`: comma-separated exact frontend origins. Local defaults are
  `http://localhost:5173,http://127.0.0.1:5173`. Pages production uses
  `https://shaziaviedi.github.io`, without a repository path or trailing slash.
  Set the production origins explicitly when Render prompts for `CORS_ORIGINS`.
- `CONTRIBUTION_LIMIT`: note/flower attempts per socket/window; default `6`.
- `CONTRIBUTION_WINDOW_MS`: contribution rate window; default `60000`.
- `NODE_ENV`: `production` on Render.

Frontend variables are public and compiled into the build:

- `VITE_SOCKET_URL`: backend HTTP(S) origin, for example the actual HTTPS origin
  shown by Render after deployment. Development defaults to localhost:3001;
  production has no implicit backend. Rebuild after changing this variable.
- `VITE_ENABLE_COLLAB`: `true` for the assignment deployment; `false` for offline work.
- `VITE_BASE_PATH`: `/` locally or on a root-domain deployment. For this repository's
  Pages URL, use `/CoreLab_Assignment3_InteractiveArchive/`. The Pages workflow
  derives the path from GitHub's Pages configuration, including custom domains.

Never put credentials in a `VITE_` variable. `.env` and local override files are
ignored by Git. Restart local servers after environment edits.

## Rooms, identity and presence

After loading, visitors see the original landing/intro animation, then first-time
profile setup before any interactive controls are enabled. Visitors choose a username
(maximum 24 Unicode code points) and a circular head/shoulder portrait rendered from
the existing male or female character model. Their name, avatar and stable anonymous visitor ID are
saved in localStorage; blocked storage falls back to the current session. The portrait beside Reset allows later edits without recreating the memorial.
No username is permanently displayed beside it; connection status/count sit below it.

`?room=your-room` joins that room without login. No query joins `memorial`. Room IDs
allow 1–64 ASCII letters, numbers, underscores or hyphens and are case-sensitive.
Invalid supplied IDs produce an error. Rooms are shareable identifiers, not secrets
or access controls. Copy room link preserves the repository path and room ID,
without copying diagnostic parameters or identity. A read-only URL fallback is
provided when clipboard access fails.

The compact connection control displays connected/reconnecting/disconnected state,
the session count and an expandable accessible visitor list. Other visitors use the existing avatar
models, small projected usernames, zones and temporary activity cues. Standing
locations represent zones, not exact camera positions. Bodies fade near the camera,
never capture raycasts and relocate between safe points without walking through
memorial elements. Up to 24 other avatars are drawn; the count/list includes all
sessions. Tabs on the same origin share the stored identity; use separate browser
profiles or localhost versus 127.0.0.1 for independent local test identities.

Presence changes are coalesced at 500 ms. Visible activity renews every 8 seconds,
expires after 20 seconds, and becomes idle in background tabs. The server also
limits presence broadcasts to six updates per socket/second. Contribution notices
are deduplicated, expire quickly and limit remote feedback to one per six seconds.
Historical contributions are not announced when joining/reconnecting.

## Survivor Tree messages

Place the Tree fragment and choose **Leave a message** on the map. This directly
opens the close-up orbit and composer. Cancel writing to stay near the tree;
hover the fence for the glowing magnifier and **View Messages**, or use its
keyboard-accessible equivalent. Browsing, reading and placement share the same
lower orbit and retain its angle. The photography camera icon keeps its original
wide composition and separate shutter/archive controls.

Write up to 180 Unicode code points, preview the paper tag, then move over the
fence to choose an attachment position. A single cylindrical raycast surface snaps
to 96 angular columns and 26 height rows (2 cm vertical steps). Smaller tags use
scale 0.38. Their top attachments range from 0.32 to 0.82 scene units. Keyboard
users can Tab through 96 coarser positions, plus every existing note. Notes attach
to the surrounding installation, never the bark. Overlapping positions show a red
tint and cannot overwrite existing notes. Server-side collision checks include
neighbors and wraparound at the cylinder seam. Legacy tree-01–tree-24 records
still resolve to their original attachment heights/angles.

The reduced fence is centered on the visible lower bark rather than asymmetric
canopy bounds. Shared layout version is 3; deploy frontend and backend together.
Observation actors retain shoulder clearance. **← RETURN TO MAP** uses the existing
photography return styling. A pending request blocks duplicates; rejected or
uncertain submissions preserve the draft and original retry identity.

Click/focus an existing tag to read its full text, author, chosen avatar and local
date/time. Text is rendered literally, never as HTML. The reader offers reversible
**Hide this message on this browser**. Hidden IDs are stored locally per room;
neutral paper remains and its anchor stays occupied. This is local hiding, not a
moderator report or removal for other visitors.

## North Pool flowers

Place the Pool fragment and enter its 3D hotspot. Arrows follow the inward-facing
camera’s screen-right/left direction on all four sides, including wraps; side labels
follow the same camera ordering. **RETURN TO MAP** exits. Photography remains a
separate camera-icon action with no placement control. Choose a rose color using
five compact swatches, then hover a free parapet point for a translucent colored
preview and click once to request placement. Touch users can tap a free point;
keyboard users can Tab to a visible point and press Enter/Space.

All visitors share one lightweight rose geometry. Material colors are white
(default), pale pink, red, peach and lavender. There are no dedication, recipient,
message fields or confirmation forms. Legacy flowers without roseColor render
white. The 48 stable anchors (12 per side) are raycast onto the actual parapet
geometry. A stable ID/anchor hash adds slight horizontal rotation and tiny local
offsets, preserving stone contact and the reserved outer lip. Every client sees
the same transform across camera, lighting, reload and reconnect changes.

Hovering a placed rose shows only contributor username and placement date/time.
The same metadata appears on keyboard focus and touch tap. The small translucent
label follows the flower's projected position, does not capture pointer hits,
and formats the server's ISO timestamp in the viewer's local timezone using
`Intl.DateTimeFormat`. A touch label stays until the next gesture. Failed requests
clear the preview and allow another anchor; pending requests block duplicate clicks.

## Shared and local state

Shared authoritative state:

- Visitors: socket ID, stable visitor ID, username, avatar, zone, join timestamp,
  and expiring activity.
- Notes: ID, room ID, author ID/name/avatar, text, anchor ID, fence-relative column/row, server timestamp.
- Flowers: ID, room ID, author ID/name/avatar, rose color, pool side, anchor ID, server timestamp.
  No dedication, recipient, message or flower-type fields are accepted.

Local React state:

- `useMemorialSocket`: `useState` for notes, flowers, visitors, status and feedback;
  these mirror server snapshots/events, rather than independently inventing records.
- `Experience`: puzzle fragments, sun/moon, observation playback, selected camera,
  pool side, photo archive and local interface state.
- `MemorialCameraRig`: orbit/pan/zoom and in-progress camera movement stay in refs.
- Tree composer/flower hooks: draft, selected rose color, preview, pending request, selected metadata
  and errors. Hidden-note preferences are localStorage data scoped by room.

Remote contributions never reset the camera, puzzle or observation playback.
Photography captures the canvas without HTML controls. Photographs currently live
in session memory and disappear on refresh; identity and hidden-note preferences
persist locally. Reduced-motion changes are observed live for collaboration and
camera transfers. Existing environmental shaders and visual design are retained.

## Socket.io contract and placement conflicts

Requests use acknowledgements: `{ ok: true, ... }` or
`{ ok: false, error: { code, message, ...details } }`.

- `room:join`: `{ roomId, visitorId?, username, avatarType, currentZone?, activity? }`.
  The reply contains visitor and state. `room:state` supplies
  `{ roomId, layoutVersion, revision, visitors, notes, flowers }`.
- `presence:update`: profile/zone/activity changes; broadcasts `{ roomId, visitor }`.
  Known zones are overview/tree/north/street. Note activity requires tree; flower
  activity requires north. Profile edits keep socket identity and join time.
- `presence:leave`: explicit leave, room switch or disconnect; broadcasts
  `{ roomId, socketId, visitorId }`. A socket belongs to one room.
- `note:create`: `{ requestId, text, fencePosition: { column, row }, anchorId? }`;
  columns 0–95 and rows 0–25. Canonical IDs are `fence-column-row`; legacy
  `tree-01`–`tree-24` requests are still accepted and normalized.
- `flower:create`: `{ requestId, roomId?, poolSide, anchorId, roseColor? }`; colors
  white/palePink/red/peach/lavender (omitted defaults white); sides
  north/east/south/west, anchors such as `north-pool-east-01`–`north-pool-east-12`.
- `note:created` / `flower:created`: `{ roomId, revision, note/flower }` broadcasts
  to every room member, including the sender. Clients upsert by server ID.
- `placement:error`: requester-only failure with event, request ID and error.

The server generates contribution UUIDs and ISO 8601 timestamps and uses its joined
visitor profile for author information. Raw world coordinates, out-of-bounds
fence coordinates, unknown anchors/sides/avatars/colors,
author overrides, control characters and unexpected fields are rejected. Placement
bounds/collision checks and inserts are atomic in the in-memory repository: first valid request wins;
a competing request receives `ANCHOR_OCCUPIED` and can choose another anchor.

Retry the same successful request ID and payload to receive its original record
without another insert/broadcast/rate charge. Changed payloads using that ID receive
`REQUEST_ID_REUSED`. New attempts share a per-socket rate limit across room changes.
This is basic throttling, not authenticated abuse protection. Reconnection replaces
shared arrays with the fresh room snapshot. A layout-version mismatch prevents
placement and asks the visitor to reload the deployed frontend.

## Deploy the backend to Render

1. Commit and push the complete project, including `shared`, optimized models,
   deployment scripts, tests and workflows. Untracked local files are not deployed.
2. In Render, create a Blueprint from this GitHub repository using `render.yaml`,
   or create a Node **Web Service** with repository root as its root directory.
3. Build command: `npm ci --omit=dev`. Start command: `npm start`. Health check:
   `/health`. `.node-version` selects Node 22. Let Render supply `PORT`.
4. Apply `NODE_ENV=production`, the exact Pages/Vercel origins in `CORS_ORIGINS`, and the
   contribution limits from `render.yaml`. Keep a single instance while storage
   is in memory. Render terminates TLS; Socket.io uses the same HTTP server/port
   and supports both polling and WebSocket transports without a separate service.
5. After Render reports a successful deployment, copy its actual HTTPS service
   origin and request `/health`. The service name alone is not proof of its URL.

The Blueprint uses a free service. Its availability depends on Render's account
and plan limits. **Restarts, redeployments and instance replacement lose all notes,
flowers and occupied anchors.** Do not scale to multiple instances without shared
persistence and a Socket.io adapter. Storage is separated under `server/storage`
for that later change. Anonymous identities/CORS are not authentication.

References: [Render Express deployment](https://render.com/docs/deploy-node-express-app),
[WebSocket support](https://render.com/docs/websocket),
[Node version configuration](https://render.com/docs/node-version).

## Deploy the frontend to GitHub Pages

1. In repository **Settings → Pages**, select **GitHub Actions** as the source.
2. In **Settings → Secrets and variables → Actions → Variables**, create repository
   variable `VITE_SOCKET_URL` containing the actual Render HTTPS origin (no trailing
   slash). It is public configuration, not a secret. Do not enter a guessed URL.
3. Push `main` or run **Deploy GitHub Pages** manually in the Actions tab.
   `.github/workflows/pages.yml` installs the locked dependencies, runs tests and
   texture verification, validates production settings, builds with GitHub's base
   path, verifies all public assets, and publishes `dist`. Missing production
   settings fail before upload. CI also checks pull requests without publishing.
4. Use the URL returned by the successful Pages deployment. The expected project
   path is `https://shaziaviedi.github.io/CoreLab_Assignment3_InteractiveArchive/`;
   this is a target URL, not a claim that the site is already live.
5. Open `?room=live-review` in two independent profiles. Confirm their names,
   avatars, counts, shared tags/roses, local timestamps, navigation and reconnects.
   Room links use the existing entry path and query string; no SPA fallback or
   separate server-side route is required.

For a root-domain deployment such as the existing Vercel frontend, keep
`VITE_BASE_PATH=/`, set its production `VITE_SOCKET_URL` and `VITE_ENABLE_COLLAB=true`,
add that frontend origin to Render CORS, then redeploy. `vercel.json` uses
`npm run build:vercel`; that command validates the public HTTPS backend, checks
its health, and builds with root base `/`. Optional `FRONTEND_URL` also checks CORS.
A missing/localhost socket URL stops the Vercel build. Apply the variables to
Production and any Preview environment you use, then redeploy to compile them in. A Vercel frontend does not
replace the assignment's required Pages publication or long-lived Render server.
See [Vite's Pages guide](https://vite.dev/guide/static-deploy#github-pages).

## Verification and deployment status

See [the collaborative interaction refinements](docs/interaction-refinements.md)
for the latest placement, camera, color and verification changes. The
[connectivity revisions](docs/connectivity-ui-revisions.md) record the preceding
connection diagnosis and startup/deployment instructions.
The earlier integration report records the state before these revisions.

At this review, the existing Vercel frontend was reachable but had no backend URL
compiled into it. GitHub Pages was not enabled, and Render required sign-in.
The new deployment configuration has been prepared locally; publication and live
Pages-to-Render testing remain pending account setup.

```sh
npm test
npm run assets:verify
npm run build
npm run build:verify
```

`npm run deployment:check` additionally requires an HTTPS backend, enabled
collaboration and a successful ELSEWHERE health response. Set `FRONTEND_URL` to
also check its CORS origin; the Pages workflow supplies this automatically.
For a final network check after both services are published:

```sh
FRONTEND_URL=https://shaziaviedi.github.io/CoreLab_Assignment3_InteractiveArchive/ \
VITE_SOCKET_URL=https://YOUR-ACTUAL-RENDER-HOST.onrender.com \
npm run deployment:verify
```

Replace the placeholder. This command checks frontend bytes/assets, the compiled
backend URL, health/CORS, independent WebSocket and polling clients, shared notes
and flowers, occupied-anchor races, late joining and reconnect snapshots. It writes
three test contributions in a unique `deployment-check-…` room, disconnects its
clients and leaves the public memorial room untouched. Test contributions remain
in memory until restart. This is a network smoke test, not a browser/WebGL test.

See [the integration review](docs/integration-review.md) for actual test results,
manual browser coverage, changed files, deployment status and remaining work.
No live Pages-to-Render result is claimed without the actual services and tests.

## Code organization and known limitations

- `src/App.jsx`, `Experience.jsx`, `World3D.jsx`: entry flow, local interactions and
  existing scene composition. Rendering does not move into the socket provider.
- `src/scene`: the camera writer, geometry/gesture helpers, asset manifest/cache,
  camera obstacles, loading and performance instrumentation.
- `src/collaboration`: provider/socket hook/identity; separate tree, flowers,
  presence and small interface components. Scoped styles stay under `src/styles`.
- `shared`: protocol enums and versioned placement IDs used by both client/server.
- `server`: Express/Socket.io startup, config, validation, services, storage and tests.
- `scripts/deployment`: production configuration, built-asset and live-network checks.
- `.github/workflows`, `render.yaml`: CI/Pages publication and Render service setup.

The high-detail scene still has substantial draw/triangle and shader costs; the
shared rendering bundle produces Vite's large-chunk advisory. Fiber 8/test-renderer
emit Three.Clock and CommonJS deprecation notices with the current Three version.
These are known dependency notices; no incompatible React/Fiber migration was made.
External Google Fonts use local fallbacks when unavailable. WebGL-capable hardware
is required. A full touch-device/browser matrix still requires manual testing.

Optimized models preserve original geometry/animation and retained texture pixels;
original GLBs remain as backups. `npm run assets:optimize` regenerates them and
`npm run assets:verify` checks retained color/alpha textures. `?profile=1` enables
local sampled diagnostics. See [the earlier performance report](docs/performance.md)
for asset measurements and their limitations; it records an earlier test count.
