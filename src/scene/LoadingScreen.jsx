import React from "react";

export default function LoadingScreen({ failed = false }) {
  return (
    <div className="scene-loading" role="status" aria-live="polite">
      <span className="loading-title">elsewhere.</span>
      <span className="loading-line" aria-hidden="true" />
      <p>{failed ? "The memorial could not load. Please reload to try again." : "A place is coming into focus."}</p>
      {failed && <button onClick={() => window.location.reload()}>Reload memorial</button>}
    </div>
  );
}
