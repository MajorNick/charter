package com.charter.backend.platform.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.charter.backend.config.AppProperties;
import com.charter.backend.platform.model.response.HealthResponse;

@RestController
public class HealthController {

    private final AppProperties appProperties;
    private final String serviceName;

    public HealthController(
            AppProperties appProperties,
            @Value("${spring.application.name:charter-backend}") String serviceName) {
        this.appProperties = appProperties;
        this.serviceName = serviceName;
    }

    @GetMapping("/health")
    public HealthResponse health() {
        return HealthResponse.builder()
                .status("UP")
                .service(serviceName)
                .mode(appProperties.getMode())
                .deployEnvironment(appProperties.getDeployEnvironment())
                .version(appProperties.getVersion())
                .build();
    }
}
