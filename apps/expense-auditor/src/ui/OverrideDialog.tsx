import { useEffect, useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";
import type { DecisionResult } from "@bones/core";
import type { OverrideForm, OverrideOutcome } from "../state/sessionStore";

export interface OverrideDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (form: OverrideForm) => OverrideOutcome;
  returnFocusTo: RefObject<HTMLButtonElement>;
}

const MAX_REASON = 500;

const RESULT_OPTIONS: readonly { value: DecisionResult; label: string }[] = [
  { value: "approved", label: "Approved" },
  { value: "partially_approved", label: "Partially approved" },
  { value: "rejected", label: "Rejected" },
];

type FieldName = "reviewerName" | "reason";

function isDecisionResult(v: string): v is DecisionResult {
  return RESULT_OPTIONS.some((o) => o.value === v);
}

export function OverrideDialog({ open, onClose, onSubmit, returnFocusTo }: OverrideDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const wasOpen = useRef(false);
  const [reviewerName, setReviewerName] = useState("");
  const [reason, setReason] = useState("");
  const [replacementResult, setReplacementResult] = useState<DecisionResult>("approved");
  const [error, setError] = useState<{ field: FieldName; message: string } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open) {
      setReviewerName("");
      setReason("");
      setReplacementResult("approved");
      setError(null);
      if (!dialog.open) dialog.showModal();
      nameRef.current?.focus();
      wasOpen.current = true;
    } else {
      if (dialog.open) dialog.close();
      if (wasOpen.current) {
        wasOpen.current = false;
        returnFocusTo.current?.focus();
      }
    }
  }, [open, returnFocusTo]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const outcome = onSubmit({ reviewerName, reason, replacementResult });
    if (outcome.ok) {
      onClose();
      return;
    }
    setError({ field: outcome.field, message: outcome.message });
    (outcome.field === "reviewerName" ? nameRef : reasonRef).current?.focus();
  }

  const errorFor = (field: FieldName): string | null =>
    error !== null && error.field === field ? error.message : null;
  const nameError = errorFor("reviewerName");
  const reasonError = errorFor("reason");

  return (
    <dialog
      ref={dialogRef}
      className="xr-dialog"
      aria-labelledby="override-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2 id="override-title">Overrule decision</h2>
      <form onSubmit={handleSubmit} noValidate>
        <div className="app-field">
          <label className="xr-field-label" htmlFor="override-reviewer">Reviewer name</label>
          <input
            id="override-reviewer"
            ref={nameRef}
            className="xr-input"
            type="text"
            autoComplete="off"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            aria-invalid={nameError !== null ? "true" : undefined}
            aria-describedby={nameError !== null ? "override-error-reviewerName" : undefined}
          />
          {nameError !== null ? (
            <p role="alert" id="override-error-reviewerName" className="xr-field-error">
              {nameError}
            </p>
          ) : null}
        </div>
        <div className="app-field">
          <label className="xr-field-label" htmlFor="override-reason">Reason</label>
          <textarea
            id="override-reason"
            ref={reasonRef}
            className="xr-input"
            rows={4}
            maxLength={MAX_REASON}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={reasonError !== null ? "true" : undefined}
            aria-describedby={reasonError !== null ? "override-error-reason" : undefined}
          />
          <p className="xr-counter">{`${reason.length} / ${MAX_REASON}`}</p>
          {reasonError !== null ? (
            <p role="alert" id="override-error-reason" className="xr-field-error">
              {reasonError}
            </p>
          ) : null}
        </div>
        <div className="app-field">
          <label className="xr-field-label" htmlFor="override-result">New result</label>
          <select
            id="override-result"
            className="xr-input"
            value={replacementResult}
            onChange={(e) => {
              if (isDecisionResult(e.target.value)) setReplacementResult(e.target.value);
            }}
          >
            {RESULT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="app-actions">
          <button type="button" className="xr-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="xr-btn xr-btn--primary">
            Save override
          </button>
        </div>
      </form>
    </dialog>
  );
}
