import { OBS, ZONENAMES, LABELS } from "./data.js";

export const Icon = ({ name }) => {
  if (name === "camera")
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8 6 10 3h4l2 3h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
        <circle cx="12" cy="12.5" r="3.5" />
      </svg>
    );
  if (name === "puzzle") {
    return (
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth=".8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 7H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4h-2a2 2 0 0 1 0-4h2V9a2 2 0 0 0-2-2h-3V5a3 3 0 0 0-6 0Z" />
      </svg>
    );
  }
  const paths = {
    pause: "M7 5h4v14H7zM15 5h4v14h-4z",
    play: "m7 4 13 8-13 8z",
    camera: "M4 7h3l2-3h6l2 3h3v12H4z M12 10a4 4 0 1 0 0 8a4 4 0 1 0 0-8",
    reset: "M3 12a9 9 0 1 0 3-7L3 8m0-5v5h5",
    puzzle:
      "M9 3H4v6h2a2 2 0 1 1 0 4H4v7h6v-2a2 2 0 1 1 4 0v2h6v-7h-2a2 2 0 1 1 0-4h2V3h-6v2a2 2 0 1 1-4 0V3z",
    info: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 10v7M12 7v1",
  };

  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <path d={paths[name]} />
    </svg>
  );
};

export function Slot({ id, placed, onPlace, selected, anchorRef }) {
  return (
    <button
      ref={anchorRef}
      className={"slot " + id + (placed ? " filled" : "")}
      title={"Place fragment: " + LABELS[id]}
      aria-label={"Place fragment: " + LABELS[id]}
      onClick={() => onPlace(selected, id)}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={(e) => e.currentTarget.classList.add("dragover")}
      onDragLeave={(e) => e.currentTarget.classList.remove("dragover")}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove("dragover");
        onPlace(e.dataTransfer.getData("text/plain"), id, true);
      }}
    ></button>
  );
}

export function ZoneStats({ id, period, anchorRef, hasObservation }) {
  if (!hasObservation)
    return (
      <div ref={anchorRef} className={"data-popup " + id}>
        <label>{ZONENAMES[id]}</label>
        <small className="data-summary">
          Place the sun or moon to reveal observations.
        </small>
      </div>
    );
  let d = OBS[period][id];
  return (
    <div ref={anchorRef} className={"data-popup " + id} key={period + "-" + id}>
      <label>{ZONENAMES[id]} · 5 min</label>
      <small className="data-summary">{d.summary}</small>
      <div className="data-numbers">
        <div>
          <strong>{d.crossings}</strong>
          <br />
          <span>crossings</span>
        </div>
        <div>
          <strong>{d.stops}</strong>
          <br />
          <span>new stops</span>
        </div>
      </div>
      <div className="camera-num">
        ✧ <b>{d.photographing}</b> photographing
      </div>
    </div>
  );
}

export function Archive({ photos, onClose }) {
  return (
    <div className="archive-panel">
      <div className="archive-title">Captured moments</div>
      <div className="archive-photos">What can a photograph remember?</div>
      {photos.length ? (
        <div className="archive-grid">
          {photos.map((a, i) => (
            <article
              className="archive-item"
              key={a.id}
              style={{
                "--rotation": ((i % 2) * 2 - 1) * (2 + (i % 3)) + "deg",
              }}
            >
              <img src={a.url} alt={"Visitor view of " + ZONENAMES[a.zone]} />
              <h3>{ZONENAMES[a.zone]}</h3>
              <p>
                {a.period && a.pedestrians > 0
                  ? `${a.period === "afternoon" ? "Daytime" : "Evening"} · ${a.pedestrians} pedestrians`
                  : "No observation"}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="archive-empty">No moments captured yet.</p>
      )}
      <button className="close-archive" onClick={onClose}>
        Return to the memorial
      </button>
    </div>
  );
}
