const ORIGINAL_COUNT = 46;
const LEFT_EXTENSION = 10;
export const SKYLINE_COUNT = ORIGINAL_COUNT + LEFT_EXTENSION;

export function skylinePosition(index) {
  // Continue the same spacing leftwards; keep the original buildings in place.
  const originalIndex=index-LEFT_EXTENSION;
  const variantIndex=originalIndex<0 ? ORIGINAL_COUNT+index : originalIndex;
  const angle=-1.52+originalIndex/(ORIGINAL_COUNT-1)*3.55;
  const radius=angle>.75 ? 46+(variantIndex%3) : 38+(variantIndex%3)*2;
  return {angle,variantIndex,position:[Math.sin(angle)*radius,0,2-Math.cos(angle)*radius]};
}
