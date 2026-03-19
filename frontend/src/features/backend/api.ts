import { BackendHealthResponse, BackendMetaResponse } from "./types";

export const BACKEND_HEALTH_PATH = "/health";
export const BACKEND_META_PATH = "/api/meta";

export class BackendApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "BackendApiError";
  }
}

export interface BackendApiClientOptions {
  baseUrl?: string;
  fetchImplementation?: typeof fetch;
}

export function createBackendApiClient(options: BackendApiClientOptions = {}) {
  const fetchImplementation = options.fetchImplementation ?? fetch;

  return {
    async health(): Promise<BackendHealthResponse> {
      const payload = await requestJson(fetchImplementation, resolveUrl(options.baseUrl, BACKEND_HEALTH_PATH));
      return parseHealthResponse(payload);
    },
    async meta(): Promise<BackendMetaResponse> {
      const payload = await requestJson(fetchImplementation, resolveUrl(options.baseUrl, BACKEND_META_PATH));
      return parseMetaResponse(payload);
    },
  };
}

async function requestJson(fetchImplementation: typeof fetch, input: string): Promise<unknown> {
  const response = await fetchImplementation(input, { method: "GET" });

  if (!response.ok) {
    throw new BackendApiError(`Backend API request failed with status ${response.status}.`, response.status);
  }

  return response.json();
}

function resolveUrl(baseUrl: string | undefined, path: string): string {
  if (!baseUrl) {
    return path;
  }

  return new URL(path, baseUrl).toString();
}

function parseHealthResponse(value: unknown): BackendHealthResponse {
  const record = readRecord(value, "health response");
  return {
    status: readNullableString(record.status),
    service: readNullableString(record.service),
    mode: readNullableString(record.mode),
    deployEnvironment: readNullableString(record.deployEnvironment),
    version: readNullableString(record.version),
  };
}

function parseMetaResponse(value: unknown): BackendMetaResponse {
  const record = readRecord(value, "meta response");
  const templateContractRecord = record.templateContract == null ? null : readRecord(record.templateContract, "meta response.templateContract");

  return {
    application: readNullableString(record.application),
    service: readNullableString(record.service),
    backend: readNullableString(record.backend),
    mode: readNullableString(record.mode),
    deployEnvironment: readNullableString(record.deployEnvironment),
    version: readNullableString(record.version),
    commitSha: readNullableString(record.commitSha),
    healthEndpoint: readNullableString(record.healthEndpoint),
    infoEndpoint: readNullableString(record.infoEndpoint),
    templateContract: templateContractRecord ? {
      persistence: readNullableString(templateContractRecord.persistence),
      processing: readNullableString(templateContractRecord.processing),
      shareTransport: readNullableString(templateContractRecord.shareTransport),
    } : null,
    supportedInputs: readStringArray(record.supportedInputs),
    supportedCharts: readStringArray(record.supportedCharts),
  };
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}
