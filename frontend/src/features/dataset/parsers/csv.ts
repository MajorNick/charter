import { DatasetParseError } from "../errors";
import { DatasetRow, DatasetScalar, ParsedDatasetResult } from "../types";

const NUMERIC_PATTERN = /^-?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/;

export function parseCsvText(input: string): ParsedDatasetResult {
  const rows = tokenizeCsv(input.replace(/^\uFEFF/, ""));

  if (rows.length === 0 || rows.every((row) => row.every((cell) => cell.trim() === ""))) {
    throw new DatasetParseError("CSV uploads need a header row and at least one column.");
  }

  const [headerRow, ...dataRows] = rows;
  const maxColumnCount = Math.max(headerRow.length, ...dataRows.map((row) => row.length));
  const rawHeaders = Array.from({ length: maxColumnCount }, (_, index) => {
    const headerValue = headerRow[index]?.trim();
    return headerValue && headerValue.length > 0 ? headerValue : `Column ${index + 1}`;
  });
  const columns = createColumns(rawHeaders);
  const normalizedRows = dataRows
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) => createRowRecord(columns, row));

  return {
    kind: "csv",
    fieldOrder: columns.map((column) => column.key),
    rows: normalizedRows,
    sourceLabels: Object.fromEntries(columns.map((column) => [column.key, column.label])),
  };
}

function tokenizeCsv(input: string): string[][] {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let insideQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const nextCharacter = input[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentField += '"';
        index += 1;
        continue;
      }

      insideQuotes = !insideQuotes;
      continue;
    }

    if (!insideQuotes && character === ",") {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if (!insideQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentField);
      rows.push(currentRow);
      currentField = "";
      currentRow = [];
      continue;
    }

    currentField += character;
  }

  currentRow.push(currentField);
  rows.push(currentRow);

  return rows;
}

function createColumns(rawHeaders: string[]): Array<{ key: string; label: string }> {
  const seen = new Map<string, number>();

  return rawHeaders.map((header, index) => {
    const baseLabel = header.trim() || `Column ${index + 1}`;
    const occurrence = (seen.get(baseLabel) ?? 0) + 1;

    seen.set(baseLabel, occurrence);

    return {
      key: occurrence === 1 ? baseLabel : `${baseLabel} (${occurrence})`,
      label: occurrence === 1 ? baseLabel : `${baseLabel} (${occurrence})`,
    };
  });
}

function createRowRecord(columns: Array<{ key: string }>, values: string[]): DatasetRow {
  return columns.reduce<DatasetRow>((record, column, index) => {
    record[column.key] = parseCsvScalar(values[index] ?? "");
    return record;
  }, {});
}

function parseCsvScalar(value: string): DatasetScalar {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const normalizedBoolean = trimmed.toLowerCase();

  if (normalizedBoolean === "true") {
    return true;
  }

  if (normalizedBoolean === "false") {
    return false;
  }

  if (NUMERIC_PATTERN.test(trimmed)) {
    return Number(trimmed);
  }

  return value;
}
