export const SKYLINE_COUNT = 46;

export function skylinePosition(index) {
  const angle=-1.52+index/(SKYLINE_COUNT-1)*3.55;
  const radius=angle>.75 ? 46+(index%3) : 38+(index%3)*2;
  return {angle,position:[Math.sin(angle)*radius,0,2-Math.cos(angle)*radius]};
}
