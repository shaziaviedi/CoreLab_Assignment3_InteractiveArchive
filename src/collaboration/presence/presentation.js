export const ZONE_LABELS = { overview: "Memorial Plaza", tree: "Survivor Tree", north: "North Pool", street: "Greenwich Street" };
export const ACTIVITY_LABELS = {
  idle: "", "writing-note": "Writing a message", "placing-note": "Attaching a tag",
  "reading-note": "Reading a message", "placing-flower": "Leaving a flower", photographing: "Taking a Photograph",
};
export function visitorActivity(visitor, now = Date.now()) {
  return ACTIVITY_LABELS[visitor.activity] && Date.parse(visitor.activityExpiresAt) > now ? visitor.activity : "idle";
}
