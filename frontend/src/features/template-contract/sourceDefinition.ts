import { NormalizedDataset } from "../dataset";
import { TEMPLATE_SCHEMA_VERSION, TemplateConfiguration, TemplateSourceDefinition } from "./types";

export function createTemplateSourceDefinition(dataset: NormalizedDataset): TemplateSourceDefinition {
  return {
    kind: dataset.source.kind,
    fields: dataset.fields.map((field) => ({
      key: field.key,
      label: field.label,
      sourceKey: field.sourceKey,
      kind: field.kind,
      nullable: field.nullable,
    })),
  };
}

export function createTemplateConfigurationFromDataset(dataset: NormalizedDataset): TemplateConfiguration {
  const source = createTemplateSourceDefinition(dataset);
  const categoryField = source.fields.find((field) => field.kind !== "number")?.key ?? source.fields[0]?.key ?? "";
  const numericField = source.fields.find((field) => field.kind === "number" && field.key !== categoryField)?.key
    ?? source.fields.find((field) => field.kind === "number")?.key
    ?? source.fields.find((field) => field.key !== categoryField)?.key
    ?? source.fields[0]?.key
    ?? "";
  const secondaryField = source.fields.find((field) => field.key !== categoryField && field.key !== numericField)?.key ?? null;

  return {
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    source,
    transforms: [],
    chart: {
      chartType: "bar",
      xField: categoryField,
      yField: numericField,
      seriesField: secondaryField,
      colorField: null,
    },
  };
}
