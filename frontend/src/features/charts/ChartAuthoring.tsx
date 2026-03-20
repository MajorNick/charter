import { ChangeEvent, useState } from "react";
import { DatasetField, NormalizedDataset } from "../dataset";
import { ChartMapping, TemplateChartType } from "../template-contract";
import { CartesianChartPreviewResult, ChartPreviewResult, PieChartPreviewResult, createChartMappingForType } from "./previewModel";

interface ChartMappingEditorProps {
  dataset: NormalizedDataset;
  chart: ChartMapping;
  onChange: (chart: ChartMapping) => void;
}

export function ChartMappingEditor({ dataset, chart, onChange }: ChartMappingEditorProps) {
  const numericFields = dataset.fields.filter((field) => field.kind === "number");
  const valueFields = numericFields.length > 0 ? numericFields : dataset.fields;

  function handleChartTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextType = event.target.value as TemplateChartType;
    onChange(createChartMappingForType(nextType, dataset.fields, chart.title));
  }

  return (
    <div className="chart-editor-grid">
      <div className="chart-editor-summary">
        <div className="chart-editor-summary__item">
          <span>Mode</span>
          <strong>{chart.chartType}</strong>
        </div>
        <div className="chart-editor-summary__item">
          <span>Fields</span>
          <strong>{dataset.fields.length}</strong>
        </div>
        <div className="chart-editor-summary__item">
          <span>Numeric fields</span>
          <strong>{numericFields.length}</strong>
        </div>
      </div>
      <div className="form-grid form-grid--three">
        <label className="form-field">
          <span>Chart type</span>
          <select value={chart.chartType} onChange={handleChartTypeChange}>
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
          </select>
        </label>
        <label className="form-field chart-editor-grid__title">
          <span>Title</span>
          <input value={chart.title ?? ""} onChange={(event) => onChange({ ...chart, title: event.target.value })} placeholder="Optional chart title" />
        </label>
      </div>

      {(chart.chartType === "bar" || chart.chartType === "line") && (
        <div className="form-grid form-grid--four">
          <label className="form-field">
            <span>X field</span>
            <select value={chart.xField} onChange={(event) => onChange({ ...chart, xField: event.target.value })}>
              {dataset.fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Y field</span>
            <select value={chart.yField} onChange={(event) => onChange({ ...chart, yField: event.target.value })}>
              {valueFields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
            </select>
          </label>
          <NullableFieldSelect label="Series field" fields={dataset.fields} value={chart.seriesField ?? ""} onChange={(value) => onChange({ ...chart, seriesField: value })} />
          <NullableFieldSelect label="Color field" fields={dataset.fields} value={chart.colorField ?? ""} onChange={(value) => onChange({ ...chart, colorField: value })} />
        </div>
      )}

      {chart.chartType === "pie" && (
        <div className="form-grid form-grid--three">
          <label className="form-field">
            <span>Label field</span>
            <select value={chart.labelField} onChange={(event) => onChange({ ...chart, labelField: event.target.value })}>
              {dataset.fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Value field</span>
            <select value={chart.valueField} onChange={(event) => onChange({ ...chart, valueField: event.target.value })}>
              {valueFields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
            </select>
          </label>
          <NullableFieldSelect label="Color field" fields={dataset.fields} value={chart.colorField ?? ""} onChange={(value) => onChange({ ...chart, colorField: value })} />
        </div>
      )}

      <div className="chart-editor-note">
        <strong>Preview rules</strong>
        <p>Chart rendering uses the transformed output dataset only. Numeric axes and values skip null or non-numeric rows rather than mutating the saved template contract.</p>
      </div>
      <div className="chart-editor-note chart-editor-note--subtle">
        <strong>Mapping guide</strong>
        <p>Choose a category field first, then bind the primary measure. Optional series and color bindings let you split the output without changing the underlying template JSON.</p>
      </div>
    </div>
  );
}

function NullableFieldSelect(props: {
  label: string;
  fields: DatasetField[];
  value: string;
  onChange: (value: string | null) => void;
}) {
  const { label, fields, value, onChange } = props;

  return (
    <label className="form-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">None</option>
        {fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
      </select>
    </label>
  );
}

export function ChartPreviewCard({ preview }: { preview: ChartPreviewResult | null }) {
  const [exportState, setExportState] = useState<"idle" | "saving" | "error">("idle");

  async function handleExportPng() {
    if (!preview || preview.issue) {
      return;
    }

    setExportState("saving");
    try {
      await exportChartPreviewAsPng(preview);
      setExportState("idle");
    } catch {
      setExportState("error");
      window.setTimeout(() => setExportState("idle"), 2000);
    }
  }

  if (!preview) {
    return <div className="empty-state"><strong>No chart preview yet.</strong><p>Upload data to start mapping the transformed dataset onto a chart.</p></div>;
  }

  if (preview.issue) {
    return <div className="empty-state"><strong>Chart preview needs attention.</strong><p>{preview.issue}</p></div>;
  }

  return (
    <div className="chart-preview-shell">
      <div className="chart-preview-shell__header">
        <div>
          <p className="section-kicker">Preview</p>
          <h3>{preview.title}</h3>
        </div>
        <div className="chart-preview-shell__actions">
          <span className="status-chip status-chip--neutral">{preview.chartType} chart</span>
          <button className="secondary-button secondary-button--inline" type="button" onClick={() => void handleExportPng()}>
            {exportState === "saving" ? "Exporting..." : exportState === "error" ? "Export failed" : "Export PNG"}
          </button>
        </div>
      </div>

      {preview.chartType === "bar" && <BarChartPreview preview={preview} />}
      {preview.chartType === "line" && <LineChartPreview preview={preview} />}
      {preview.chartType === "pie" && <PieChartPreview preview={preview} />}
    </div>
  );
}

function BarChartPreview({ preview }: { preview: CartesianChartPreviewResult }) {
  const visibleCategories = preview.categories.slice(0, 10);
  const visiblePoints = preview.points.filter((point) => visibleCategories.includes(point.categoryLabel));
  const seriesOrder = preview.series;
  const maxValue = Math.max(preview.maxValue, 1);

  return (
    <div className="chart-stack">
      <LegendChips labels={seriesOrder} points={visiblePoints} />
      <div className="bar-chart">
        {visibleCategories.map((category) => {
          const categoryPoints = visiblePoints.filter((point) => point.categoryLabel === category);
          return (
            <div className="bar-chart__group" key={category}>
              <div className="bar-chart__bars">
                {seriesOrder.map((seriesLabel) => {
                  const point = categoryPoints.find((item) => item.seriesLabel === seriesLabel);
                  const height = point ? Math.max((point.value / maxValue) * 100, 6) : 0;
                  return (
                    <div className="bar-chart__bar-wrap" key={`${category}-${seriesLabel}`}>
                      <span className="bar-chart__value">{point ? formatMetric(point.value) : ""}</span>
                      <div className="bar-chart__bar" style={{ height: `${height}%`, background: point?.color ?? "transparent" }} />
                    </div>
                  );
                })}
              </div>
              <span className="bar-chart__label">{category}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LineChartPreview({ preview }: { preview: CartesianChartPreviewResult }) {
  const categories = preview.categories.slice(0, 12);
  const width = 720;
  const height = 280;
  const padding = { top: 24, right: 24, bottom: 44, left: 44 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const xStep = categories.length > 1 ? innerWidth / (categories.length - 1) : innerWidth / 2;
  const maxValue = Math.max(preview.maxValue, 1);

  return (
    <div className="chart-stack">
      <LegendChips labels={preview.series} points={preview.points} />
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={preview.title}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + innerHeight - innerHeight * ratio;
          return <line className="line-chart__grid" key={ratio} x1={padding.left} x2={width - padding.right} y1={y} y2={y} />;
        })}
        {preview.series.map((seriesLabel) => {
          const seriesPoints = categories.map((category, index) => {
            const point = preview.points.find((item) => item.categoryLabel === category && item.seriesLabel === seriesLabel);
            if (!point) {
              return null;
            }

            return {
              x: padding.left + (categories.length === 1 ? innerWidth / 2 : index * xStep),
              y: padding.top + innerHeight - (point.value / maxValue) * innerHeight,
              color: point.color,
              value: point.value,
            };
          }).filter((point): point is { x: number; y: number; color: string; value: number } => point !== null);

          if (seriesPoints.length === 0) {
            return null;
          }

          return (
            <g key={seriesLabel}>
              <polyline className="line-chart__path" fill="none" points={seriesPoints.map((point) => `${point.x},${point.y}`).join(" ")} stroke={seriesPoints[0].color} />
              {seriesPoints.map((point, index) => (
                <g key={`${seriesLabel}-${index}`}>
                  <circle className="line-chart__point" cx={point.x} cy={point.y} r="4.5" fill={point.color} />
                  <text className="line-chart__value" x={point.x} y={point.y - 10} textAnchor="middle">{formatMetric(point.value)}</text>
                </g>
              ))}
            </g>
          );
        })}
        {categories.map((category, index) => {
          const x = padding.left + (categories.length === 1 ? innerWidth / 2 : index * xStep);
          return <text className="line-chart__axis-label" key={category} x={x} y={height - 16} textAnchor="middle">{category}</text>;
        })}
      </svg>
    </div>
  );
}

function PieChartPreview({ preview }: { preview: PieChartPreviewResult }) {
  const center = 120;
  const radius = 92;
  let currentAngle = -Math.PI / 2;

  return (
    <div className="pie-chart-layout">
      <svg className="pie-chart" viewBox="0 0 240 240" role="img" aria-label={preview.title}>
        {preview.slices.map((slice) => {
          const angle = slice.percent * Math.PI * 2;
          const startAngle = currentAngle;
          const endAngle = currentAngle + angle;
          currentAngle = endAngle;
          return <path key={slice.label} d={describeArc(center, center, radius, startAngle, endAngle)} fill={slice.color} stroke="#fff8ef" strokeWidth="2" />;
        })}
        <circle cx={center} cy={center} r="46" fill="#fffdf8" />
        <text className="pie-chart__metric" x={center} y={center - 4} textAnchor="middle">{formatMetric(preview.totalValue)}</text>
        <text className="pie-chart__label" x={center} y={center + 16} textAnchor="middle">total</text>
      </svg>
      <div className="pie-chart__legend">
        {preview.slices.map((slice) => (
          <div className="legend-row" key={slice.label}>
            <span className="legend-row__swatch" style={{ background: slice.color }} />
            <span className="legend-row__label">{slice.label}</span>
            <span className="legend-row__value">{formatMetric(slice.value)} - {Math.round(slice.percent * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendChips(props: { labels: string[]; points: Array<{ seriesLabel: string; color: string }> }) {
  const seen = new Set<string>();
  const items = props.labels.map((label) => props.points.find((point) => point.seriesLabel === label)).filter((item): item is { seriesLabel: string; color: string } => {
    if (!item || seen.has(item.seriesLabel)) {
      return false;
    }
    seen.add(item.seriesLabel);
    return true;
  });

  if (items.length <= 1) {
    return null;
  }

  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span className="chart-legend__item" key={item.seriesLabel}>
          <span className="chart-legend__swatch" style={{ background: item.color }} />
          {item.seriesLabel}
        </span>
      ))}
    </div>
  );
}

function formatMetric(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInRadians: number): { x: number; y: number } {
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

async function exportChartPreviewAsPng(preview: ChartPreviewResult): Promise<void> {
  const svgMarkup = buildChartExportSvg(preview);
  const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 720;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas context is unavailable.");
    }

    context.fillStyle = "#fffaf2";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngUrl = canvas.toDataURL("image/png");
    downloadUrl(pngUrl, `${toFileName(preview.title || "chart-preview")}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function buildChartExportSvg(preview: ChartPreviewResult): string {
  const body = preview.chartType === "bar"
    ? buildBarChartSvg(preview)
    : preview.chartType === "line"
      ? buildLineChartSvg(preview)
      : buildPieChartSvg(preview);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img" aria-label="${escapeXml(preview.title)}">
  <rect width="1200" height="720" rx="28" fill="#fffaf2" />
  <text x="64" y="74" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#c96a1b" letter-spacing="2">CHART PREVIEW</text>
  <text x="64" y="118" font-family="Georgia, Times New Roman, serif" font-size="40" font-weight="700" fill="#111a2c">${escapeXml(preview.title)}</text>
  ${body}
</svg>`;
}

function buildBarChartSvg(preview: CartesianChartPreviewResult): string {
  const categories = preview.categories.slice(0, 10);
  const points = preview.points.filter((point) => categories.includes(point.categoryLabel));
  const series = preview.series;
  const maxValue = Math.max(preview.maxValue, 1);
  const chartTop = 180;
  const chartHeight = 360;
  const chartLeft = 72;
  const chartWidth = 1056;
  const groupWidth = chartWidth / Math.max(categories.length, 1);
  const barGap = 10;
  const availableBarWidth = Math.max(groupWidth - 28, 16);
  const barWidth = Math.max((availableBarWidth - barGap * Math.max(series.length - 1, 0)) / Math.max(series.length, 1), 10);

  const legend = buildLegendSvg(series.map((label) => ({ label, color: points.find((point) => point.seriesLabel === label)?.color ?? "#2b6cb0" })), 64, 138);
  const bars = categories.map((category, categoryIndex) => {
    const categoryPoints = points.filter((point) => point.categoryLabel === category);
    const baseX = chartLeft + categoryIndex * groupWidth + 14;
    const barNodes = series.map((seriesLabel, seriesIndex) => {
      const point = categoryPoints.find((item) => item.seriesLabel === seriesLabel);
      if (!point) {
        return "";
      }

      const height = Math.max((point.value / maxValue) * chartHeight, 8);
      const x = baseX + seriesIndex * (barWidth + barGap);
      const y = chartTop + chartHeight - height;
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="10" fill="${point.color}" />
        <text x="${x + barWidth / 2}" y="${y - 10}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#5f6b7d">${escapeXml(formatMetric(point.value))}</text>`;
    }).join("");

    return `
      ${barNodes}
      <text x="${baseX + Math.max((series.length * barWidth + (series.length - 1) * barGap) / 2, barWidth / 2)}" y="${chartTop + chartHeight + 28}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#5f6b7d">${escapeXml(category)}</text>`;
  }).join("");

  return `${legend}
    <rect x="${chartLeft}" y="${chartTop}" width="${chartWidth}" height="${chartHeight}" rx="22" fill="#f3eee4" />
    ${bars}`;
}

function buildLineChartSvg(preview: CartesianChartPreviewResult): string {
  const categories = preview.categories.slice(0, 12);
  const chartTop = 180;
  const chartHeight = 360;
  const chartLeft = 72;
  const chartWidth = 1056;
  const maxValue = Math.max(preview.maxValue, 1);
  const xStep = categories.length > 1 ? chartWidth / (categories.length - 1) : chartWidth / 2;
  const legend = buildLegendSvg(preview.series.map((label) => ({ label, color: preview.points.find((point) => point.seriesLabel === label)?.color ?? "#2b6cb0" })), 64, 138);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = chartTop + chartHeight - chartHeight * ratio;
    return `<line x1="${chartLeft}" x2="${chartLeft + chartWidth}" y1="${y}" y2="${y}" stroke="rgba(17,26,44,0.12)" stroke-width="1" />`;
  }).join("");
  const seriesMarkup = preview.series.map((seriesLabel) => {
    const seriesPoints = categories.map((category, index) => {
      const point = preview.points.find((item) => item.categoryLabel === category && item.seriesLabel === seriesLabel);
      if (!point) {
        return null;
      }
      return {
        x: chartLeft + (categories.length === 1 ? chartWidth / 2 : index * xStep),
        y: chartTop + chartHeight - (point.value / maxValue) * chartHeight,
        color: point.color,
        value: point.value,
      };
    }).filter((point): point is { x: number; y: number; color: string; value: number } => point !== null);

    if (seriesPoints.length === 0) {
      return "";
    }

    const path = seriesPoints.map((point) => `${point.x},${point.y}`).join(" ");
    const nodes = seriesPoints.map((point) => `
      <circle cx="${point.x}" cy="${point.y}" r="5" fill="${point.color}" stroke="#fffaf2" stroke-width="2" />
      <text x="${point.x}" y="${point.y - 12}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#5f6b7d">${escapeXml(formatMetric(point.value))}</text>`).join("");
    return `<polyline fill="none" stroke="${seriesPoints[0].color}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" points="${path}" />${nodes}`;
  }).join("");
  const labels = categories.map((category, index) => {
    const x = chartLeft + (categories.length === 1 ? chartWidth / 2 : index * xStep);
    return `<text x="${x}" y="${chartTop + chartHeight + 28}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#5f6b7d">${escapeXml(category)}</text>`;
  }).join("");

  return `${legend}
    <rect x="${chartLeft}" y="${chartTop}" width="${chartWidth}" height="${chartHeight}" rx="22" fill="#f3eee4" />
    ${grid}
    ${seriesMarkup}
    ${labels}`;
}

function buildPieChartSvg(preview: PieChartPreviewResult): string {
  const centerX = 260;
  const centerY = 380;
  const radius = 140;
  let currentAngle = -Math.PI / 2;
  const slices = preview.slices.map((slice) => {
    const angle = slice.percent * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    return `<path d="${describeArc(centerX, centerY, radius, startAngle, endAngle)}" fill="${slice.color}" stroke="#fffaf2" stroke-width="3" />`;
  }).join("");
  const legend = preview.slices.map((slice, index) => `
    <rect x="560" y="${210 + index * 44}" width="14" height="14" rx="7" fill="${slice.color}" />
    <text x="586" y="${222 + index * 44}" font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="#111a2c">${escapeXml(slice.label)}</text>
    <text x="1048" y="${222 + index * 44}" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#5f6b7d">${escapeXml(formatMetric(slice.value))} · ${Math.round(slice.percent * 100)}%</text>`).join("");

  return `
    <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="#f3eee4" />
    ${slices}
    <circle cx="${centerX}" cy="${centerY}" r="62" fill="#fffaf2" />
    <text x="${centerX}" y="${centerY - 6}" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="28" font-weight="700" fill="#111a2c">${escapeXml(formatMetric(preview.totalValue))}</text>
    <text x="${centerX}" y="${centerY + 22}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#5f6b7d">total</text>
    ${legend}`;
}

function buildLegendSvg(items: Array<{ label: string; color: string }>, x: number, y: number): string {
  if (items.length <= 1) {
    return "";
  }

  return items.map((item, index) => `
    <rect x="${x + index * 170}" y="${y}" width="14" height="14" rx="7" fill="${item.color}" />
    <text x="${x + 22 + index * 170}" y="${y + 12}" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#111a2c">${escapeXml(item.label)}</text>`).join("");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toFileName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "chart-preview";
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = url;
  });
}

function downloadUrl(url: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
}

