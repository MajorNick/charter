package com.charter.backend.platform.model.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class HealthResponse {

    private String status;
    private String service;
    private String mode;
    private String deployEnvironment;
    private String version;
}
