import { createDerivedDataset, DatasetRow, DatasetScalar, NormalizedDataset } from "../dataset";
import {
  AggregateDefinition,
  FilterRule,
  GroupTransformStep,
  SortDefinition,
  TemplateConfiguration,
  TransformStep,
} from "../template-contract";
import { evaluateCalculatedExpression } from "./formula";
import { TransformExecutionError, TransformExecutionResult, WorkingDataset } from "./types";

export function executeTransformPipeline(
  dataset: NormalizedDataset,
  configuration: Pick<TemplateConfiguration, "source" | "transforms">,
): TransformExecutionResult {
  assertCompatibleSource(dataset, configuration.source);

  let workingDataset: WorkingDataset = {
    rows: dataset.rows.map(cloneRow),
    fieldOrder: dataset.fields.map((field) => field.key),
    sourceLabels: Object.fromEntries(dataset.fields.map((field) => [field.key, field.label])),
  };

  const traces = configuration.transforms.map((step) => {
    workingDataset = applyTransformStep(workingDataset, step);

    return {
      stepId: step.id,
      stepType: step.type,
      rowCount: workingDataset.rows.length,
      fieldOrder: [...workingDataset.fieldOrder],
    };
  });

  return {
    dataset: createDerivedDataset(dataset.source, workingDataset.rows, workingDataset.fieldOrder, workingDataset.sourceLabels),
    traces,
  };
}

function applyTransformStep(dataset: WorkingDataset, step: TransformStep): WorkingDataset {
  switch (step.type) {
    case "filter":
      return applyFilterStep(dataset, step);
    case "group":
      return applyGroupStep(dataset, step);
    case "sort":
      return applySortStep(dataset, step.rules, step.id);
    case "calculate":
      return applyCalculatedFieldStep(dataset, step.outputField, step.expression);
    case "select":
      return applySelectStep(dataset, step.id, step.fields);
    case "rename":
      return applyRenameStep(dataset, step.id, step.mappings);
  }
}

function assertCompatibleSource(dataset: NormalizedDataset, source: TemplateConfiguration["source"]): void {
  if (dataset.source.kind !== source.kind) {
    throw new TransformExecutionError(
      `Template expects a ${source.kind.toUpperCase()} source but received ${dataset.source.kind.toUpperCase()}.`,
    );
  }

  const datasetFields = new Set(dataset.fields.map((field) => field.key));

  source.fields.forEach((field) => {
    if (!datasetFields.has(field.key)) {
      throw new TransformExecutionError(`Dataset is missing expected source field: ${field.key}`);
    }
  });
}

function applyFilterStep(dataset: WorkingDataset, step: Extract<TransformStep, { type: "filter" }>): WorkingDataset {
  assertKnownFields(
    dataset,
    step.rules.map((rule) => rule.field),
    step.id,
  );

  return {
    ...dataset,
    rows: dataset.rows.filter((row) => evaluateFilterRules(row, step.rules, step.combinator)),
  };
}

function applyGroupStep(dataset: WorkingDataset, step: GroupTransformStep): WorkingDataset {
  assertKnownFields(dataset, step.groupBy, step.id);
  step.aggregates.forEach((aggregate) => {
    if (aggregate.field) {
      assertKnownFields(dataset, [aggregate.field], step.id);
    }
  });

  const groupedRows = new Map<string, DatasetRow[]>();

  dataset.rows.forEach((row) => {
    const groupKey = JSON.stringify(step.groupBy.map((field) => row[field] ?? null));
    const rows = groupedRows.get(groupKey) ?? [];
    rows.push(row);
    groupedRows.set(groupKey, rows);
  });

  const nextRows = Array.from(groupedRows.values()).map((rows) => {
    const baseRow: DatasetRow = {};

    step.groupBy.forEach((field) => {
      baseRow[field] = rows[0]?.[field] ?? null;
    });

    step.aggregates.forEach((aggregate) => {
      baseRow[aggregate.as] = computeAggregate(rows, aggregate);
    });

    return baseRow;
  });

  const fieldOrder = [...step.groupBy, ...step.aggregates.map((aggregate) => aggregate.as)];

  if (new Set(fieldOrder).size !== fieldOrder.length) {
    throw new TransformExecutionError("Group step would produce duplicate field names.", step.id);
  }

  const sourceLabels = {
    ...Object.fromEntries(step.groupBy.map((field) => [field, dataset.sourceLabels[field] ?? field])),
    ...Object.fromEntries(step.aggregates.map((aggregate) => [aggregate.as, aggregate.as])),
  };

  return {
    rows: nextRows,
    fieldOrder,
    sourceLabels,
  };
}

function applySortStep(dataset: WorkingDataset, rules: SortDefinition[], stepId: string): WorkingDataset {
  assertKnownFields(dataset, rules.map((rule) => rule.field), stepId);

  const rows = [...dataset.rows].sort((left, right) => {
    for (const rule of rules) {
      const comparison = compareForSort(left[rule.field] ?? null, right[rule.field] ?? null);

      if (comparison !== 0) {
        return rule.direction === "asc" ? comparison : comparison * -1;
      }
    }

    return 0;
  });

  return {
    ...dataset,
    rows,
  };
}

function applyCalculatedFieldStep(dataset: WorkingDataset, outputField: string, expression: string): WorkingDataset {
  const rows = dataset.rows.map((row) => ({
    ...row,
    [outputField]: evaluateCalculatedExpression(expression, row),
  }));

  const fieldOrder = dataset.fieldOrder.includes(outputField)
    ? [...dataset.fieldOrder]
    : [...dataset.fieldOrder, outputField];

  return {
    rows,
    fieldOrder,
    sourceLabels: {
      ...dataset.sourceLabels,
      [outputField]: dataset.sourceLabels[outputField] ?? outputField,
    },
  };
}

function applySelectStep(dataset: WorkingDataset, stepId: string, fields: string[]): WorkingDataset {
  assertKnownFields(dataset, fields, stepId);

  const fieldSet = new Set(fields);
  const orderedFields = dataset.fieldOrder.filter((field) => fieldSet.has(field));
  const rows = dataset.rows.map((row) => {
    const nextRow: DatasetRow = {};

    orderedFields.forEach((field) => {
      nextRow[field] = row[field] ?? null;
    });

    return nextRow;
  });

  return {
    rows,
    fieldOrder: orderedFields,
    sourceLabels: Object.fromEntries(orderedFields.map((field) => [field, dataset.sourceLabels[field] ?? field])),
  };
}

function applyRenameStep(
  dataset: WorkingDataset,
  stepId: string,
  mappings: Array<{ from: string; to: string }>,
): WorkingDataset {
  assertKnownFields(dataset, mappings.map((mapping) => mapping.from), stepId);

  const renameMap = new Map(mappings.map((mapping) => [mapping.from, mapping.to]));
  const nextFieldOrder = dataset.fieldOrder.map((field) => renameMap.get(field) ?? field);

  if (new Set(nextFieldOrder).size !== nextFieldOrder.length) {
    throw new TransformExecutionError("Rename step would produce duplicate field names.", stepId);
  }

  const rows = dataset.rows.map((row) => {
    const nextRow: DatasetRow = {};

    dataset.fieldOrder.forEach((field) => {
      const nextField = renameMap.get(field) ?? field;
      nextRow[nextField] = row[field] ?? null;
    });

    return nextRow;
  });

  return {
    rows,
    fieldOrder: nextFieldOrder,
    sourceLabels: Object.fromEntries(
      nextFieldOrder.map((field) => {
        const originalField = mappings.find((mapping) => mapping.to === field)?.from ?? field;
        return [field, field || dataset.sourceLabels[originalField] || originalField];
      }),
    ),
  };
}

function computeAggregate(rows: DatasetRow[], aggregate: AggregateDefinition): DatasetScalar {
  switch (aggregate.operation) {
    case "count":
      if (!aggregate.field) {
        return rows.length;
      }
      return rows.filter((row) => row[aggregate.field!] !== null && row[aggregate.field!] !== undefined).length;
    case "sum":
      return reduceNumbers(rows, aggregate.field, 0, (total, value) => total + value);
    case "average": {
      const values = collectNumericValues(rows, aggregate.field);
      if (values.length === 0) {
        return null;
      }
      return values.reduce((total, value) => total + value, 0) / values.length;
    }
    case "min": {
      const values = collectNumericValues(rows, aggregate.field);
      return values.length > 0 ? Math.min(...values) : null;
    }
    case "max": {
      const values = collectNumericValues(rows, aggregate.field);
      return values.length > 0 ? Math.max(...values) : null;
    }
  }
}

function reduceNumbers(
  rows: DatasetRow[],
  field: string | undefined,
  initialValue: number,
  reducer: (total: number, value: number) => number,
): DatasetScalar {
  const values = collectNumericValues(rows, field);

  if (values.length === 0) {
    return null;
  }

  return values.reduce(reducer, initialValue);
}

function collectNumericValues(rows: DatasetRow[], field: string | undefined): number[] {
  if (!field) {
    return [];
  }

  return rows
    .map((row) => row[field])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function evaluateFilterRules(row: DatasetRow, rules: FilterRule[], combinator: "and" | "or"): boolean {
  if (rules.length === 0) {
    return true;
  }

  const results = rules.map((rule) => evaluateFilterRule(row, rule));
  return combinator === "and" ? results.every(Boolean) : results.some(Boolean);
}

function evaluateFilterRule(row: DatasetRow, rule: FilterRule): boolean {
  const value = row[rule.field] ?? null;

  switch (rule.operator) {
    case "equals":
      return value === normalizeRuleValue(rule.value);
    case "notEquals":
      return value !== normalizeRuleValue(rule.value);
    case "greaterThan":
      return compareNumbers(value, rule.value, (left, right) => left > right);
    case "greaterThanOrEqual":
      return compareNumbers(value, rule.value, (left, right) => left >= right);
    case "lessThan":
      return compareNumbers(value, rule.value, (left, right) => left < right);
    case "lessThanOrEqual":
      return compareNumbers(value, rule.value, (left, right) => left <= right);
    case "contains":
      return typeof value === "string" && typeof rule.value === "string" ? value.includes(rule.value) : false;
    case "notContains":
      return typeof value === "string" && typeof rule.value === "string" ? !value.includes(rule.value) : true;
    case "isNull":
      return value === null;
    case "isNotNull":
      return value !== null;
    case "in":
      return Array.isArray(rule.value) ? rule.value.includes(value) : false;
  }
}

function normalizeRuleValue(value: FilterRule["value"]): DatasetScalar {
  return Array.isArray(value) ? null : value ?? null;
}

function compareNumbers(
  left: DatasetScalar,
  right: FilterRule["value"],
  comparator: (left: number, right: number) => boolean,
): boolean {
  return typeof left === "number" && typeof right === "number" ? comparator(left, right) : false;
}

function compareForSort(left: DatasetScalar, right: DatasetScalar): number {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }

  return String(left).localeCompare(String(right));
}

function assertKnownFields(dataset: WorkingDataset, fields: string[], stepId: string): void {
  const availableFields = new Set(dataset.fieldOrder);

  fields.forEach((field) => {
    if (!availableFields.has(field)) {
      throw new TransformExecutionError(`Unknown field referenced in transform step: ${field}`, stepId);
    }
  });
}

function cloneRow(row: DatasetRow): DatasetRow {
  return { ...row };
}
