import { DatasetField, DatasetScalar, NormalizedDataset } from "../dataset";
import { ChartMapping, TemplateChartType } from "../template-contract";

const COLOR_PALETTE = ["#D97B29", "#2B6CB0", "#2F855A", "#C05621", "#805AD5", "#0F766E", "#B83280", "#718096"];

export interface CartesianChartPoint {
  categoryKey: string;
  categoryLabel: string;
  seriesKey: string;
  seriesLabel: string;
  colorKey: string;
  color: string;
  value: number;
}

export interface PieChartSlice {
  label: string;
  value: number;
  percent: number;
  colorKey: string;
  color: string;
}

interface BaseChartPreviewResult {
  chartType: TemplateChartType;
  title: string;
  issue: string | null;
}

export interface CartesianChartPreviewResult extends BaseChartPreviewResult {
  chartType: "bar" | "line";
  xField: string;
  yField: string;
  categories: string[];
  series: string[];
  points: CartesianChartPoint[];
  maxValue: number;
}

export interface PieChartPreviewResult extends BaseChartPreviewResult {
  chartType: "pie";
  labelField: string;
  valueField: string;
  slices: PieChartSlice[];
  totalValue: number;
}

export type ChartPreviewResult = CartesianChartPreviewResult | PieChartPreviewResult;

export function createChartMappingForType(
  chartType: TemplateChartType,
  fields: DatasetField[],
  title?: string,
): ChartMapping {
  const categoryField = pickCategoryField(fields);
  const numericField = pickNumericField(fields, categoryField);
  const secondaryField = pickSecondaryField(fields, [categoryField, numericField]);

  if (chartType === "pie") {
    return {
      chartType,
      title,
      labelField: categoryField,
      valueField: numericField,
      colorField: secondaryField,
    };
  }

  return {
    chartType,
    title,
    xField: categoryField,
    yField: numericField,
    seriesField: secondaryField,
    colorField: null,
  };
}

export function sanitizeChartMapping(mapping: ChartMapping, fields: DatasetField[]): ChartMapping {
  const nextDefaults = createChartMappingForType(mapping.chartType, fields, mapping.title);
  const fieldKeys = new Set(fields.map((field) => field.key));
  const numericFieldKeys = new Set(fields.filter((field) => field.kind === "number").map((field) => field.key));

  const pickOptionalField = (value: string | null | undefined, fallback: string | null | undefined) => {
    if (value && fieldKeys.has(value)) {
      return value;
    }

    if (fallback && fieldKeys.has(fallback)) {
      return fallback;
    }

    return null;
  };

  const pickValueField = (value: string, fallback: string) => {
    if (numericFieldKeys.has(value)) {
      return value;
    }

    if (numericFieldKeys.has(fallback)) {
      return fallback;
    }

    if (fieldKeys.has(value)) {
      return value;
    }

    if (fieldKeys.has(fallback)) {
      return fallback;
    }

    return fallback;
  };

  if (mapping.chartType === "pie" && nextDefaults.chartType === "pie") {
    return {
      ...mapping,
      labelField: fieldKeys.has(mapping.labelField) ? mapping.labelField : nextDefaults.labelField,
      valueField: pickValueField(mapping.valueField, nextDefaults.valueField),
      colorField: pickOptionalField(mapping.colorField, nextDefaults.colorField),
    };
  }

  if (mapping.chartType !== "pie" && nextDefaults.chartType !== "pie") {
    return {
      ...mapping,
      xField: fieldKeys.has(mapping.xField) ? mapping.xField : nextDefaults.xField,
      yField: pickValueField(mapping.yField, nextDefaults.yField),
      seriesField: pickOptionalField(mapping.seriesField, nextDefaults.seriesField),
      colorField: pickOptionalField(mapping.colorField, nextDefaults.colorField),
    };
  }

  return nextDefaults;
}

export function buildChartPreview(dataset: NormalizedDataset, mapping: ChartMapping): ChartPreviewResult {
  return mapping.chartType === "pie"
    ? buildPieChartPreview(dataset, mapping)
    : buildCartesianChartPreview(dataset, mapping);
}

function buildCartesianChartPreview(
  dataset: NormalizedDataset,
  mapping: Extract<ChartMapping, { chartType: "bar" | "line" }>,
): CartesianChartPreviewResult {
  const xField = getField(dataset.fields, mapping.xField);
  const yField = getField(dataset.fields, mapping.yField);

  if (!xField) {
    return createCartesianIssue(mapping, `Chart field is missing from preview dataset: ${mapping.xField}`);
  }

  if (!yField) {
    return createCartesianIssue(mapping, `Chart field is missing from preview dataset: ${mapping.yField}`);
  }

  const seriesField = mapping.seriesField ? getField(dataset.fields, mapping.seriesField) : null;
  const colorField = mapping.colorField ? getField(dataset.fields, mapping.colorField) : null;

  if (mapping.seriesField && !seriesField) {
    return createCartesianIssue(mapping, `Series field is missing from preview dataset: ${mapping.seriesField}`);
  }

  if (mapping.colorField && !colorField) {
    return createCartesianIssue(mapping, `Color field is missing from preview dataset: ${mapping.colorField}`);
  }

  const categoryOrder: string[] = [];
  const seriesOrder: string[] = [];
  const colorKeys: string[] = [];
  const bucketMap = new Map<string, CartesianChartPoint>();

  dataset.rows.forEach((row) => {
    const rawValue = row[mapping.yField];

    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      return;
    }

    const categoryLabel = toLabel(row[mapping.xField], "Unlabeled");
    const seriesLabel = seriesField ? toLabel(row[mapping.seriesField!], "Series") : getFieldLabel(yField, mapping.yField);
    const colorKey = colorField
      ? toLabel(row[mapping.colorField!], seriesLabel)
      : seriesField
        ? seriesLabel
        : categoryLabel;

    if (!categoryOrder.includes(categoryLabel)) {
      categoryOrder.push(categoryLabel);
    }

    if (!seriesOrder.includes(seriesLabel)) {
      seriesOrder.push(seriesLabel);
    }

    if (!colorKeys.includes(colorKey)) {
      colorKeys.push(colorKey);
    }

    const bucketKey = `${categoryLabel}::${seriesLabel}::${colorKey}`;
    const existing = bucketMap.get(bucketKey);

    if (existing) {
      existing.value += rawValue;
      return;
    }

    bucketMap.set(bucketKey, {
      categoryKey: categoryLabel,
      categoryLabel,
      seriesKey: seriesLabel,
      seriesLabel,
      colorKey,
      color: "",
      value: rawValue,
    });
  });

  if (bucketMap.size === 0) {
    return createCartesianIssue(mapping, `No numeric values are available for ${getFieldLabel(yField, mapping.yField)}.`);
  }

  const colorMap = new Map<string, string>();
  colorKeys.forEach((key, index) => {
    colorMap.set(key, COLOR_PALETTE[index % COLOR_PALETTE.length]);
  });

  const points = Array.from(bucketMap.values()).map((point) => ({
    ...point,
    color: colorMap.get(point.colorKey) ?? COLOR_PALETTE[0],
  }));

  return {
    chartType: mapping.chartType,
    title: mapping.title?.trim() || `${getFieldLabel(yField, mapping.yField)} by ${getFieldLabel(xField, mapping.xField)}`,
    issue: null,
    xField: mapping.xField,
    yField: mapping.yField,
    categories: categoryOrder,
    series: seriesOrder,
    points,
    maxValue: Math.max(...points.map((point) => point.value)),
  };
}

function buildPieChartPreview(
  dataset: NormalizedDataset,
  mapping: Extract<ChartMapping, { chartType: "pie" }>,
): PieChartPreviewResult {
  const labelField = getField(dataset.fields, mapping.labelField);
  const valueField = getField(dataset.fields, mapping.valueField);

  if (!labelField) {
    return createPieIssue(mapping, `Chart field is missing from preview dataset: ${mapping.labelField}`);
  }

  if (!valueField) {
    return createPieIssue(mapping, `Chart field is missing from preview dataset: ${mapping.valueField}`);
  }

  const colorField = mapping.colorField ? getField(dataset.fields, mapping.colorField) : null;

  if (mapping.colorField && !colorField) {
    return createPieIssue(mapping, `Color field is missing from preview dataset: ${mapping.colorField}`);
  }

  const sliceMap = new Map<string, { label: string; value: number; colorKey: string }>();
  const colorKeys: string[] = [];

  dataset.rows.forEach((row) => {
    const rawValue = row[mapping.valueField];

    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      return;
    }

    const label = toLabel(row[mapping.labelField], "Unlabeled");
    const colorKey = colorField ? toLabel(row[mapping.colorField!], label) : label;
    const existing = sliceMap.get(label);

    if (!colorKeys.includes(colorKey)) {
      colorKeys.push(colorKey);
    }

    if (existing) {
      existing.value += rawValue;
      return;
    }

    sliceMap.set(label, { label, value: rawValue, colorKey });
  });

  if (sliceMap.size === 0) {
    return createPieIssue(mapping, `No numeric values are available for ${getFieldLabel(valueField, mapping.valueField)}.`);
  }

  const colorMap = new Map<string, string>();
  colorKeys.forEach((key, index) => {
    colorMap.set(key, COLOR_PALETTE[index % COLOR_PALETTE.length]);
  });

  const totalValue = Array.from(sliceMap.values()).reduce((sum, slice) => sum + slice.value, 0);
  const slices = Array.from(sliceMap.values()).map((slice) => ({
    label: slice.label,
    value: slice.value,
    percent: totalValue === 0 ? 0 : slice.value / totalValue,
    colorKey: slice.colorKey,
    color: colorMap.get(slice.colorKey) ?? COLOR_PALETTE[0],
  }));

  return {
    chartType: "pie",
    title: mapping.title?.trim() || `${getFieldLabel(valueField, mapping.valueField)} share by ${getFieldLabel(labelField, mapping.labelField)}`,
    issue: null,
    labelField: mapping.labelField,
    valueField: mapping.valueField,
    slices,
    totalValue,
  };
}

function createCartesianIssue(
  mapping: Extract<ChartMapping, { chartType: "bar" | "line" }>,
  message: string,
): CartesianChartPreviewResult {
  return {
    chartType: mapping.chartType,
    title: mapping.title?.trim() || "Chart preview",
    issue: message,
    xField: mapping.xField,
    yField: mapping.yField,
    categories: [],
    series: [],
    points: [],
    maxValue: 0,
  };
}

function createPieIssue(
  mapping: Extract<ChartMapping, { chartType: "pie" }>,
  message: string,
): PieChartPreviewResult {
  return {
    chartType: "pie",
    title: mapping.title?.trim() || "Chart preview",
    issue: message,
    labelField: mapping.labelField,
    valueField: mapping.valueField,
    slices: [],
    totalValue: 0,
  };
}

function getField(fields: DatasetField[], key: string): DatasetField | undefined {
  return fields.find((field) => field.key === key);
}

function getFieldLabel(field: DatasetField | undefined, fallbackKey: string): string {
  return field?.label || fallbackKey;
}

function pickCategoryField(fields: DatasetField[]): string {
  return fields.find((field) => field.kind !== "number")?.key ?? fields[0]?.key ?? "";
}

function pickNumericField(fields: DatasetField[], categoryField: string): string {
  return fields.find((field) => field.kind === "number" && field.key !== categoryField)?.key
    ?? fields.find((field) => field.kind === "number")?.key
    ?? fields.find((field) => field.key !== categoryField)?.key
    ?? fields[0]?.key
    ?? "";
}

function pickSecondaryField(fields: DatasetField[], excludedFields: string[]): string | null {
  const excluded = new Set(excludedFields.filter(Boolean));
  return fields.find((field) => !excluded.has(field.key))?.key ?? null;
}

function toLabel(value: DatasetScalar | undefined, fallback: string): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "string") {
    return value.trim() || fallback;
  }

  return String(value);
}
