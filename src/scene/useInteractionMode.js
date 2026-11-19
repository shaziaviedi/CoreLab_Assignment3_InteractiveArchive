import { useRef } from "react";

export function canActivate(gesture, event) {
  return gesture.ready && !gesture.dragged && !gesture.fragmentDragging &&
    !gesture.pointers && event.button === 0 && (event.delta ?? 0) < 6;
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
