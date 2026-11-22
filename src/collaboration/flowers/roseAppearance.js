import { Quaternion, Vector3 } from "three";

export const ROSE_PALETTE = Object.freeze({
  white: { label: "White", color: "#fff7e9" },
  palePink: { label: "Pale pink", color: "#efbccb" },
  red: { label: "Red", color: "#b72f48" },
  peach: { label: "Peach", color: "#efb397" },
  lavender: { label: "Lavender", color: "#bca6d7" },
});
export const roseAppearance = (color) => ROSE_PALETTE[color] ?? ROSE_PALETTE.white;

export function roseRestingTransform(anchor, flower) {
  // Stable ID hash: every client/reconnect sees the same restrained variation.
  let hash = 2166136261;
  for (const character of `${flower.id}:${anchor.id}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  const yaw = ((hash & 1023) / 1023 - 0.5) * 0.09;
  const x = (((hash >>> 10) & 1023) / 1023 - 0.5) * 0.024;
  const z = (((hash >>> 20) & 1023) / 1023 - 0.5) * 0.004;
  const orientation = new Quaternion().fromArray(anchor.quaternion);
  const position = new Vector3(x, 0, z).applyQuaternion(orientation).add(new Vector3(...anchor.position));
  orientation.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw));
  // Keep Y aligned with the measured stone normal; tilting would bury the stem.
  return { ...anchor, position: position.toArray(), quaternion: orientation.toArray() };
}
