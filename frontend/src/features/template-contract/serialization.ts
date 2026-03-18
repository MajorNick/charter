import {
  AggregateDefinition,
  ChartMapping,
  CloneTemplateRequest,
  CreateTemplateRequest,
  FieldRenameMapping,
  FilterRule,
  PersistedTemplate,
  SortDefinition,
  TemplateChartType,
  TemplateConfiguration,
  TemplateFieldKind,
  TemplateResponseEnvelope,
  TEMPLATE_SCHEMA_VERSION,
  TransformStep,
  UpdateTemplateRequest,
} from "./types";

export function serializeTemplateConfiguration(configuration: TemplateConfiguration): string {
  return JSON.stringify(configuration);
}

export function parseTemplateConfiguration(input: string | unknown): TemplateConfiguration {
  const value = parseUnknownInput(input, "template configuration");
  return readTemplateConfiguration(value);
}

export function serializeCreateTemplateRequest(request: CreateTemplateRequest): string {
  return JSON.stringify(request);
}

export function parseCreateTemplateRequest(input: string | unknown): CreateTemplateRequest {
  const value = parseUnknownInput(input, "create template request");
  return readTemplateDraft(value, "create template request");
}

export function serializeUpdateTemplateRequest(request: UpdateTemplateRequest): string {
  return JSON.stringify(request);
}

export function parseUpdateTemplateRequest(input: string | unknown): UpdateTemplateRequest {
  const value = parseUnknownInput(input, "update template request");
  return readTemplateDraft(value, "update template request");
}

export function serializeCloneTemplateRequest(request: CloneTemplateRequest): string {
  return JSON.stringify(request);
}

export function parseCloneTemplateRequest(input: string | unknown): CloneTemplateRequest {
  const value = parseUnknownInput(input, "clone template request");

  return {
    name: readOptionalString(value.name, "clone template name"),
    description: readOptionalNullableString(value.description, "clone template description"),
  };
}

export function parseTemplateResponseEnvelope(input: string | unknown): TemplateResponseEnvelope {
  const value = parseUnknownInput(input, "template response envelope");

  return {
    template: readPersistedTemplate(readRecord(value.template, "template response envelope.template")),
  };
}

function parseUnknownInput(input: string | unknown, label: string): Record<string, unknown> {
  if (typeof input === "string") {
    return readRecord(JSON.parse(input) as unknown, label);
  }

  return readRecord(input, label);
}

function readTemplateDraft(value: Record<string, unknown>, label: string): CreateTemplateRequest {
  return {
    name: readString(value.name, `${label}.name`),
    description: readNullableString(value.description, `${label}.description`),
    config: readTemplateConfiguration(readRecord(value.config, `${label}.config`)),
  };
}

function readPersistedTemplate(value: Record<string, unknown>): PersistedTemplate {
  return {
    id: readString(value.id, "template.id"),
    name: readString(value.name, "template.name"),
    description: readNullableString(value.description, "template.description"),
    config: readTemplateConfiguration(readRecord(value.config, "template.config")),
    createdAt: readString(value.createdAt, "template.createdAt"),
    updatedAt: readString(value.updatedAt, "template.updatedAt"),
  };
}

function readTemplateConfiguration(value: Record<string, unknown>): TemplateConfiguration {
  return {
    schemaVersion: readSchemaVersion(value.schemaVersion),
    source: readSourceDefinition(readRecord(value.source, "template configuration.source")),
    transforms: readTransformSteps(value.transforms),
    chart: readChartMapping(readRecord(value.chart, "template configuration.chart")),
  };
}

function readSourceDefinition(value: Record<string, unknown>): TemplateConfiguration["source"] {
  const kind = readString(value.kind, "template source kind");

  if (kind !== "csv" && kind !== "json") {
    throw new Error(`Unsupported template source kind: ${kind}`);
  }

  return {
    kind,
    fields: readArray(value.fields, "template source fields").map((entry, index) => {
      const field = readRecord(entry, `template source fields[${index}]`);
      return {
        key: readString(field.key, `template source fields[${index}].key`),
        label: readString(field.label, `template source fields[${index}].label`),
        sourceKey: readString(field.sourceKey, `template source fields[${index}].sourceKey`),
        kind: readTemplateFieldKind(field.kind, `template source fields[${index}].kind`),
        nullable: readBoolean(field.nullable, `template source fields[${index}].nullable`),
      };
    }),
  };
}

function readTransformSteps(value: unknown): TransformStep[] {
  return readArray(value, "template transforms").map((entry, index) => {
    const step = readRecord(entry, `template transforms[${index}]`);
    const type = readString(step.type, `template transforms[${index}].type`);
    const id = readString(step.id, `template transforms[${index}].id`);
    const label = readString(step.label, `template transforms[${index}].label`);

    switch (type) {
      case "filter": {
        const combinator = readString(step.combinator, `template transforms[${index}].combinator`);

        if (combinator !== "and" && combinator !== "or") {
          throw new Error(`Unsupported filter combinator: ${combinator}`);
        }

        return {
          id,
          label,
          type,
          combinator,
          rules: readFilterRules(step.rules, index),
        };
      }
      case "group":
        return {
          id,
          label,
          type,
          groupBy: readStringArray(step.groupBy, `template transforms[${index}].groupBy`),
          aggregates: readAggregateDefinitions(step.aggregates, index),
        };
      case "sort":
        return {
          id,
          label,
          type,
          rules: readSortDefinitions(step.rules, index),
        };
      case "calculate": {
        const outputKind = readString(step.outputKind, `template transforms[${index}].outputKind`);

        if (outputKind !== "string" && outputKind !== "number" && outputKind !== "boolean") {
          throw new Error(`Unsupported calculated field output kind: ${outputKind}`);
        }

        return {
          id,
          label,
          type,
          outputField: readString(step.outputField, `template transforms[${index}].outputField`),
          expression: readString(step.expression, `template transforms[${index}].expression`),
          outputKind,
        };
      }
      case "select":
        return {
          id,
          label,
          type,
          fields: readStringArray(step.fields, `template transforms[${index}].fields`),
        };
      case "rename":
        return {
          id,
          label,
          type,
          mappings: readFieldRenameMappings(step.mappings, index),
        };
      default:
        throw new Error(`Unsupported transform step type: ${type}`);
    }
  });
}

function readChartMapping(value: Record<string, unknown>): ChartMapping {
  const chartType = readString(value.chartType, "template chart type");
  const title = readOptionalString(value.title, "template chart title");

  if (!isChartType(chartType)) {
    throw new Error(`Unsupported chart type: ${chartType}`);
  }

  if (chartType === "pie") {
    return {
      chartType,
      title,
      labelField: readString(value.labelField, "template pie labelField"),
      valueField: readString(value.valueField, "template pie valueField"),
      colorField: readOptionalNullableString(value.colorField, "template pie colorField") ?? null,
    };
  }

  return {
    chartType,
    title,
    xField: readString(value.xField, "template chart xField"),
    yField: readString(value.yField, "template chart yField"),
    seriesField: readOptionalNullableString(value.seriesField, "template chart seriesField") ?? null,
    colorField: readOptionalNullableString(value.colorField, "template chart colorField") ?? null,
  };
}

function readFilterRules(value: unknown, stepIndex: number): FilterRule[] {
  return readArray(value, `template transforms[${stepIndex}].rules`).map((entry, ruleIndex) => {
    const rule = readRecord(entry, `template transforms[${stepIndex}].rules[${ruleIndex}]`);
    return {
      field: readString(rule.field, `template transforms[${stepIndex}].rules[${ruleIndex}].field`),
      operator: readString(rule.operator, `template transforms[${stepIndex}].rules[${ruleIndex}].operator`) as FilterRule["operator"],
      value: rule.value as FilterRule["value"],
    };
  });
}

function readAggregateDefinitions(value: unknown, stepIndex: number): AggregateDefinition[] {
  return readArray(value, `template transforms[${stepIndex}].aggregates`).map((entry, aggregateIndex) => {
    const aggregate = readRecord(entry, `template transforms[${stepIndex}].aggregates[${aggregateIndex}]`);
    return {
      field: readOptionalString(aggregate.field, `template transforms[${stepIndex}].aggregates[${aggregateIndex}].field`),
      operation: readString(aggregate.operation, `template transforms[${stepIndex}].aggregates[${aggregateIndex}].operation`) as AggregateDefinition["operation"],
      as: readString(aggregate.as, `template transforms[${stepIndex}].aggregates[${aggregateIndex}].as`),
    };
  });
}

function readSortDefinitions(value: unknown, stepIndex: number): SortDefinition[] {
  return readArray(value, `template transforms[${stepIndex}].rules`).map((entry, sortIndex) => {
    const sort = readRecord(entry, `template transforms[${stepIndex}].rules[${sortIndex}]`);
    const direction = readString(sort.direction, `template transforms[${stepIndex}].rules[${sortIndex}].direction`);

    if (direction !== "asc" && direction !== "desc") {
      throw new Error(`Unsupported sort direction: ${direction}`);
    }

    return {
      field: readString(sort.field, `template transforms[${stepIndex}].rules[${sortIndex}].field`),
      direction,
    };
  });
}

function readFieldRenameMappings(value: unknown, stepIndex: number): FieldRenameMapping[] {
  return readArray(value, `template transforms[${stepIndex}].mappings`).map((entry, mappingIndex) => {
    const mapping = readRecord(entry, `template transforms[${stepIndex}].mappings[${mappingIndex}]`);
    return {
      from: readString(mapping.from, `template transforms[${stepIndex}].mappings[${mappingIndex}].from`),
      to: readString(mapping.to, `template transforms[${stepIndex}].mappings[${mappingIndex}].to`),
    };
  });
}

function readTemplateFieldKind(value: unknown, label: string): TemplateFieldKind {
  const kind = readString(value, label);

  if (kind !== "string" && kind !== "number" && kind !== "boolean" && kind !== "null" && kind !== "mixed") {
    throw new Error(`Unsupported template field kind: ${kind}`);
  }

  return kind;
}

function readSchemaVersion(value: unknown): typeof TEMPLATE_SCHEMA_VERSION {
  if (value !== TEMPLATE_SCHEMA_VERSION) {
    throw new Error(`Unsupported template schema version: ${String(value)}`);
  }

  return TEMPLATE_SCHEMA_VERSION;
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function readArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value;
}

function readStringArray(value: unknown, label: string): string[] {
  return readArray(value, label).map((entry, index) => readString(entry, `${label}[${index}]`));
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }

  return value;
}

function readOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readString(value, label);
}

function readNullableString(value: unknown, label: string): string | null {
  if (value === null) {
    return null;
  }

  return readString(value, label);
}

function readOptionalNullableString(value: unknown, label: string): string | null | undefined {
  if (value === undefined || value === null) {
    return value as null | undefined;
  }

  return readString(value, label);
}

function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }

  return value;
}

function isChartType(value: string): value is TemplateChartType {
  return value === "bar" || value === "line" || value === "pie";
}
