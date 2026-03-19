import {
  CreateTemplateRequest,
  PersistedTemplate,
  TemplateResponseEnvelope,
  UpdateTemplateRequest,
} from "./types";
import {
  parseTemplateResponseEnvelope,
  serializeCreateTemplateRequest,
  serializeUpdateTemplateRequest,
} from "./serialization";

export const TEMPLATE_API_BASE_PATH = "/api/templates";

export class TemplateApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "TemplateApiError";
  }
}

export interface TemplateApiClientOptions {
  baseUrl?: string;
  fetchImplementation?: typeof fetch;
}

export function buildTemplateCollectionPath(): string {
  return TEMPLATE_API_BASE_PATH;
}

export function buildTemplateByIdPath(templateId: string): string {
  return `${TEMPLATE_API_BASE_PATH}/${encodeURIComponent(templateId)}`;
}

export function createTemplateApiClient(options: TemplateApiClientOptions = {}) {
  const fetchImplementation = options.fetchImplementation ?? fetch;

  return {
    async create(request: CreateTemplateRequest): Promise<PersistedTemplate> {
      const response = await requestEnvelope(fetchImplementation, resolveUrl(options.baseUrl, buildTemplateCollectionPath()), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: serializeCreateTemplateRequest(request),
      });

      return response.template;
    },
    async load(templateId: string): Promise<PersistedTemplate> {
      const response = await requestEnvelope(fetchImplementation, resolveUrl(options.baseUrl, buildTemplateByIdPath(templateId)), {
        method: "GET",
      });

      return response.template;
    },
    async update(templateId: string, request: UpdateTemplateRequest): Promise<PersistedTemplate> {
      const response = await requestEnvelope(fetchImplementation, resolveUrl(options.baseUrl, buildTemplateByIdPath(templateId)), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: serializeUpdateTemplateRequest(request),
      });

      return response.template;
    },
  };
}

async function requestEnvelope(
  fetchImplementation: typeof fetch,
  input: string,
  init: RequestInit,
): Promise<TemplateResponseEnvelope> {
  const response = await fetchImplementation(input, init);

  if (!response.ok) {
    throw new TemplateApiError(`Template API request failed with status ${response.status}.`, response.status);
  }

  const payload = (await response.json()) as unknown;
  return parseTemplateResponseEnvelope(payload);
}

function resolveUrl(baseUrl: string | undefined, path: string): string {
  if (!baseUrl) {
    return path;
  }

  return new URL(path, baseUrl).toString();
}
