import { DatasetParseError } from "./errors";
import { createNormalizedDataset } from "./normalization";
import { parseCsvText } from "./parsers/csv";
import { parseJsonText } from "./parsers/json";
import { DatasetSourceKind, NormalizedDataset } from "./types";

export async function parseUploadedFile(file: File): Promise<NormalizedDataset> {
  const sourceKind = detectSourceKind(file);
  const rawText = await file.text();

  try {
    const parsedDataset = sourceKind === "csv" ? parseCsvText(rawText) : parseJsonText(rawText);
    return createNormalizedDataset(file, parsedDataset);
  } catch (error) {
    if (error instanceof DatasetParseError) {
      throw error;
    }

    if (sourceKind === "json" && error instanceof SyntaxError) {
      throw new DatasetParseError("The JSON file could not be parsed. Check the file for invalid JSON syntax.");
    }

    throw new DatasetParseError("The selected file could not be parsed.");
  }
}

function detectSourceKind(file: File): DatasetSourceKind {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".csv") || file.type === "text/csv") {
    return "csv";
  }

  if (fileName.endsWith(".json") || file.type === "application/json") {
    return "json";
  }

  throw new DatasetParseError("Only .csv and .json files are supported in Phase 1.");
}
