import { ChangeEvent, useEffect, useId, useMemo, useRef, useState } from "react";
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
type BuilderStage = "data" | "transforms" | "chart" | "share";

export function TransformBuilderWorkbench() {
  const uploadInputId = useId();
  const { status, dataset, error, fileName, loadFile, reset } = useDatasetUpload();
  const [configuration, setConfiguration] = useState<TemplateConfiguration | null>(null);
  const [nextStepType, setNextStepType] = useState<TransformStep["type"]>("filter");
  const [activeStage, setActiveStage] = useState<BuilderStage>("data");
  const [isOutputExamplesOpen, setIsOutputExamplesOpen] = useState(false);
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
  const hadDatasetRef = useRef(false);
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
  const stages = useMemo(
    () =>
      [
        {
          id: "data" as const,
          label: "Data",
          title: "Upload source",
          description: dataset ? `${dataset.source.rowCount} rows loaded from ${dataset.source.kind.toUpperCase()}.` : "Upload a CSV or JSON file.",
          tone: status === "error" ? "error" : dataset ? "ready" : "idle",
        },
        {
          id: "transforms" as const,
          label: "Transforms",
          title: "Shape dataset",
          description: configuration ? `${configuration.transforms.length} configured step${configuration.transforms.length === 1 ? "" : "s"}.` : "Build a transformation pipeline.",
          tone: previewState.error ? "error" : configuration?.transforms.length ? "ready" : "idle",
        },
        {
          id: "chart" as const,
          label: "Chart",
          title: "Map visual",
          description: configuration ? `${formatStepTypeForStage(configuration.chart.chartType)} preview is bound to output fields.` : "Map the transformed dataset to a chart.",
          tone: chartPreview?.issue ? "error" : configuration ? "ready" : "idle",
        },
        {
          id: "share" as const,
          label: "Share",
          title: "Persist config",
          description: persistedTemplate ? "Share link is ready." : "Save or update the workflow template.",
          tone: templateRequestState === "error" ? "error" : persistedTemplate ? "ready" : "idle",
        },
      ] satisfies Array<{ id: BuilderStage; label: string; title: string; description: string; tone: "idle" | "ready" | "error" }>,
    [chartPreview?.issue, configuration, dataset, persistedTemplate, previewState.error, status, templateRequestState],
  );

  useEffect(() => {
    if (!dataset) {
      hadDatasetRef.current = false;
      setActiveStage("data");
      return;
    }

    if (!hadDatasetRef.current) {
      hadDatasetRef.current = true;
      setActiveStage("transforms");
    }
  }, [dataset]);

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    void loadFile(nextFile);
    event.target.value = "";
  }

  function handleExportCsv() {
    const exportDataset = previewState.dataset ?? dataset;

    if (!exportDataset) {
      return;
    }

    downloadDatasetAsCsv(exportDataset, fileName);
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
      <header className="builder-topbar">
        <div className="builder-topbar__identity">
          <p className="eyebrow">Charter Builder</p>
          <div className="builder-topbar__title-row">
            <h1>Build chart-ready views</h1>
            <span className={"status-chip status-chip--" + status}>{getStatusHeading(status, fileName)}</span>
          </div>
          <p className="builder-topbar__summary">Upload data, shape the pipeline, map a chart, and share the configuration.</p>
        </div>

        <div className="builder-topbar__metrics">
          <article className="builder-topbar__metric">
            <span>Rows</span>
            <strong>{dataset?.source.rowCount ?? 0}</strong>
          </article>
          <article className="builder-topbar__metric">
            <span>Steps</span>
            <strong>{configuration?.transforms.length ?? 0}</strong>
          </article>
          <article className="builder-topbar__metric">
            <span>Fields</span>
            <strong>{previewState.dataset?.fields.length ?? dataset?.fields.length ?? 0}</strong>
          </article>
        </div>

        <div className="builder-topbar__status">
          <div className="status-chip-list">
            <span className={"status-chip status-chip--" + (backendRequestState === "error" ? "error" : backendRequestState === "loading" ? "loading" : backendRequestState === "ready" ? "ready" : "neutral")}>
              {backendRequestState === "ready" ? "Backend connected" : backendRequestState === "loading" ? "Checking backend" : backendRequestState === "error" ? "Backend offline" : "Backend idle"}
            </span>
            <span className={"status-chip status-chip--" + (previewState.error ? "error" : configuration?.transforms.length ? "ready" : "neutral")}>
              {previewState.error ? "Preview issue" : configuration?.transforms.length ? "Pipeline active" : "Pipeline idle"}
            </span>
          </div>
          <p className="builder-topbar__note">{getBackendStatusMessage(backendRequestState, backendHealth, backendMeta, backendError, backendBaseUrl)}</p>
        </div>
      </header>

      <main className="builder-layout builder-layout--focused">
        <aside className="builder-sidebar">
          <div className="panel builder-sidebar__panel">
            <div className="section-heading">
              <p className="section-kicker">Flow</p>
              <h2>Build sequence</h2>
            </div>
            <div className="builder-stage-list">
              {stages.map((stage, index) => (
                <button
                  key={stage.id}
                  className={"builder-stage-card" + (activeStage === stage.id ? " builder-stage-card--active" : "")}
                  type="button"
                  onClick={() => setActiveStage(stage.id)}
                >
                  <span className="builder-stage-card__index">0{index + 1}</span>
                  <div className="builder-stage-card__body">
                    <div className="builder-stage-card__header">
                      <strong>{stage.label}</strong>
                      <span className={"status-chip status-chip--" + stage.tone}>{stage.tone}</span>
                    </div>
                    <p>{stage.title}</p>
                    <span>{stage.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="builder-main builder-main--focused">
          {activeStage === "data" && (
            <div className="builder-stage-layout">
              <div className="builder-stage-primary">
                <section className="panel panel--heroic">
                  <div className="panel__header">
                    <div className="section-heading">
                      <p className="section-kicker">Data Intake</p>
                      <h2>Load a browser-local source file.</h2>
                    </div>
                    {(dataset || error) && (
                      <button className="secondary-button" type="button" onClick={handleReset}>
                        Clear state
                      </button>
                    )}
                  </div>
                  <div className="upload-grid upload-grid--builder">
                    <label className="upload-card upload-card--hero" htmlFor={uploadInputId}>
                      <input
                        id={uploadInputId}
                        className="sr-only"
                        type="file"
                        accept=".csv,.json,text/csv,application/json"
                        onChange={handleInputChange}
                      />
                      <span className="upload-card__eyebrow">Local source</span>
                      <strong>Choose a .csv or .json file</strong>
                      <p>Files stay in the browser. Charter only stores the configuration contract, never the uploaded rows.</p>
                      <span className="upload-card__button">{status === "loading" ? "Parsing file..." : "Select file"}</span>
                    </label>

                    <div className="upload-status upload-status--builder">
                      <p className="upload-status__label">Ingestion status</p>
                      {error ? (
                        <p className="upload-status__message upload-status__message--error">{error}</p>
                      ) : previewState.error ? (
                        <p className="upload-status__message upload-status__message--error">{previewState.error}</p>
                      ) : (
                        <p className="upload-status__message">{getStatusMessage(status, fileName, configuration?.transforms.length ?? 0)}</p>
                      )}

                      <ul className="detail-list">
                        <li>CSV headers become field names and are deduplicated when needed.</li>
                        <li>Flat JSON arrays are normalized into the same row contract as CSV uploads.</li>
                        <li>Every downstream preview is driven from the current pipeline output, not a separate data store.</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <section className="panel">
                  <div className="section-heading">
                    <p className="section-kicker">Source Schema</p>
                    <h2>Validate fields before modeling the chart.</h2>
                  </div>
                  {dataset ? (
                    <SchemaPreview dataset={dataset} />
                  ) : (
                    <EmptyState title="Schema preview is empty." description="Load a file to inspect inferred field kinds and sample values." />
                  )}
                </section>
              </div>

              <aside className="builder-stage-secondary">
                <section className="panel">
                  <div className="section-heading">
                    <p className="section-kicker">Dataset Summary</p>
                    <h2>Imported shape at a glance.</h2>
                  </div>
                  {dataset ? (
                    <div className="summary-grid summary-grid--sidebar">
                      <SummaryCard label="Source type" value={dataset.source.kind.toUpperCase()} />
                      <SummaryCard label="Rows" value={dataset.source.rowCount.toString()} />
                      <SummaryCard label="Fields" value={dataset.fields.length.toString()} />
                      <SummaryCard label="Sample rows" value={dataset.sampleRows.length.toString()} />
                    </div>
                  ) : (
                    <EmptyState title="No dataset loaded yet." description="Upload a file to generate a normalized schema and sample rows." />
                  )}
                </section>

                <section className="panel">
                  <div className="section-heading">
                    <p className="section-kicker">Principles</p>
                    <h2>Guardrails</h2>
                  </div>
                  <div className="note-grid note-grid--stacked">
                    {contractNotes.map((note) => (
                      <article className="note-card" key={note.title}>
                        <h3>{note.title}</h3>
                        <p>{note.description}</p>
                      </article>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          )}

          {activeStage === "transforms" && (
            <div className="builder-stage-layout">
              <div className="builder-stage-primary">
                <section className="panel panel--heroic">
                  <div className="panel__header panel__header--builder">
                    <div className="section-heading">
                      <p className="section-kicker">Transform Builder</p>
                      <h2>Compose the pipeline as a sequence of readable steps.</h2>
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
                          Add step
                        </button>
                        <p className="builder-toolbar__hint">Each card is one pipeline instruction. Reorder cards to change execution order.</p>
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
                      <EmptyState title="No transform steps yet." description="Add a filter, group, sort, calculate, select, or rename step to start shaping the dataset." />
                    )
                  ) : (
                    <EmptyState title="Transform builder is unavailable." description="Upload data first so the step editors can bind against real field names." />
                  )}
                </section>
              </div>

              <aside className="builder-stage-secondary">
                <section className="panel panel--compact-actions">
                  <div className="section-heading">
                    <p className="section-kicker">Output Preview</p>
                    <h2>Inspect transformed rows on demand.</h2>
                  </div>
                  <p className="panel__supporting-copy">Open a dedicated preview overlay when you need to validate row output. This keeps wide datasets from stretching the workbench.</p>
                  <div className="panel__action-row">
                    <button className="secondary-button secondary-button--inline" type="button" onClick={() => setIsOutputExamplesOpen(true)}>
                      Open row preview
                    </button>
                    <button className="secondary-button secondary-button--inline" type="button" onClick={handleExportCsv} disabled={!dataset && !previewState.dataset}>
                      Export CSV
                    </button>
                  </div>
                </section>
              </aside>
            </div>
          )}

          {activeStage === "chart" && (
            <div className="builder-stage-layout">
              <div className="builder-stage-primary">
                <section className="panel panel--heroic">
                  <div className="section-heading">
                    <p className="section-kicker">Chart Mapping</p>
                    <h2>Bind the transformed dataset to a supported visual.</h2>
                  </div>
                  {chartDataset && configuration ? (
                    <ChartMappingEditor dataset={chartDataset} chart={configuration.chart} onChange={updateChartMapping} />
                  ) : (
                    <EmptyState title="Chart mapping is unavailable." description="Upload data first so the chart controls can bind against the current output schema." />
                  )}
                </section>
              </div>

              <aside className="builder-stage-secondary">
                <section className="panel">
                  <div className="section-heading">
                    <p className="section-kicker">Live Preview</p>
                    <h2>Current chart output</h2>
                  </div>
                  <ChartPreviewCard preview={chartPreview} />
                </section>

                <section className="panel">
                  <div className="section-heading">
                    <p className="section-kicker">Preview Rows</p>
                    <h2>Sample output used by the live chart.</h2>
                  </div>
                  {previewState.dataset ? (
                    <SampleRowsPreview dataset={previewState.dataset} />
                  ) : dataset ? (
                    <SampleRowsPreview dataset={dataset} />
                  ) : (
                    <EmptyState title="No preview rows yet." description="Once data is loaded, the current pipeline output appears here." />
                  )}
                </section>
              </aside>
            </div>
          )}

          {activeStage === "share" && (
            <div className="builder-stage-layout">
              <div className="builder-stage-primary">
                <section className="panel panel--heroic">
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
              </div>

              <aside className="builder-stage-secondary">
                <section className="panel">
                  <div className="section-heading">
                    <p className="section-kicker">Snapshot</p>
                    <h2>Current authoring state.</h2>
                  </div>
                  {dataset && configuration ? (
                    <div className="summary-grid summary-grid--sidebar">
                      <SummaryCard label="Source rows" value={dataset.source.rowCount.toString()} />
                      <SummaryCard label="Step count" value={configuration.transforms.length.toString()} />
                      <SummaryCard label="Preview rows" value={(previewState.dataset?.rows.length ?? dataset.rows.length).toString()} />
                      <SummaryCard label="Chart type" value={configuration.chart.chartType} />
                    </div>
                  ) : (
                    <EmptyState title="Builder is waiting for data." description="Upload a file to activate the full workbench." />
                  )}
                </section>

                <section className="panel">
                  <div className="section-heading">
                    <p className="section-kicker">Preview</p>
                    <h2>Current chart output</h2>
                  </div>
                  <ChartPreviewCard preview={chartPreview} />
                </section>
              </aside>
            </div>
          )}
        </section>

        {isOutputExamplesOpen && (
          <div className="overlay-backdrop" role="presentation" onClick={() => setIsOutputExamplesOpen(false)}>
            <div className="overlay-dialog" role="dialog" aria-modal="true" aria-label="Output examples" onClick={(event) => event.stopPropagation()}>
              <div className="overlay-dialog__header">
                <div className="section-heading">
                  <p className="section-kicker">Output Examples</p>
                  <h2>Preview transformed rows without affecting the layout.</h2>
                </div>
                <button className="icon-button" type="button" onClick={() => setIsOutputExamplesOpen(false)}>Close</button>
              </div>
              {previewState.dataset ? (
                <CompactRowExamples dataset={previewState.dataset} />
              ) : dataset ? (
                <CompactRowExamples dataset={dataset} />
              ) : (
                <EmptyState title="No row examples yet." description="Upload a file to see output examples after the active pipeline." />
              )}
            </div>
          </div>
        )}
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
          <p className="step-card__summary">{describeStep(step, availableFields)}</p>
        </div>
        <div className="step-card__actions">
          <span className={"status-chip status-chip--" + (validationMessage ? "error" : previewState.error ? "error" : "ready")}>
            {validationMessage ? "Needs setup" : previewState.error ? "Preview error" : "Configured"}
          </span>
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
  const pageSize = 10;
  const [page, setPage] = useState(1);
  const totalRows = dataset.rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const rows = dataset.rows.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setPage(1);
  }, [dataset]);

  if (dataset.fields.length === 0 || rows.length === 0) {
    return <EmptyState title="No row examples yet." description="The current pipeline output does not have previewable rows yet." />;
  }

  return (
    <div className="compact-preview-table-shell">
      <div className="compact-preview-table-shell__header">
        <span className="status-chip status-chip--neutral">{totalRows} rows</span>
        <span className="status-chip status-chip--neutral">Page {currentPage} of {totalPages}</span>
      </div>
      <div className="table-scroll">
        <table className="data-table data-table--compact-preview">
          <thead>
            <tr>
              {dataset.fields.map((field) => (
                <th key={field.key} scope="col">{field.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`compact-row-${startIndex + rowIndex}`}>
                {dataset.fields.map((field) => (
                  <td key={`${startIndex + rowIndex}-${field.key}`}>
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
      <div className="pagination-bar">
        <span className="pagination-bar__summary">Showing {startIndex + 1}-{Math.min(startIndex + rows.length, totalRows)} of {totalRows}</span>
        <div className="pagination-bar__actions">
          <button className="icon-button" type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
          <button className="icon-button" type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
        </div>
      </div>
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

function formatStepTypeForStage(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function describeStep(step: TransformStep, availableFields: DatasetField[]): string {
  switch (step.type) {
    case "filter":
      return step.rules.length > 0
        ? `${step.combinator.toUpperCase()} ${step.rules.length} rule${step.rules.length === 1 ? "" : "s"} across ${availableFields.length} available field${availableFields.length === 1 ? "" : "s"}.`
        : "No filter rules configured yet.";
    case "group":
      return `Group by ${step.groupBy.length || 0} field${step.groupBy.length === 1 ? "" : "s"} and calculate ${step.aggregates.length} aggregate${step.aggregates.length === 1 ? "" : "s"}.`;
    case "sort":
      return step.rules.length > 0 ? `Sort by ${step.rules.map((rule) => `${rule.field} ${rule.direction}`).join(", ")}.` : "No sort rules configured yet.";
    case "calculate":
      return step.outputField.trim() ? `Create ${step.outputField} as a ${step.outputKind} expression.` : "Add an output field and expression.";
    case "select":
      return step.fields.length > 0 ? `Keep ${step.fields.length} output field${step.fields.length === 1 ? "" : "s"}.` : "No output fields selected yet.";
    case "rename":
      return step.mappings.length > 0 ? `Rename ${step.mappings.length} field${step.mappings.length === 1 ? "" : "s"} in the final output.` : "No rename mappings configured yet.";
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

function downloadDatasetAsCsv(dataset: NormalizedDataset, fileName: string | null): void {
  const headers = dataset.fields.map((field) => field.label);
  const rows = dataset.rows.map((row) => dataset.fields.map((field) => escapeCsvValue(row[field.key])));
  const csv = [headers.map(escapeCsvCell).join(","), ...rows.map((values) => values.join(","))].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const baseName = (fileName ?? "charter-output").replace(/\.[^.]+$/, "");
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = baseName + "-output.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function escapeCsvValue(value: DatasetScalar | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  return escapeCsvCell(String(value));
}

function escapeCsvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return /[",\r\n]/.test(value) ? `"${escaped}"` : escaped;
}
function getTemplateErrorMessage(error: unknown): string {
  if (error instanceof TemplateApiError) {
    return `Template API request failed with status ${error.status}.`;
  }

  return error instanceof Error ? error.message : "Template request failed.";
}










