import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AVATAR_TYPES, LIMITS } from "../../../shared/protocol.js";
const AvatarPreview = lazy(() => import("./AvatarPreview.jsx"));

export default function VisitorEntry({ identity, onSave, onCancel }) {
  const [username, setUsername] = useState(identity?.username ?? "");
  const [avatarType, setAvatarType] = useState(identity?.avatarType ?? "male");
  const [error, setError] = useState("");
  const form = useRef(null);
  const editing = Boolean(identity);

  useEffect(() => {
    const previous = document.activeElement;
    form.current?.querySelector("input")?.focus();
    return () => previous?.focus({ preventScroll: true });
  }, []);

  function handleKeys(event) {
    if (event.key === "Escape" && onCancel) {
      event.stopPropagation();
      onCancel();
    }
    if (event.key !== "Tab") return;
    const fields = [...form.current.querySelectorAll("input, button")];
    const first = fields[0], last = fields[fields.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="visitor-entry" onKeyDown={handleKeys}>
      <form
        ref={form}
        className="visitor-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="visitor-title"
        onSubmit={(event) => {
          event.preventDefault();
          if (!onSave({ username, avatarType }))
            setError("Choose a name of 1–24 characters.");
        }}
      >
        <p className="visitor-eyebrow">A shared place to pause</p>
        <h1 id="visitor-title">{editing ? "Your visitor profile" : "Elsewhere."}</h1>
        <label htmlFor="visitor-username">Your name</label>
        <input
          id="visitor-username"
          autoComplete="nickname"
          value={username}
          aria-describedby={error ? "visitor-error" : "visitor-name-hint"}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setUsername(event.target.value);
            setError("");
          }}
          required
        />
        <small id="visitor-name-hint">Up to {LIMITS.username} characters · no account needed</small>
        <fieldset>
          <legend>Choose your avatar</legend>
          <div className="avatar-options">
            {AVATAR_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className="avatar-option"
                aria-label={`${type === "male" ? "Male" : "Female"} avatar`}
                aria-pressed={avatarType === type}
                onClick={() => setAvatarType(type)}
              >
                <Suspense fallback={<span className="avatar-preview">Loading preview</span>}>
                  <AvatarPreview avatarType={type} />
                </Suspense>
                <span>{type === "male" ? "Male" : "Female"}</span>
              </button>
            ))}
          </div>
        </fieldset>
        {error && <p id="visitor-error" role="alert">{error}</p>}
        <div className="visitor-form-actions">
          {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
          <button type="submit">{editing ? "Save profile" : "Enter the experience"}</button>
        </div>
      </form>
    </div>
  );
}
