import { ChangeEvent, useId } from "react";
import { useDatasetUpload } from "./useDatasetUpload";
import { DatasetField, DatasetScalar, NormalizedDataset } from "./types";

const contractNotes = [
  {
    title: "Single row contract",
    description: "Both parsers land on Record<string, string | number | boolean | null> rows for downstream steps.",
  },
  {
    title: "Narrow JSON scope",
    description: "Phase 1 accepts flat arrays of objects only. Nested arrays and objects are rejected.",
  },
  {
    title: "Preview before transforms",
    description: "Schema, inferred field kinds, and sample rows are available without building pipeline logic yet.",
  },
  {
    title: "Persisted template boundary",
    description: "Template configuration now excludes runtime rows and is designed to be saved and loaded by ULID-backed API calls.",
  },
];

export function DataIngestionWorkbench() {
  const uploadInputId = useId();
  const { status, dataset, error, fileName, loadFile, reset } = useDatasetUpload();

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    void loadFile(nextFile);
    event.target.value = "";
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero__copy">
          <p className="eyebrow">T3 / Frontend Data Lane</p>
          <h1>Upload local CSV or JSON and normalize it into one previewable dataset.</h1>
          <p className="hero__summary">
            Charter now loads browser-local files, infers a stable schema, and exposes sample rows through a
            consistent dataset contract for the next workflow steps.
          </p>
        </div>
        <aside className="hero__panel hero__panel--stacked">
          <span className="hero__label">Current state</span>
          <strong>{getStatusHeading(status, fileName)}</strong>
          <p>{getStatusBody(status, fileName, dataset?.source.rowCount ?? 0)}</p>
          <div className="status-chip-list">
            <span className={`status-chip status-chip--${status}`}>{status}</span>
            <span className="status-chip status-chip--neutral">CSV + JSON</span>
            <span className="status-chip status-chip--neutral">No transforms yet</span>
          </div>
        </aside>
      </header>

      <main className="content-grid">
        <section className="panel panel--wide">
          <div className="panel__header">
            <div className="section-heading">
              <p className="section-kicker">Upload</p>
              <h2>Load a local source file.</h2>
            </div>
            {(dataset || error) && (
              <button className="secondary-button" type="button" onClick={reset}>
                Clear state
              </button>
            )}
          </div>

          <div className="upload-grid">
            <label className="upload-card" htmlFor={uploadInputId}>
              <input
                id={uploadInputId}
                className="sr-only"
                type="file"
                accept=".csv,.json,text/csv,application/json"
                onChange={handleInputChange}
              />
              <span className="upload-card__eyebrow">Local source</span>
              <strong>Choose a `.csv` or `.json` file</strong>
              <p>Files stay local to the browser. JSON support is intentionally limited to flat arrays of objects.</p>
              <span className="upload-card__button">Select file</span>
            </label>

            <div className="upload-status">
              <p className="upload-status__label">Parser output</p>
              {error ? (
                <p className="upload-status__message upload-status__message--error">{error}</p>
              ) : (
                <p className="upload-status__message">{getStatusMessage(status, fileName)}</p>
              )}

              <ul className="detail-list">
                <li>CSV headers are used as field names and deduplicated when needed.</li>
                <li>CSV values are inferred as string, number, boolean, or null.</li>
                <li>Missing JSON keys are normalized to null so every row shares the same shape.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <p className="section-kicker">Dataset Contract</p>
            <h2>Stable output for downstream tasks.</h2>
          </div>
          <div className="note-grid">
            {contractNotes.map((note) => (
              <article className="note-card" key={note.title}>
                <h3>{note.title}</h3>
                <p>{note.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <p className="section-kicker">Dataset Summary</p>
            <h2>Imported shape at a glance.</h2>
          </div>
          {dataset ? (
            <div className="summary-grid">
              <SummaryCard label="Source type" value={dataset.source.kind.toUpperCase()} />
              <SummaryCard label="Rows" value={dataset.source.rowCount.toString()} />
              <SummaryCard label="Fields" value={dataset.fields.length.toString()} />
              <SummaryCard label="Sample rows" value={dataset.sampleRows.length.toString()} />
            </div>
          ) : (
            <EmptyState
              title="No dataset loaded yet."
              description="Upload a file to generate a normalized dataset summary, inferred schema, and sample rows."
            />
          )}
        </section>

        <section className="panel panel--wide">
          <div className="section-heading">
            <p className="section-kicker">Schema Preview</p>
            <h2>Fields are inferred from the normalized row model.</h2>
          </div>
          {dataset ? (
            <SchemaPreview dataset={dataset} />
          ) : (
            <EmptyState
              title="Schema preview is empty."
              description="Load a file to inspect inferred field kinds and sample values."
            />
          )}
        </section>

        <section className="panel panel--wide">
          <div className="section-heading">
            <p className="section-kicker">Sample Rows</p>
            <h2>First rows from the consistent dataset contract.</h2>
          </div>
          {dataset ? (
            <SampleRowsPreview dataset={dataset} />
          ) : (
            <EmptyState
              title="No sample rows yet."
              description="Once a file is parsed, the first normalized rows appear here for quick validation."
            />
          )}
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function SchemaPreview({ dataset }: { dataset: NormalizedDataset }) {
  if (dataset.fields.length === 0) {
    return (
      <EmptyState
        title="The uploaded file contains no fields."
        description="An empty JSON array can still load, but there is no schema to infer yet."
      />
    );
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Inferred kind</th>
            <th scope="col">Nullable</th>
            <th scope="col">Values present</th>
            <th scope="col">Sample values</th>
          </tr>
        </thead>
        <tbody>
          {dataset.fields.map((field) => (
            <SchemaRow key={field.key} field={field} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchemaRow({ field }: { field: DatasetField }) {
  return (
    <tr>
      <td>
        <div className="field-cell">
          <strong>{field.label}</strong>
          <span>{field.sourceKey}</span>
        </div>
      </td>
      <td>
        <span className={`value-chip value-chip--${field.kind}`}>{field.kind}</span>
      </td>
      <td>{field.nullable ? "Yes" : "No"}</td>
      <td>{field.valuesPresent}</td>
      <td>
        <div className="value-chip-list">
          {field.sampleValues.length > 0 ? (
            field.sampleValues.map((value, index) => (
              <span className={`value-chip value-chip--${getValueTone(value)}`} key={`${field.key}-${index}`}>
                {formatScalar(value)}
              </span>
            ))
          ) : (
            <span className="value-chip value-chip--null">No values</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function SampleRowsPreview({ dataset }: { dataset: NormalizedDataset }) {
  if (dataset.fields.length === 0 || dataset.sampleRows.length === 0) {
    return (
      <EmptyState
        title="No row samples available."
        description="The file either has no data rows or no schema could be inferred from the current upload."
      />
    );
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {dataset.fields.map((field) => (
              <th key={field.key} scope="col">
                {field.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataset.sampleRows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {dataset.fields.map((field) => (
                <td key={`${rowIndex}-${field.key}`}>
                  <span className={`value-chip value-chip--${getValueTone(row[field.key])}`}>
                    {formatScalar(row[field.key])}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatScalar(value: DatasetScalar | undefined): string {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "string") {
    return value.length > 0 ? value : '""';
  }

  return String(value);
}

function getValueTone(value: DatasetScalar | undefined): "string" | "number" | "boolean" | "null" {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "number") {
    return "number";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  return "string";
}

function getStatusHeading(status: string, fileName: string | null): string {
  if (status === "loading") {
    return "Parsing upload";
  }

  if (status === "ready" && fileName) {
    return fileName;
  }

  if (status === "error") {
    return "Upload needs attention";
  }

  return "Waiting for local input";
}

function getStatusBody(status: string, fileName: string | null, rowCount: number): string {
  if (status === "loading" && fileName) {
    return `Normalizing ${fileName} into a consistent row contract.`;
  }

  if (status === "ready" && fileName) {
    return `${rowCount} normalized rows are ready for schema preview and downstream pipeline work.`;
  }

  if (status === "error") {
    return "Unsupported structures or malformed files surface explicit parser errors in the UI.";
  }

  return "Choose a browser-local file to inspect its schema before transformations are introduced.";
}

function getStatusMessage(status: string, fileName: string | null): string {
  if (status === "loading" && fileName) {
    return `Reading ${fileName}...`;
  }

  if (status === "ready" && fileName) {
    return `${fileName} was normalized successfully.`;
  }

  if (status === "error") {
    return "The file could not be normalized.";
  }

  return "No file selected. Upload a local CSV or flat JSON array to begin.";
}


