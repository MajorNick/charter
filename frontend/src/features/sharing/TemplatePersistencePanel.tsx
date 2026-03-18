import { PersistedTemplate } from "../template-contract";

interface TemplatePersistencePanelProps {
  name: string;
  description: string;
  persistedTemplate: PersistedTemplate | null;
  requestState: "idle" | "loading" | "saving" | "ready" | "error";
  statusMessage: string | null;
  errorMessage: string | null;
  shareUrl: string | null;
  hasConfiguration: boolean;
  hasUnsavedChanges: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCreate: () => void;
  onUpdate: () => void;
  onClone: () => void;
  onDetach: () => void;
}

export function TemplatePersistencePanel(props: TemplatePersistencePanelProps) {
  const {
    name,
    description,
    persistedTemplate,
    requestState,
    statusMessage,
    errorMessage,
    shareUrl,
    hasConfiguration,
    hasUnsavedChanges,
    onNameChange,
    onDescriptionChange,
    onCreate,
    onUpdate,
    onClone,
    onDetach,
  } = props;

  const isBusy = requestState === "loading" || requestState === "saving";

  return (
    <div className="template-persistence-grid">
      <div className="template-session-card">
        <div className="panel__header">
          <div className="section-heading">
            <p className="section-kicker">Template</p>
            <h2>Persist, reload, and share the current workflow.</h2>
          </div>
          <span className={`status-chip status-chip--${requestState === "error" ? "error" : requestState === "loading" ? "loading" : persistedTemplate ? "ready" : "neutral"}`}>
            {persistedTemplate ? "Persisted" : "Local draft"}
          </span>
        </div>

        <div className="form-grid form-grid--two">
          <label className="form-field">
            <span>Name</span>
            <input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Revenue by segment" />
          </label>
          <label className="form-field">
            <span>Description</span>
            <textarea value={description} onChange={(event) => onDescriptionChange(event.target.value)} placeholder="Short shareable description" rows={3} />
          </label>
        </div>

        <div className="template-meta-grid">
          <article className="meta-card">
            <span>Template id</span>
            <strong>{persistedTemplate?.id ?? "Not saved yet"}</strong>
            <p>{persistedTemplate ? `Updated ${persistedTemplate.updatedAt}` : "Save this draft to get a ULID-backed share link."}</p>
          </article>
          <article className="meta-card">
            <span>Share link</span>
            <strong>{shareUrl ?? "Unavailable"}</strong>
            <p>{shareUrl ? "Recipients can open this path and upload their own compatible file." : "A share link appears after the first successful save."}</p>
          </article>
        </div>

        <div className="template-actions">
          <button className="secondary-button" type="button" disabled={!hasConfiguration || isBusy} onClick={onCreate}>
            Save as new
          </button>
          <button className="secondary-button" type="button" disabled={!persistedTemplate || !hasConfiguration || isBusy} onClick={onUpdate}>
            Update
          </button>
          <button className="secondary-button" type="button" disabled={!persistedTemplate || hasUnsavedChanges || isBusy} onClick={onClone}>
            Clone saved
          </button>
          <button className="secondary-button secondary-button--inline" type="button" disabled={!persistedTemplate || isBusy} onClick={onDetach}>
            Work locally
          </button>
        </div>

        {hasUnsavedChanges && persistedTemplate && (
          <p className="validation-message">Update the saved template before cloning if you want the clone to include current edits.</p>
        )}
        {statusMessage && <p className="template-feedback">{statusMessage}</p>}
        {errorMessage && <p className="validation-message">{errorMessage}</p>}
      </div>
    </div>
  );
}
