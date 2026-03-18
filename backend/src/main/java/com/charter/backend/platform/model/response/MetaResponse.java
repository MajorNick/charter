package com.charter.backend.platform.model.response;

import java.util.List;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MetaResponse {

    private String application;
    private String service;
    private String backend;
    private String mode;
    private String deployEnvironment;
    private String version;
    private String commitSha;
    private String healthEndpoint;
    private String infoEndpoint;
    private TemplateContractResponse templateContract;
    private List<String> supportedInputs;
    private List<String> supportedCharts;
}
