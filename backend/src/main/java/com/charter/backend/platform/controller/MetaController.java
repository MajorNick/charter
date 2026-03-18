package com.charter.backend.platform.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.charter.backend.config.AppProperties;
import com.charter.backend.platform.model.response.MetaResponse;
import com.charter.backend.platform.model.response.TemplateContractResponse;

@RestController
@RequestMapping("/api/meta")
public class MetaController {

    private final AppProperties appProperties;
    private final String serviceName;

    public MetaController(
            AppProperties appProperties,
            @Value("${spring.application.name:charter-backend}") String serviceName) {
        this.appProperties = appProperties;
        this.serviceName = serviceName;
    }

    @GetMapping
    public MetaResponse meta() {
        return MetaResponse.builder()
                .application("Charter")
                .service(serviceName)
                .backend("spring-boot")
                .mode(appProperties.getMode())
                .deployEnvironment(appProperties.getDeployEnvironment())
                .version(appProperties.getVersion())
                .commitSha(appProperties.getCommitSha())
                .healthEndpoint("/actuator/health/readiness")
                .infoEndpoint("/actuator/info")
                .templateContract(TemplateContractResponse.builder()
                        .persistence("postgres-json")
                        .processing("client-side")
                        .shareTransport("ulid-route")
                        .build())
                .supportedInputs(List.of("csv", "json"))
                .supportedCharts(List.of("bar", "line", "pie"))
                .build();
    }
}
