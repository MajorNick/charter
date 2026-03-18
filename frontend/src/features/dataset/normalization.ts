import { DatasetField, DatasetFieldKind, DatasetRow, DatasetScalar, NormalizedDataset, ParsedDatasetResult } from "./types";

const SAMPLE_ROW_LIMIT = 5;
const SAMPLE_VALUE_LIMIT = 3;

export function createNormalizedDataset(
  file: File,
  parsedDataset: ParsedDatasetResult,
): NormalizedDataset {
  return createDatasetFromRows(
    {
      kind: parsedDataset.kind,
      fileName: file.name,
      fileSize: file.size,
      importedAt: new Date().toISOString(),
    },
    parsedDataset.rows,
    parsedDataset.fieldOrder,
    parsedDataset.sourceLabels,
  );
}

export function createDerivedDataset(
  source: Pick<NormalizedDataset["source"], "kind" | "fileName" | "fileSize" | "importedAt">,
  rows: DatasetRow[],
  fieldOrder: string[],
  sourceLabels: Record<string, string> = {},
): NormalizedDataset {
  return createDatasetFromRows(source, rows, fieldOrder, sourceLabels);
}

export function inferFieldKind(values: DatasetScalar[]): DatasetFieldKind {
  const observedKinds = new Set<DatasetFieldKind>();

  values.forEach((value) => {
    if (value === null) {
      return;
    }

    observedKinds.add(typeof value as Exclude<DatasetFieldKind, "mixed" | "null">);
  });

  if (observedKinds.size === 0) {
    return "null";
  }

  if (observedKinds.size === 1) {
    return Array.from(observedKinds)[0];
  }

  return "mixed";
}

function createDatasetFromRows(
  source: Pick<NormalizedDataset["source"], "kind" | "fileName" | "fileSize" | "importedAt">,
  rows: DatasetRow[],
  fieldOrder: string[],
  sourceLabels: Record<string, string>,
): NormalizedDataset {
  const fields = fieldOrder.map((key) => createFieldDefinition(key, rows, sourceLabels));

  return {
    source: {
      ...source,
      rowCount: rows.length,
    },
    fields,
    rows,
    sampleRows: rows.slice(0, SAMPLE_ROW_LIMIT),
  };
}

function createFieldDefinition(
  key: string,
  rows: DatasetRow[],
  sourceLabels: Record<string, string>,
): DatasetField {
  const values = rows.map((row) => row[key] ?? null);

  return {
    key,
    label: sourceLabels[key] ?? key,
    sourceKey: sourceLabels[key] ?? key,
    kind: inferFieldKind(values),
    nullable: values.some((value) => value === null),
    valuesPresent: values.filter((value) => value !== null).length,
    sampleValues: collectSampleValues(values),
  };
}

function collectSampleValues(values: DatasetScalar[]): DatasetScalar[] {
  const seen = new Set<string>();
  const samples: DatasetScalar[] = [];

  values.forEach((value) => {
    if (samples.length >= SAMPLE_VALUE_LIMIT) {
      return;
    }

    const key = JSON.stringify(value);

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    samples.push(value);
  });

  return samples;
}
