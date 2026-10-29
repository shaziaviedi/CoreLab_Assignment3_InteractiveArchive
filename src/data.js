import observationDays from "./observations.json";

const fields = ["crossings", "stops", "photographing", "reading", "observing", "talking", "other"];
const zones = {north: "North Pool", tree: "Survivor Tree", street: "Greenwich Street"};

function observationsFor(period) {
  const visits = observationDays.filter(day => day.period === period);
  return Object.fromEntries(Object.entries(zones).map(([id, zone]) => {
    const rows = visits.map(day => day.observations[id]);
    // round the equal five-minute visits to whole people
    const counts = Object.fromEntries(fields.map(field => [field,
      Math.round(rows.reduce((sum, row) => sum + row[field], 0) / rows.length),
    ]));
    return [id, {
      zone, ...counts, durationMinutes: 5, sampleCount: visits.length,
      summary: period === "afternoon" ? "Daytime observation" : "Evening observation",
      at: rows.map(row => row.start + "–" + row.end).join(" / "),
      dates: rows.map(row => row.date),
    }];
  }));
}

export const OBS = {
  afternoon: observationsFor("afternoon"),
  evening: observationsFor("evening"),
};

export const FRAGMENTS = [
  { id: "sun", label: "Sun", target: "sky" },
  { id: "moon", label: "Moon", target: "sky" },
  { id: "tree", label: "Tree", target: "tree" },
  { id: "water", label: "Pool", target: "north" },
  { id: "street", label: "Street", target: "street" },
];
export const ZONENAMES = {
  north: "North Pool",
  tree: "Survivor Tree",
  street: "Greenwich Street",
};
