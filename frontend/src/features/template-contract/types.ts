import { DatasetFieldKind, DatasetScalar, DatasetSourceKind } from "../dataset";

export const TEMPLATE_SCHEMA_VERSION = 1 as const;

export type TemplateSchemaVersion = typeof TEMPLATE_SCHEMA_VERSION;

export type TemplateChartType = "bar" | "line" | "pie";

export type TemplateFieldKind = DatasetFieldKind;

export interface TemplateSourceField {
  key: string;
  label: string;
  sourceKey: string;
  kind: TemplateFieldKind;
  nullable: boolean;
}

export interface TemplateSourceDefinition {
  kind: DatasetSourceKind;
  fields: TemplateSourceField[];
}

export type FilterOperator =
  | "equals"
  | "notEquals"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "contains"
  | "notContains"
  | "isNull"
  | "isNotNull"
  | "in";

export interface FilterRule {
  field: string;
  operator: FilterOperator;
  value?: DatasetScalar | DatasetScalar[];
}

export interface AggregateDefinition {
  field?: string;
  operation: "count" | "sum" | "average" | "min" | "max";
  as: string;
}

export interface SortDefinition {
  field: string;
  direction: "asc" | "desc";
}

export interface FieldRenameMapping {
  from: string;
  to: string;
}

export interface BaseTransformStep {
  id: string;
  label: string;
}

export interface FilterTransformStep extends BaseTransformStep {
  type: "filter";
  combinator: "and" | "or";
  rules: FilterRule[];
}

export interface GroupTransformStep extends BaseTransformStep {
  type: "group";
  groupBy: string[];
  aggregates: AggregateDefinition[];
}

export interface SortTransformStep extends BaseTransformStep {
  type: "sort";
  rules: SortDefinition[];
}

export interface CalculatedFieldTransformStep extends BaseTransformStep {
  type: "calculate";
  outputField: string;
  expression: string;
  outputKind: "string" | "number" | "boolean";
}

export interface SelectTransformStep extends BaseTransformStep {
  type: "select";
  fields: string[];
}

export interface RenameFieldTransformStep extends BaseTransformStep {
  type: "rename";
  mappings: FieldRenameMapping[];
}

export type TransformStep =
  | FilterTransformStep
  | GroupTransformStep
  | SortTransformStep
  | CalculatedFieldTransformStep
  | SelectTransformStep
  | RenameFieldTransformStep;

export interface BarChartMapping {
  chartType: "bar";
  title?: string;
  xField: string;
  yField: string;
  seriesField?: string | null;
  colorField?: string | null;
}

export interface LineChartMapping {
  chartType: "line";
  title?: string;
  xField: string;
  yField: string;
  seriesField?: string | null;
  colorField?: string | null;
}

export interface PieChartMapping {
  chartType: "pie";
  title?: string;
  labelField: string;
  valueField: string;
  colorField?: string | null;
}

export type ChartMapping = BarChartMapping | LineChartMapping | PieChartMapping;

export interface TemplateConfiguration {
  schemaVersion: TemplateSchemaVersion;
  source: TemplateSourceDefinition;
  transforms: TransformStep[];
  chart: ChartMapping;
}

export interface TemplateDraft {
  name: string;
  description: string | null;
  config: TemplateConfiguration;
}

export interface PersistedTemplate extends TemplateDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateRequest extends TemplateDraft {}

export interface UpdateTemplateRequest extends TemplateDraft {}

export interface CloneTemplateRequest {
  name?: string;
  description?: string | null;
}

export interface TemplateResponseEnvelope {
  template: PersistedTemplate;
}
