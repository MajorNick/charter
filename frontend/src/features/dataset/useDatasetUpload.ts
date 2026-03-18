import { useCallback, useState } from "react";
import { parseUploadedFile } from "./parseUploadedFile";
import { NormalizedDataset } from "./types";

export type UploadStatus = "idle" | "loading" | "ready" | "error";

interface UploadState {
  status: UploadStatus;
  dataset: NormalizedDataset | null;
  error: string | null;
  fileName: string | null;
}

const initialUploadState: UploadState = {
  status: "idle",
  dataset: null,
  error: null,
  fileName: null,
};

export function useDatasetUpload() {
  const [state, setState] = useState<UploadState>(initialUploadState);

  const loadFile = useCallback(async (file: File | null) => {
    if (!file) {
      return;
    }

    setState({
      status: "loading",
      dataset: null,
      error: null,
      fileName: file.name,
    });

    try {
      const dataset = await parseUploadedFile(file);

      setState({
        status: "ready",
        dataset,
        error: null,
        fileName: file.name,
      });
    } catch (error) {
      setState({
        status: "error",
        dataset: null,
        error: error instanceof Error ? error.message : "The file could not be loaded.",
        fileName: file.name,
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState(initialUploadState);
  }, []);

  return {
    ...state,
    loadFile,
    reset,
  };
}
