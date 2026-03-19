import { ChangeEvent, useEffect, useId, useMemo, useState } from "react";
import { ChartMappingEditor, ChartPreviewCard, buildChartPreview, sanitizeChartMapping } from "../charts";
import { BackendHealthResponse, BackendMetaResponse, createBackendApiClient } from "../backend";
import { useDatasetUpload } from "../dataset";
import { DatasetField, DatasetScalar, NormalizedDataset } from "../dataset/types";
import { createTemplateApiClient, createTemplateConfigurationFromDataset, serializeTemplateConfiguration, TemplateApiError } from "../template-contract";
import {
  AggregateDefinition,
  ChartMapping,
  FilterOperator,
  FilterRule,
  PersistedTemplate,
  TemplateConfiguration,
  TransformStep,
} from "../template-contract/types";
import { TemplatePersistencePanel, buildTemplatePath, getTemplateIdFromPath, getTemplateShareUrl } from "../sharing";
import { executeTransformPipeline, projectTransformedFields } from "../transforms";

const contractNotes = [
  {
    title: "No-code step builder",
    description: "Users can add, edit, remove, and reorder transform steps through forms backed by the real T5 contract.",
  },
  {
    title: "Live engine preview",
    description: "Every edit runs through the transform engine so downstream workflow and visualization tasks share one execution path.",
  },
  {
    title: "Explicit chart mapping",
    description: "Bar, line, and pie configuration all bind to the transformed output contract instead of relying on inferred chart heuristics.",
  },
  {
    title: "Persisted template boundary",
    description: "Builder state stays in the persisted template schema and still excludes runtime dataset rows from saved payloads.",
  },
];

const filterOperators: Array<{ value: FilterOperator; label: string }> = [
  { value: "equals", label: "Equals" },
  { value: "notEquals", label: "Does not equal" },
  { value: "greaterThan", label: "Greater than" },
  { value: "greaterThanOrEqual", label: "Greater than or equal" },
  { value: "lessThan", label: "Less than" },
  { value: "lessThanOrEqual", label: "Less than or equal" },
  { value: "contains", label: "Contains" },
  { value: "notContains", label: "Does not contain" },
  { value: "isNull", label: "Is null" },
  { value: "isNotNull", label: "Is not null" },
  { value: "in", label: "In list" },
];

const aggregateOperations: AggregateDefinition["operation"][] = ["count", "sum", "average", "min", "max"];
const stepTypes: TransformStep["type"][] = ["filter", "group", "sort", "calculate", "select", "rename"];

export function TransformBuilderWorkbench() {
  const uploadInputId = useId();
  const { status, dataset, error, fileName, loadFile, reset } = useDatasetUpload();
  const [configuration, setConfiguration] = useState<TemplateConfiguration | null>(null);
  const [nextStepType, setNextStepType] = useState<TransformStep["type"]>("filter");
  const [persistedTemplate, setPersistedTemplate] = useState<PersistedTemplate | null>(null);
  const [templateName, setTemplateName] = useState("Template draft");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateRequestState, setTemplateRequestState] = useState<"idle" | "loading" | "saving" | "ready" | "error">("idle");
  const [templateStatusMessage, setTemplateStatusMessage] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [routeTemplateId, setRouteTemplateId] = useState<string | null>(() => typeof window === "undefined" ? null : getTemplateIdFromPath(window.location.pathname));
  const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL ?? import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
  const apiClient = useMemo(() => createTemplateApiClient({ baseUrl: backendBaseUrl }), [backendBaseUrl]);
  const backendApiClient = useMemo(() => createBackendApiClient({ baseUrl: backendBaseUrl }), [backendBaseUrl]);
  const [backendRequestState, setBackendRequestState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [backendHealth, setBackendHealth] = useState<BackendHealthResponse | null>(null);
  const [backendMeta, setBackendMeta] = useState<BackendMetaResponse | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePopState = () => {
      setRouteTemplateId(getTemplateIdFromPath(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!fileName || templateName.trim()) {
      return;
    }

    setTemplateName(`${fileName.replace(/\.[^.]+$/, "")} template`);
  }, [fileName, templateName]);

  useEffect(() => {
    if (!dataset) {
      if (!persistedTemplate && !routeTemplateId) {
        setConfiguration(null);
      }
      return;
    }

    setConfiguration((current) => {
      if (current && (persistedTemplate || routeTemplateId)) {
        return current;
      }

      return createTemplateConfigurationFromDataset(dataset);
    });
  }, [dataset, persistedTemplate, routeTemplateId]);

  useEffect(() => {
    let isActive = true;

    setBackendRequestState("loading");
    setBackendError(null);

    void Promise.allSettled([backendApiClient.health(), backendApiClient.meta()]).then((results) => {
      if (!isActive) {
        return;
      }

      const [healthResult, metaResult] = results;

      if (healthResult.status === "fulfilled") {
        setBackendHealth(healthResult.value);
      }

      if (metaResult.status === "fulfilled") {
        setBackendMeta(metaResult.value);
      }

      if (healthResult.status === "rejected" && metaResult.status === "rejected") {
        const nextError = healthResult.reason instanceof Error ? healthResult.reason.message : metaResult.reason instanceof Error ? metaResult.reason.message : "Backend connection failed.";
        setBackendRequestState("error");
        setBackendError(nextError);
        return;
      }

      setBackendRequestState("ready");
    });

    return () => {
      isActive = false;
    };
  }, [backendApiClient]);

  useEffect(() => {
    let isActive = true;

    if (!routeTemplateId || persistedTemplate?.id === routeTemplateId) {
      return () => {
        isActive = false;
      };
    }

    setTemplateRequestState("loading");
    setTemplateError(null);
    setTemplateStatusMessage("Loading template from share link...");

    void apiClient
      .load(routeTemplateId)
      .then((template) => {
        if (!isActive) {
          return;
        }

        applyLoadedTemplate(template, "Template loaded. Upload a compatible file to render it.");
      })
      .catch((loadError) => {
        if (!isActive) {
          return;
        }

        setTemplateRequestState("error");
        setTemplateStatusMessage(null);
        setTemplateError(getTemplateErrorMessage(loadError));
      });

    return () => {
      isActive = false;
    };
  }, [apiClient, persistedTemplate?.id, routeTemplateId]);

  function applyLoadedTemplate(template: PersistedTemplate, message: string) {
    setPersistedTemplate(template);
    setConfiguration(template.config);
    setTemplateName(template.name);
    setTemplateDescription(template.description ?? "");
    setTemplateRequestState("ready");
    setTemplateError(null);
    setTemplateStatusMessage(message);
  }

  const stepPreviewStates = useMemo(() => {
    if (!dataset || !configuration) {
      return [] as Array<{ dataset: NormalizedDataset | null; error: string | null }>;
    }

    return configuration.transforms.map((_, index) => {
      try {
        const result = executeTransformPipeline(dataset, {
          source: configuration.source,
          transforms: configuration.transforms.slice(0, index + 1),
        });

        return { dataset: result.dataset, error: null };
      } catch (previewError) {
        return {
          dataset: null,
          error: previewError instanceof Error ? previewError.message : "Preview could not be generated.",
        };
      }
    });
  }, [configuration, dataset]);

  const previewState = useMemo(() => {
    if (stepPreviewStates.length > 0) {
      return stepPreviewStates[stepPreviewStates.length - 1] ?? { dataset: null, error: null };
    }

    if (!dataset || !configuration) {
      return { dataset: null, error: null };
    }

    return { dataset, error: null };
  }, [configuration, dataset, stepPreviewStates]);

  const chartFields = useMemo(() => {
    if (previewState.dataset) {
      return previewState.dataset.fields;
    }

    if (!dataset || !configuration) {
      return dataset?.fields ?? [];
    }

    return projectTransformedFields(dataset.fields, configuration.transforms);
  }, [configuration, dataset, previewState.dataset]);

  const chartDataset = previewState.dataset ?? (dataset ? { ...dataset, fields: chartFields } : null);

  useEffect(() => {
    setConfiguration((current) => {
      if (!current) {
        return current;
      }

      const sanitizedChart = sanitizeChartMapping(current.chart, chartFields);

      if (serializeChartMapping(current.chart) === serializeChartMapping(sanitizedChart)) {
        return current;
      }

      return {
        ...current,
        chart: sanitizedChart,
      };
    });
  }, [chartFields]);

  const chartPreview = useMemo(() => {
    if (!chartDataset || !configuration) {
      return null;
    }

    return buildChartPreview(chartDataset, configuration.chart);
  }, [chartDataset, configuration]);

  const hasUnsavedTemplateChanges = useMemo(() => {
    if (!persistedTemplate || !configuration) {
      return false;
    }

    return (
      persistedTemplate.name !== templateName.trim() ||
      (persistedTemplate.description ?? "") !== normalizeTemplateDescription(templateDescription) ||
      serializeTemplateConfiguration(persistedTemplate.config) !== serializeTemplateConfiguration(configuration)
    );
  }, [configuration, persistedTemplate, templateDescription, templateName]);

  const shareUrl = persistedTemplate ? getTemplateShareUrl(persistedTemplate.id) : null;

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    void loadFile(nextFile);
    event.target.value = "";
  }

  function handleReset() {
    reset();

    if (!persistedTemplate && !routeTemplateId) {
      setConfiguration(null);
    }
  }

  function syncRoute(templateId: string | null) {
    if (typeof window === "undefined") {
      return;
    }

    const nextPath = templateId ? buildTemplatePath(templateId) : "/";
    window.history.pushState({}, "", nextPath);
    setRouteTemplateId(templateId);
  }

  function buildTemplateDraft() {
    if (!configuration) {
      setTemplateError("Load data or a template before saving.");
      return null;
    }

    const nextName = templateName.trim();

    if (!nextName) {
      setTemplateError("Template name is required.");
      return null;
    }

    return {
      name: nextName,
      description: normalizeTemplateDescription(templateDescription),
      config: configuration,
    };
  }

  async function handleCreateTemplate() {
    const draft = buildTemplateDraft();

    if (!draft) {
      return;
    }

    setTemplateRequestState("saving");
    setTemplateError(null);
    setTemplateStatusMessage("Saving template...");

    try {
      const template = await apiClient.create(draft);
      applyLoadedTemplate(template, "Template saved. Share the generated link with another user.");
      syncRoute(template.id);
    } catch (saveError) {
      setTemplateRequestState("error");
      setTemplateStatusMessage(null);
      setTemplateError(getTemplateErrorMessage(saveError));
    }
  }

  async function handleUpdateTemplate() {
    const draft = buildTemplateDraft();

    if (!draft || !persistedTemplate) {
      return;
    }

    setTemplateRequestState("saving");
    setTemplateError(null);
    setTemplateStatusMessage("Updating template...");

    try {
      const template = await apiClient.update(persistedTemplate.id, draft);
      applyLoadedTemplate(template, "Template updated. The share link keeps the same ULID.");
      syncRoute(template.id);
    } catch (updateError) {
      setTemplateRequestState("error");
      setTemplateStatusMessage(null);
      setTemplateError(getTemplateErrorMessage(updateError));
    }
  }

  function handleDetachTemplate() {
    setPersistedTemplate(null);
    setTemplateRequestState("idle");
    setTemplateError(null);
    setTemplateStatusMessage("Working locally. Saving again will create a new template.");
    syncRoute(null);
  }

  function updateTransformStep(stepId: string, nextStep: TransformStep) {
    setConfiguration((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        transforms: current.transforms.map((step) => (step.id === stepId ? nextStep : step)),
      };
    });
  }

  function updateChartMapping(nextChart: ChartMapping) {
    setConfiguration((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        chart: nextChart,
      };
    });
  }

  function addTransformStep(type: TransformStep["type"]) {
    setConfiguration((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        transforms: [...current.transforms, createStep(type, current)],
      };
    });
  }

  function removeTransformStep(stepId: string) {
    setConfiguration((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        transforms: current.transforms.filter((step) => step.id !== stepId),
      };
    });
  }

  function moveTransformStep(stepId: string, direction: -1 | 1) {
    setConfiguration((current) => {
      if (!current) {
        return current;
      }

      const index = current.transforms.findIndex((step) => step.id === stepId);

      if (index === -1) {
        return current;
      }

      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= current.transforms.length) {
        return current;
      }

      const nextTransforms = [...current.transforms];
      const [step] = nextTransforms.splice(index, 1);
      nextTransforms.splice(nextIndex, 0, step);

      return {
        ...current,
        transforms: nextTransforms,
      };
    });
  }

  const stepAvailableFields = useMemo(() => {
    if (!dataset || !configuration) {
      return [] as DatasetField[][];
    }

    return configuration.transforms.map((_, index) =>
      projectTransformedFields(dataset.fields, configuration.transforms.slice(0, index)),
    );
  }, [configuration, dataset]);

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero__copy">
          <p className="eyebrow">T6 + T7 / Frontend Workflow Lane</p>
          <h1>Build the Phase 1 pipeline and map it onto a live chart.</h1>
          <p className="hero__summary">
            Build a chart-ready dataset in one place: upload data, shape it step by step, inspect intermediate results,
            and bind the final output to a live preview without losing the underlying template contract.
          </p>
          <div className="hero__stat-row">
            <article className="hero-stat">
              <span>Source rows</span>
              <strong>{dataset?.source.rowCount ?? 0}</strong>
            </article>
            <article className="hero-stat">
              <span>Transform steps</span>
              <strong>{configuration?.transforms.length ?? 0}</strong>
            </article>
            <article className="hero-stat">
              <span>Output fields</span>
              <strong>{previewState.dataset?.fields.length ?? dataset?.fields.length ?? 0}</strong>
            </article>
          </div>
        </div>
        <aside className="hero__panel hero__panel--stacked">
          <span className="hero__label">Current state</span>
          <strong>{getStatusHeading(status, fileName)}</strong>
          <p>{getStatusBody(status, fileName, dataset?.source.rowCount ?? 0, configuration?.transforms.length ?? 0)}</p>
          <div className="status-chip-list">
            <span className={`status-chip status-chip--${status}`}>{status}</span>
            <span className={`status-chip status-chip--${backendRequestState === "error" ? "error" : backendRequestState === "loading" ? "loading" : backendRequestState === "ready" ? "ready" : "neutral"}`}>
              {backendRequestState === "ready" ? "Backend connected" : backendRequestState === "loading" ? "Checking backend" : backendRequestState === "error" ? "Backend offline" : "Backend idle"}
            </span>
            <span className="status-chip status-chip--neutral">Transform builder</span>
            <span className="status-chip status-chip--neutral">Chart mapping</span>
          </div>
          <p className="hero__backend-note">{getBackendStatusMessage(backendRequestState, backendHealth, backendMeta, backendError, backendBaseUrl)}</p>
        </aside>
      </header>

      <main className="content-grid">
        <section className="panel panel--wide">
          <TemplatePersistencePanel
            name={templateName}
            description={templateDescription}
            persistedTemplate={persistedTemplate}
            requestState={templateRequestState}
            statusMessage={templateStatusMessage}
            errorMessage={templateError}
            shareUrl={shareUrl}
            hasConfiguration={configuration !== null}
            hasUnsavedChanges={hasUnsavedTemplateChanges}
            onNameChange={setTemplateName}
            onDescriptionChange={setTemplateDescription}
            onCreate={() => void handleCreateTemplate()}
            onUpdate={() => void handleUpdateTemplate()}
            onDetach={handleDetachTemplate}
          />
        </section>
        <section className="panel panel--wide">
          <div className="panel__header">
            <div className="section-heading">
              <p className="section-kicker">Upload</p>
              <h2>Load a local source file.</h2>
            </div>
            {(dataset || error) && (
              <button className="secondary-button" type="button" onClick={handleReset}>
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
              <strong>Choose a .csv or .json file</strong>
              <p>
                Files stay local to the browser. Once loaded, the builder configures a persisted template shape rather
                than storing raw rows in backend payloads.
              </p>
              <span className="upload-card__button">Select file</span>
            </label>

            <div className="upload-status">
              <p className="upload-status__label">Pipeline output</p>
              {error ? (
                <p className="upload-status__message upload-status__message--error">{error}</p>
              ) : previewState.error ? (
                <p className="upload-status__message upload-status__message--error">{previewState.error}</p>
              ) : (
                <p className="upload-status__message">{getStatusMessage(status, fileName, configuration?.transforms.length ?? 0)}</p>
              )}

              <ul className="detail-list">
                <li>Every step uses the persisted TransformStep contract from T4.</li>
                <li>Preview runs through the shared T5 execution engine after each edit.</li>
                <li>Chart mapping binds against transformed output fields, not the raw upload schema.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <p className="section-kicker">Workflow Contract</p>
            <h2>Builder rules for downstream tasks.</h2>
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
            <p className="section-kicker">Pipeline Summary</p>
            <h2>Current authoring state.</h2>
          </div>
          {dataset && configuration ? (
            <div className="summary-grid">
              <SummaryCard label="Source rows" value={dataset.source.rowCount.toString()} />
              <SummaryCard label="Step count" value={configuration.transforms.length.toString()} />
              <SummaryCard label="Preview rows" value={(previewState.dataset?.rows.length ?? 0).toString()} />
              <SummaryCard label="Chart type" value={configuration.chart.chartType} />
            </div>
          ) : (
            <EmptyState title="Builder is waiting for data." description="Upload a file to start composing transform steps and see the preview state." />
          )}
        </section>

        <section className="panel panel--wide">
          <div className="panel__header panel__header--builder">
            <div className="section-heading">
              <p className="section-kicker">Transform Builder</p>
              <h2>Compose the Phase 1 pipeline.</h2>
            </div>
            {configuration && (
              <div className="builder-toolbar">
                <label className="form-field builder-toolbar__field">
                  <span>Next step type</span>
                  <select
                    className="field-select"
                    value={nextStepType}
                    onChange={(event) => setNextStepType(event.target.value as TransformStep["type"])}
                  >
                    {stepTypes.map((stepType) => (
                      <option key={stepType} value={stepType}>
                        {formatStepType(stepType)}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="secondary-button builder-toolbar__action" type="button" onClick={() => addTransformStep(nextStepType)}>
                  Add selected step
                </button>
                <p className="builder-toolbar__hint">This selector only affects the next step you add. Existing steps keep their current type.</p>
              </div>
            )}
          </div>
          {dataset && configuration ? (
            configuration.transforms.length > 0 ? (
              <div className="step-list">
                {configuration.transforms.map((step, index) => (
                  <TransformStepEditor
                    key={step.id}
                    availableFields={stepAvailableFields[index] ?? dataset.fields}
                    index={index}
                    isFirst={index === 0}
                    isLast={index === configuration.transforms.length - 1}
                    previewState={stepPreviewStates[index] ?? { dataset: null, error: null }}
                    step={step}
                    onChange={(nextStep) => updateTransformStep(step.id, nextStep)}
                    onMoveUp={() => moveTransformStep(step.id, -1)}
                    onMoveDown={() => moveTransformStep(step.id, 1)}
                    onRemove={() => removeTransformStep(step.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No transform steps yet."
                description="Choose the next step type and add it to start building the workflow. Filter, group, sort, calculate, select, and rename are available in Phase 1."
              />
            )
          ) : (
            <EmptyState title="Transform builder is unavailable." description="Upload data first so the step editors can bind against real field names." />
          )}
        </section>

        <section className="panel panel--wide">
          <div className="section-heading">
            <p className="section-kicker">Final Row Examples</p>
            <h2>One or two rows after all transformation steps.</h2>
          </div>
          {previewState.dataset ? (
            <CompactRowExamples dataset={previewState.dataset} />
          ) : dataset ? (
            <CompactRowExamples dataset={dataset} />
          ) : (
            <EmptyState title="No row examples yet." description="Upload a file to see compact output examples after the full transform pipeline." />
          )}
        </section>

        <section className="panel panel--wide">
          <div className="section-heading">
            <p className="section-kicker">Chart Mapping</p>
            <h2>Bind the transformed dataset to a supported chart.</h2>
          </div>
          {chartDataset && configuration ? (
            <ChartMappingEditor dataset={chartDataset} chart={configuration.chart} onChange={updateChartMapping} />
          ) : (
            <EmptyState title="Chart mapping is unavailable." description="Upload data first so the chart controls can bind against the current output schema." />
          )}
        </section>

        <section className="panel panel--wide">
          <div className="section-heading">
            <p className="section-kicker">Chart Preview</p>
            <h2>Render the current transformed output.</h2>
          </div>
          <ChartPreviewCard preview={chartPreview} />
        </section>

        <section className="panel panel--wide">
          <div className="section-heading">
            <p className="section-kicker">Preview Schema</p>
            <h2>Current output fields after the pipeline.</h2>
          </div>
          {previewState.dataset ? (
            <SchemaPreview dataset={previewState.dataset} />
          ) : dataset ? (
            <SchemaPreview dataset={dataset} />
          ) : (
            <EmptyState title="No preview schema yet." description="Upload a file and configure steps to inspect the derived output schema." />
          )}
        </section>

        <section className="panel panel--wide">
          <div className="section-heading">
            <p className="section-kicker">Preview Rows</p>
            <h2>Sample output from the current transform sequence.</h2>
          </div>
          {previewState.dataset ? (
            <SampleRowsPreview dataset={previewState.dataset} />
          ) : dataset ? (
            <SampleRowsPreview dataset={dataset} />
          ) : (
            <EmptyState title="No preview rows yet." description="Once data is loaded, the current pipeline output appears here." />
          )}
        </section>
      </main>
    </div>
  );
}

function TransformStepEditor(props: {
  step: TransformStep;
  index: number;
  availableFields: DatasetField[];
  previewState: { dataset: NormalizedDataset | null; error: string | null };
  isFirst: boolean;
  isLast: boolean;
  onChange: (step: TransformStep) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const { step, index, availableFields, previewState, isFirst, isLast, onChange, onMoveDown, onMoveUp, onRemove } = props;
  const validationMessage = getStepValidationMessage(step);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  return (
    <article className="step-card">
      <div className="step-card__header">
        <div className="step-card__title-block">
          <p className="step-card__kicker">Step {index + 1}</p>
          <h3>{step.label.trim() || formatStepType(step.type)}</h3>
          <p className="step-card__summary">{formatStepType(step.type)} step ? {availableFields.length} available input fields</p>
        </div>
        <div className="step-card__actions">
          <button className="icon-button" type="button" disabled={isFirst} onClick={onMoveUp}>Up</button>
          <button className="icon-button" type="button" disabled={isLast} onClick={onMoveDown}>Down</button>
          <button className="icon-button icon-button--danger" type="button" onClick={onRemove}>Remove</button>
        </div>
      </div>

      <div className="form-grid form-grid--two">
        <label className="form-field">
          <span>Step label</span>
          <input value={step.label} onChange={(event) => onChange({ ...step, label: event.target.value })} />
        </label>
      </div>

      {step.type === "filter" && <FilterStepEditor step={step} availableFields={availableFields} onChange={onChange} />}
      {step.type === "group" && <GroupStepEditor step={step} availableFields={availableFields} onChange={onChange} />}
      {step.type === "sort" && <SortStepEditor step={step} availableFields={availableFields} onChange={onChange} />}
      {step.type === "calculate" && <CalculateStepEditor step={step} availableFields={availableFields} onChange={onChange} />}
      {step.type === "select" && <SelectStepEditor step={step} availableFields={availableFields} onChange={onChange} />}
      {step.type === "rename" && <RenameStepEditor step={step} availableFields={availableFields} onChange={onChange} />}

      <div className="step-preview-toggle-row">
        <button className="inline-link" type="button" onClick={() => setIsPreviewVisible((current) => !current)}>
          {isPreviewVisible ? "Hide step result" : "Preview this step"}
        </button>
      </div>

      {isPreviewVisible && <StepResultPreview previewState={previewState} stepLabel={step.label} stepIndex={index} />}
      {validationMessage && <p className="validation-message">{validationMessage}</p>}
    </article>
  );
}

function FilterStepEditor(props: { step: Extract<TransformStep, { type: "filter" }>; availableFields: DatasetField[]; onChange: (step: TransformStep) => void }) {
  const { step, availableFields, onChange } = props;

  return (
    <div className="step-editor-grid">
      <div className="form-grid form-grid--two">
        <label className="form-field">
          <span>Combinator</span>
          <select value={step.combinator} onChange={(event) => onChange({ ...step, combinator: event.target.value as "and" | "or" })}>
            <option value="and">All rules must match</option>
            <option value="or">Any rule can match</option>
          </select>
        </label>
      </div>
      <div className="substep-list">
        {step.rules.map((rule, index) => (
          <div className="substep-card" key={`${step.id}-rule-${index}`}>
            <div className="form-grid form-grid--three">
              <label className="form-field">
                <span>Field</span>
                <select value={rule.field} onChange={(event) => onChange({ ...step, rules: updateAt(step.rules, index, { ...rule, field: event.target.value }) })}>
                  {availableFields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>Operator</span>
                <select value={rule.operator} onChange={(event) => onChange({ ...step, rules: updateAt(step.rules, index, { ...rule, operator: event.target.value as FilterOperator, value: resetFilterValue(event.target.value as FilterOperator, rule.value) }) })}>
                  {filterOperators.map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>Value</span>
                <input disabled={rule.operator === "isNull" || rule.operator === "isNotNull"} value={formatFilterValue(rule)} onChange={(event) => onChange({ ...step, rules: updateAt(step.rules, index, { ...rule, value: parseFilterValue(event.target.value, rule.operator) }) })} placeholder={rule.operator === "in" ? "A, B, C" : "Enter value"} />
              </label>
            </div>
            <button className="inline-link" type="button" onClick={() => onChange({ ...step, rules: step.rules.filter((_, itemIndex) => itemIndex !== index) })}>Remove rule</button>
          </div>
        ))}
      </div>
      <button className="secondary-button secondary-button--inline" type="button" onClick={() => onChange({ ...step, rules: [...step.rules, createFilterRule(availableFields[0]?.key ?? "")] })}>Add rule</button>
    </div>
  );
}

function GroupStepEditor(props: { step: Extract<TransformStep, { type: "group" }>; availableFields: DatasetField[]; onChange: (step: TransformStep) => void }) {
  const { step, availableFields, onChange } = props;

  return (
    <div className="step-editor-grid">
      <div>
        <p className="mini-heading">Group by fields</p>
        <div className="checkbox-grid">
          {availableFields.map((field) => (
            <label className="checkbox-pill" key={field.key}>
              <input type="checkbox" checked={step.groupBy.includes(field.key)} onChange={() => onChange({ ...step, groupBy: step.groupBy.includes(field.key) ? step.groupBy.filter((item) => item !== field.key) : [...step.groupBy, field.key] })} />
              <span>{field.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="substep-list">
        {step.aggregates.map((aggregate, index) => (
          <div className="substep-card" key={`${step.id}-aggregate-${index}`}>
            <div className="form-grid form-grid--three">
              <label className="form-field">
                <span>Operation</span>
                <select value={aggregate.operation} onChange={(event) => onChange({ ...step, aggregates: updateAt(step.aggregates, index, { ...aggregate, operation: event.target.value as AggregateDefinition["operation"] }) })}>
                  {aggregateOperations.map((operation) => <option key={operation} value={operation}>{operation}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>Field</span>
                <select value={aggregate.field ?? ""} onChange={(event) => onChange({ ...step, aggregates: updateAt(step.aggregates, index, { ...aggregate, field: event.target.value || undefined }) })}>
                  <option value="">None</option>
                  {availableFields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>Alias</span>
                <input value={aggregate.as} onChange={(event) => onChange({ ...step, aggregates: updateAt(step.aggregates, index, { ...aggregate, as: event.target.value }) })} />
              </label>
            </div>
            <button className="inline-link" type="button" onClick={() => onChange({ ...step, aggregates: step.aggregates.filter((_, itemIndex) => itemIndex !== index) })}>Remove aggregate</button>
          </div>
        ))}
      </div>
      <button className="secondary-button secondary-button--inline" type="button" onClick={() => onChange({ ...step, aggregates: [...step.aggregates, createAggregateDefinition(availableFields)] })}>Add aggregate</button>
    </div>
  );
}

function SortStepEditor(props: { step: Extract<TransformStep, { type: "sort" }>; availableFields: DatasetField[]; onChange: (step: TransformStep) => void }) {
  const { step, availableFields, onChange } = props;

  return (
    <div className="step-editor-grid">
      <div className="substep-list">
        {step.rules.map((rule, index) => (
          <div className="substep-card" key={`${step.id}-sort-${index}`}>
            <div className="form-grid form-grid--two">
              <label className="form-field">
                <span>Field</span>
                <select value={rule.field} onChange={(event) => onChange({ ...step, rules: updateAt(step.rules, index, { ...rule, field: event.target.value }) })}>
                  {availableFields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>Direction</span>
                <select value={rule.direction} onChange={(event) => onChange({ ...step, rules: updateAt(step.rules, index, { ...rule, direction: event.target.value as "asc" | "desc" }) })}>
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </label>
            </div>
            <button className="inline-link" type="button" onClick={() => onChange({ ...step, rules: step.rules.filter((_, itemIndex) => itemIndex !== index) })}>Remove sort rule</button>
          </div>
        ))}
      </div>
      <button className="secondary-button secondary-button--inline" type="button" onClick={() => onChange({ ...step, rules: [...step.rules, { field: availableFields[0]?.key ?? "", direction: "asc" }] })}>Add sort rule</button>
    </div>
  );
}

function CalculateStepEditor(props: { step: Extract<TransformStep, { type: "calculate" }>; availableFields: DatasetField[]; onChange: (step: TransformStep) => void }) {
  const { step, availableFields, onChange } = props;

  return (
    <div className="step-editor-grid">
      <div className="form-grid form-grid--two">
        <label className="form-field">
          <span>Output field</span>
          <input value={step.outputField} onChange={(event) => onChange({ ...step, outputField: event.target.value })} />
        </label>
        <label className="form-field">
          <span>Output kind</span>
          <select value={step.outputKind} onChange={(event) => onChange({ ...step, outputKind: event.target.value as "string" | "number" | "boolean" })}>
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
          </select>
        </label>
      </div>
      <label className="form-field">
        <span>Expression</span>
        <input value={step.expression} onChange={(event) => onChange({ ...step, expression: event.target.value })} placeholder='{amount} >= 100 ? "large" : "small"' />
      </label>
      <div className="formula-help">
        <strong>Available fields</strong>
        <p>{availableFields.map((field) => `{${field.key}}`).join(", ") || "Load data to see field references."}</p>
      </div>
    </div>
  );
}

function SelectStepEditor(props: { step: Extract<TransformStep, { type: "select" }>; availableFields: DatasetField[]; onChange: (step: TransformStep) => void }) {
  const { step, availableFields, onChange } = props;

  return (
    <div className="step-editor-grid">
      <p className="mini-heading">Select output fields</p>
      <div className="checkbox-grid">
        {availableFields.map((field) => (
          <label className="checkbox-pill" key={field.key}>
            <input type="checkbox" checked={step.fields.includes(field.key)} onChange={() => onChange({ ...step, fields: step.fields.includes(field.key) ? step.fields.filter((item) => item !== field.key) : [...step.fields, field.key] })} />
            <span>{field.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function RenameStepEditor(props: { step: Extract<TransformStep, { type: "rename" }>; availableFields: DatasetField[]; onChange: (step: TransformStep) => void }) {
  const { step, availableFields, onChange } = props;

  return (
    <div className="step-editor-grid">
      <div className="substep-list">
        {step.mappings.map((mapping, index) => (
          <div className="substep-card" key={`${step.id}-rename-${index}`}>
            <div className="form-grid form-grid--two">
              <label className="form-field">
                <span>From</span>
                <select value={mapping.from} onChange={(event) => onChange({ ...step, mappings: updateAt(step.mappings, index, { ...mapping, from: event.target.value }) })}>
                  {availableFields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>To</span>
                <input value={mapping.to} onChange={(event) => onChange({ ...step, mappings: updateAt(step.mappings, index, { ...mapping, to: event.target.value }) })} />
              </label>
            </div>
            <button className="inline-link" type="button" onClick={() => onChange({ ...step, mappings: step.mappings.filter((_, itemIndex) => itemIndex !== index) })}>Remove rename</button>
          </div>
        ))}
      </div>
      <button className="secondary-button secondary-button--inline" type="button" onClick={() => onChange({ ...step, mappings: [...step.mappings, { from: availableFields[0]?.key ?? "", to: "renamed_field" }] })}>Add rename</button>
    </div>
  );
}

function StepResultPreview(props: { previewState: { dataset: NormalizedDataset | null; error: string | null }; stepLabel: string; stepIndex: number }) {
  const { previewState, stepLabel, stepIndex } = props;

  if (previewState.error) {
    return <div className="step-preview-shell"><p className="step-preview-shell__label">Step {stepIndex + 1} result</p><p className="upload-status__message upload-status__message--error">{previewState.error}</p></div>;
  }

  if (!previewState.dataset) {
    return <EmptyState title="No step result yet." description="Edit this step to generate an intermediate preview." />;
  }

  return (
    <div className="step-preview-shell">
      <div className="step-preview-shell__header">
        <div>
          <p className="step-preview-shell__label">Step {stepIndex + 1} result</p>
          <h4>{stepLabel || ('Step ' + (stepIndex + 1))}</h4>
        </div>
        <div className="status-chip-list">
          <span className="status-chip status-chip--neutral">{previewState.dataset.rows.length} rows</span>
          <span className="status-chip status-chip--neutral">{previewState.dataset.fields.length} fields</span>
        </div>
      </div>
      <CompactRowExamples dataset={previewState.dataset} />
    </div>
  );
}

function CompactRowExamples({ dataset }: { dataset: NormalizedDataset }) {
  const rows = dataset.sampleRows.slice(0, 2);

  if (dataset.fields.length === 0 || rows.length === 0) {
    return <EmptyState title="No row examples yet." description="The current pipeline output does not have previewable rows yet." />;
  }

  return (
    <div className="compact-row-grid">
      {rows.map((row, rowIndex) => (
        <article className="compact-row-card" key={`compact-row-${rowIndex}`}>
          <p className="step-card__kicker">Example {rowIndex + 1}</p>
          <div className="compact-row-values">
            {dataset.fields.map((field) => (
              <div className="compact-row-item" key={`${rowIndex}-${field.key}`}>
                <span>{field.label}</span>
                <strong>{formatScalar(row[field.key])}</strong>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <article className="summary-card"><span>{label}</span><strong>{value}</strong></article>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><strong>{title}</strong><p>{description}</p></div>;
}

function SchemaPreview({ dataset }: { dataset: NormalizedDataset }) {
  if (dataset.fields.length === 0) {
    return <EmptyState title="No fields available." description="The current pipeline output does not expose any fields yet." />;
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
            <tr key={field.key}>
              <td><div className="field-cell"><strong>{field.label}</strong><span>{field.sourceKey}</span></div></td>
              <td><span className={`value-chip value-chip--${field.kind}`}>{field.kind}</span></td>
              <td>{field.nullable ? "Yes" : "No"}</td>
              <td>{field.valuesPresent}</td>
              <td><div className="value-chip-list">{field.sampleValues.length > 0 ? field.sampleValues.map((value, index) => <span className={`value-chip value-chip--${getValueTone(value)}`} key={`${field.key}-${index}`}>{formatScalar(value)}</span>) : <span className="value-chip value-chip--null">No values</span>}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SampleRowsPreview({ dataset }: { dataset: NormalizedDataset }) {
  if (dataset.fields.length === 0 || dataset.sampleRows.length === 0) {
    return <EmptyState title="No row samples available." description="The current pipeline output does not have previewable rows yet." />;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr>{dataset.fields.map((field) => <th key={field.key} scope="col">{field.label}</th>)}</tr></thead>
        <tbody>
          {dataset.sampleRows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {dataset.fields.map((field) => <td key={`${rowIndex}-${field.key}`}><span className={`value-chip value-chip--${getValueTone(row[field.key])}`}>{formatScalar(row[field.key])}</span></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function createStep(type: TransformStep["type"], configuration: TemplateConfiguration): TransformStep {
  const fields = configuration.source.fields;
  const firstField = fields[0]?.key ?? "";
  const secondField = fields[1]?.key ?? firstField;
  const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  switch (type) {
    case "filter":
      return { id, label: "Filter rows", type, combinator: "and", rules: [createFilterRule(firstField)] };
    case "group":
      return { id, label: "Group rows", type, groupBy: firstField ? [firstField] : [], aggregates: [createAggregateDefinition(fields)] };
    case "sort":
      return { id, label: "Sort rows", type, rules: [{ field: firstField, direction: "asc" }] };
    case "calculate":
      return { id, label: "Calculated field", type, outputField: "calculated_field", expression: firstField ? `{${firstField}}` : '""', outputKind: "string" };
    case "select":
      return { id, label: "Select fields", type, fields: [firstField, secondField].filter(Boolean) };
    case "rename":
      return { id, label: "Rename fields", type, mappings: [{ from: firstField, to: `${firstField || "field"}_renamed` }] };
  }
}

function createFilterRule(field: string): FilterRule {
  return { field, operator: "equals", value: "" };
}

function createAggregateDefinition(fields: Array<{ key: string; kind: string }>): AggregateDefinition {
  const numericField = fields.find((field) => field.kind === "number")?.key;
  return { operation: numericField ? "sum" : "count", field: numericField, as: numericField ? `${numericField}_sum` : "row_count" };
}

function formatStepType(type: TransformStep["type"]): string {
  switch (type) {
    case "filter": return "Filter";
    case "group": return "Group";
    case "sort": return "Sort";
    case "calculate": return "Calculate";
    case "select": return "Select";
    case "rename": return "Rename";
  }
}

function updateAt<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, itemIndex) => (itemIndex === index ? value : item));
}

function parseFilterValue(input: string, operator: FilterOperator): FilterRule["value"] {
  if (operator === "isNull" || operator === "isNotNull") {
    return undefined;
  }

  if (operator === "in") {
    return input.split(",").map((item) => item.trim()).filter(Boolean);
  }

  if (input === "") {
    return "";
  }

  if (input === "true") return true;
  if (input === "false") return false;

  const numericValue = Number(input);
  if (!Number.isNaN(numericValue) && input.trim() !== "") {
    return numericValue;
  }

  return input;
}

function formatFilterValue(rule: FilterRule): string {
  if (rule.value === undefined) {
    return "";
  }

  return Array.isArray(rule.value) ? rule.value.join(", ") : String(rule.value);
}

function resetFilterValue(operator: FilterOperator, currentValue: FilterRule["value"]): FilterRule["value"] {
  if (operator === "isNull" || operator === "isNotNull") {
    return undefined;
  }

  if (operator === "in") {
    return Array.isArray(currentValue) ? currentValue : [];
  }

  return Array.isArray(currentValue) ? "" : currentValue;
}

function getStepValidationMessage(step: TransformStep): string | null {
  if (!step.label.trim()) {
    return "Step label is required.";
  }

  switch (step.type) {
    case "filter": return step.rules.length === 0 ? "At least one filter rule is required." : null;
    case "group": {
      if (step.aggregates.length === 0) {
        return "Add at least one aggregate.";
      }

      const outputFields = [...step.groupBy, ...step.aggregates.map((aggregate) => aggregate.as.trim()).filter(Boolean)];
      if (new Set(outputFields).size !== outputFields.length) {
        return "Group output fields must be unique. Change any aggregate alias that matches another output field.";
      }

      return null;
    }
    case "sort": return step.rules.length === 0 ? "Add at least one sort rule." : null;
    case "calculate": return !step.outputField.trim() ? "Calculated fields need an output field name." : !step.expression.trim() ? "Calculated fields need an expression." : null;
    case "select": return step.fields.length === 0 ? "Select at least one field to keep." : null;
    case "rename": return step.mappings.length === 0 ? "Add at least one rename mapping." : null;
  }
}

function formatScalar(value: DatasetScalar | undefined): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value.length > 0 ? value : '""';
  return String(value);
}

function getValueTone(value: DatasetScalar | undefined): "string" | "number" | "boolean" | "null" {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
}

function getStatusHeading(status: string, fileName: string | null): string {
  if (status === "loading") return "Parsing upload";
  if (status === "ready" && fileName) return fileName;
  if (status === "error") return "Builder needs attention";
  return "Waiting for local input";
}

function getStatusBody(status: string, fileName: string | null, rowCount: number, stepCount: number): string {
  if (status === "loading" && fileName) return `Normalizing ${fileName} into a builder-ready dataset.`;
  if (status === "ready" && fileName) return `${rowCount} source rows and ${stepCount} configured steps are ready for workflow authoring.`;
  if (status === "error") return "Parser, transform, and chart validation errors surface directly in the workflow UI.";
  return "Upload a local file to begin composing a transformation pipeline.";
}

function getStatusMessage(status: string, fileName: string | null, stepCount: number): string {
  if (status === "loading" && fileName) return `Reading ${fileName}...`;
  if (status === "ready" && fileName) return stepCount > 0 ? `${fileName} is loaded and ${stepCount} transform steps are active.` : `${fileName} is loaded. Add your first transform step.`;
  if (status === "error") return "The workflow could not be initialized.";
  return "No file selected. Upload a local CSV or flat JSON array to start the builder.";
}

function normalizeTemplateDescription(value: string): string | null {
  const nextValue = value.trim();
  return nextValue.length > 0 ? nextValue : null;
}

function serializeChartMapping(chart: ChartMapping): string {
  return JSON.stringify(chart);
}

function getBackendStatusMessage(
  requestState: "idle" | "loading" | "ready" | "error",
  health: BackendHealthResponse | null,
  meta: BackendMetaResponse | null,
  error: string | null,
  backendBaseUrl: string | undefined,
): string {
  if (requestState === "loading") {
    return `Checking backend at ${backendBaseUrl ?? window.location.origin}...`;
  }

  if (requestState === "error") {
    return error ?? "Backend connection failed.";
  }

  if (requestState === "ready") {
    const service = health?.service ?? meta?.service ?? meta?.application ?? "backend";
    const version = health?.version ?? meta?.version;
    const mode = health?.mode ?? meta?.mode;
    return [service, version ? `v${version}` : null, mode].filter(Boolean).join(" | ");
  }

  return "Backend status has not been checked yet.";
}

function getTemplateErrorMessage(error: unknown): string {
  if (error instanceof TemplateApiError) {
    return `Template API request failed with status ${error.status}.`;
  }

  return error instanceof Error ? error.message : "Template request failed.";
}









