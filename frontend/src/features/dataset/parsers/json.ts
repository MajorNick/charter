import { DatasetParseError } from "../errors";
import { DatasetRow, DatasetScalar, ParsedDatasetResult } from "../types";

export function parseJsonText(input: string): ParsedDatasetResult {
  const parsedValue = JSON.parse(input) as unknown;

  if (!Array.isArray(parsedValue)) {
    throw new DatasetParseError("Phase 1 JSON uploads must use a top-level array of objects.");
  }

  const fieldOrder: string[] = [];
  const fieldSet = new Set<string>();
  const sourceLabels: Record<string, string> = {};
  const draftRows = parsedValue.map((entry, rowIndex) => {
    if (!isPlainObject(entry)) {
      throw new DatasetParseError(
        `JSON row ${rowIndex + 1} must be an object. Nested arrays or scalar rows are not supported.`,
      );
    }

    const row: DatasetRow = {};

    Object.entries(entry).forEach(([key, value]) => {
      if (!fieldSet.has(key)) {
        fieldSet.add(key);
        fieldOrder.push(key);
        sourceLabels[key] = key;
      }

      row[key] = normalizeJsonScalar(value, rowIndex, key);
    });

    return row;
  });
  const rows = draftRows.map((row) => fillMissingFields(row, fieldOrder));

  return {
    kind: "json",
    fieldOrder,
    rows,
    sourceLabels,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeJsonScalar(value: unknown, rowIndex: number, key: string): DatasetScalar {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  throw new DatasetParseError(
    `JSON row ${rowIndex + 1}, field "${key}" must be a string, number, boolean, or null.`,
  );
}

function fillMissingFields(row: DatasetRow, fieldOrder: string[]): DatasetRow {
  return fieldOrder.reduce<DatasetRow>((record, key) => {
    record[key] = row[key] ?? null;
    return record;
  }, {});
}
