export interface BackendHealthResponse {
  status: string | null;
  service: string | null;
  mode: string | null;
  deployEnvironment: string | null;
  version: string | null;
}

export interface BackendTemplateContractResponse {
  persistence: string | null;
  processing: string | null;
  shareTransport: string | null;
}

export interface BackendMetaResponse {
  application: string | null;
  service: string | null;
  backend: string | null;
  mode: string | null;
  deployEnvironment: string | null;
  version: string | null;
  commitSha: string | null;
  healthEndpoint: string | null;
  infoEndpoint: string | null;
  templateContract: BackendTemplateContractResponse | null;
  supportedInputs: string[];
  supportedCharts: string[];
}
