export type DatasetScalar = string | number | boolean | null;

export type DatasetFieldKind = "string" | "number" | "boolean" | "null" | "mixed";

export type DatasetSourceKind = "csv" | "json";

export type DatasetRow = Record<string, DatasetScalar>;

export interface DatasetField {
  key: string;
  label: string;
  sourceKey: string;
  kind: DatasetFieldKind;
  nullable: boolean;
  valuesPresent: number;
  sampleValues: DatasetScalar[];
}

export interface DatasetSource {
  kind: DatasetSourceKind;
  fileName: string;
  fileSize: number;
  rowCount: number;
  importedAt: string;
}

export interface NormalizedDataset {
  source: DatasetSource;
  fields: DatasetField[];
  rows: DatasetRow[];
  sampleRows: DatasetRow[];
}

export interface ParsedDatasetResult {
  kind: DatasetSourceKind;
  fieldOrder: string[];
  rows: DatasetRow[];
  sourceLabels: Record<string, string>;
}
