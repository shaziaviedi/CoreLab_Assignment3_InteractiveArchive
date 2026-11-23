# Message hover and close-up navigation refinements

Implemented November 23, 2026. No deployment was performed.

## Behavior

The canvas retains its existing glowing magnifier cursor. The additional projected
magnifier button is removed; plain View Message text follows the pointer's client
coordinates beside the native cursor. The label cannot intercept pointer events.
Leaving a note, starting a camera transfer or closing viewing clears it. Keyboard
and touch reading targets and contributor/time metadata remain available.

The existing tree hook owns these local viewing states:

- Browsing (`idle`/`browse`): close tree orbit, with RETURN TO MAP and LEAVE A MESSAGE.
- Reading (`read`): close-up physical paper, with only BACK TO MESSAGES and HIDE
  MESSAGES. The keyboard target grid and normal navigation are absent here.
- Hidden viewing (`hidden`): wider existing tree camera, cleared selection/hover,
  with RETURN TO MAP and VIEW MESSAGES for re-entry. This does not open the composer
  or change the shared notes, occupied positions, local hidden-note IDs or draft.
- Composition/placement: existing CANCEL/SUBMIT and placement flow are retained.

BACK TO MESSAGES explicitly enters browsing, even when reading started during
placement. It keeps the draft and restores the saved orbit without composing.
Camera changes mark the transition synchronously, preventing a frame of controls
from the destination appearing before the rig starts moving. Navigation waits for
arrival. Tree-to-tree transfers follow the exterior cylindrical path in both
directions, including from a note to the wider tree camera.

## Files

- `src/collaboration/tree/TreeNotes3D.jsx`: pointer-following label and cleanup.
- `src/collaboration/tree/TreeNoteAccessibility.jsx`: text-only label, retained
  accessible reading/metadata targets, no target grid during close-up reading.
- `src/collaboration/tree/TreeNotePanel.jsx`: two close-up actions.
- `src/collaboration/tree/useTreeNotes.js`: local close/back/re-entry behavior and
  synchronous camera transition notifications, including Escape cancellation.
- `src/scene/MemorialNavigation.jsx`: state-specific navigation visibility/re-entry.
- `src/scene/MemorialCameraRig.jsx`: exterior path when returning to the wider view.
- `src/Experience.jsx`: existing camera/hook state wiring and disabled interactions
  while message viewing is hidden.
- `src/styles/tree-notes.css`: pointer-following text and aligned responsive reader
  controls in the existing bottom navigation area.
- `server/tests/messageViewing.test.js` (new), `cameraRig.test.js` and
  `noteSafety.test.js`: behavior and camera regression coverage.
- `README.md`: current interaction documentation.

No Socket.io events, contribution payloads, shared layout version, dependencies,
models or North Pool interactions changed. Existing uncommitted startup diagnostics
in `scripts/dev.mjs` and the README's local-development section predate this work.

## Verification

- `npm test`: 88/88 passed, including actual pointer-handler/frame updates, cursor
  label cleanup, two-action reader markup, draft/shared-note preservation, saved
  orbit restoration, exterior camera travel and real multi-client synchronization,
  placement conflict and reconnect tests.
- `npm run build`: passed. The existing large-chunk advisory remains.
- `npm run build:verify`: all 22 public assets verified.
- Local development started successfully. Chrome rendered the memorial and showed
  Connected · 1 visitor in the isolated `message-view-review` room.

Browser-host access was unavailable; native Chrome controls subsequently reported
no available windows. Consequently manual hover/close-up visual checks and browser
console inspection were not completed. Those checks are not claimed as passed.
Existing Three.Clock/CommonJS deprecation notices remain in the automated tests.
