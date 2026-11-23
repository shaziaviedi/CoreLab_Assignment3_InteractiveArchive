import { useRef } from "react";

export function canActivate(gesture, event) {
  return gesture.ready && !gesture.dragged && !gesture.fragmentDragging &&
    !gesture.pointers && event.button === 0 && (event.delta ?? 0) < 6;
}

// Keep the drag latch until the next pointerdown to suppress its trailing click,
// but resume hover as soon as all pointers are released.
export function canHover(gesture) {
  return gesture.ready && !gesture.fragmentDragging && !(gesture.dragged && gesture.pointers > 0);
}

export default function useInteractionMode() {
  return useRef({
    ready: false,
    dragged: false,
    pointers: 0,
    fragmentDragging: false,
    downX: 0,
    downY: 0,
  });
}
