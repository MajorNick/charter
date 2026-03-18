import { DatasetRow, NormalizedDataset } from "../dataset";
import { TransformStep } from "../template-contract";

export interface TransformExecutionTrace {
  stepId: string;
  stepType: TransformStep["type"];
  rowCount: number;
  fieldOrder: string[];
}

export interface TransformExecutionResult {
  dataset: NormalizedDataset;
  traces: TransformExecutionTrace[];
}

export class TransformExecutionError extends Error {
  constructor(message: string, readonly stepId?: string) {
    super(message);
    this.name = "TransformExecutionError";
  }
}

export interface WorkingDataset {
  rows: DatasetRow[];
  fieldOrder: string[];
  sourceLabels: Record<string, string>;
}
