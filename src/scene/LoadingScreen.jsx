import React from "react";

export default function LoadingScreen({ failed = false }) {
  return (
    <div className="scene-loading" role="status" aria-live="polite">
      <span className="loading-line" aria-hidden="true" />
      {failed ? <p>The memorial could not load. Please reload to try again.</p> : <span className="loading-accessible">Loading memorial</span>}
      {failed && <button onClick={() => window.location.reload()}>Reload memorial</button>}
    </div>
  );
}
