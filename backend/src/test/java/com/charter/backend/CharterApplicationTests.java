package com.charter.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(properties = {
        "APP_DEPLOY_ENV=test",
        "APP_VERSION=test-version",
        "APP_COMMIT_SHA=test-sha",
        "CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173"
})
@AutoConfigureMockMvc
class CharterApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthAliasReturnsThinRuntimeContract() throws Exception {
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("charter-backend"))
                .andExpect(jsonPath("$.mode").value("persisted-template-mvp"))
                .andExpect(jsonPath("$.deployEnvironment").value("test"))
                .andExpect(jsonPath("$.version").value("test-version"));
    }

    @Test
    void metaEndpointDeclaresPersistedTemplateBoundary() throws Exception {
        mockMvc.perform(get("/api/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.application").value("Charter"))
                .andExpect(jsonPath("$.service").value("charter-backend"))
                .andExpect(jsonPath("$.backend").value("spring-boot"))
                .andExpect(jsonPath("$.mode").value("persisted-template-mvp"))
                .andExpect(jsonPath("$.deployEnvironment").value("test"))
                .andExpect(jsonPath("$.version").value("test-version"))
                .andExpect(jsonPath("$.commitSha").value("test-sha"))
                .andExpect(jsonPath("$.templateContract.persistence").value("postgres-json"))
                .andExpect(jsonPath("$.templateContract.processing").value("client-side"))
                .andExpect(jsonPath("$.templateContract.shareTransport").value("ulid-route"));
    }

    @Test
    void actuatorEndpointsAreExposedForDeploymentChecks() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        mockMvc.perform(get("/actuator/health/liveness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        mockMvc.perform(get("/actuator/health/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        mockMvc.perform(get("/actuator/info"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.app.name").value("Charter"))
                .andExpect(jsonPath("$.app.mode").value("persisted-template-mvp"))
                .andExpect(jsonPath("$.template.persistence").value("postgres-json"))
                .andExpect(jsonPath("$.template['share-transport']").value("ulid-route"));
    }

    @Test
    void configuredCorsOriginIsAllowedOnPublicMetaRoute() throws Exception {
        mockMvc.perform(get("/api/meta").header(HttpHeaders.ORIGIN, "http://localhost:5173"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:5173"));
    }

    @Test
    void createLoadAndUpdateTemplateFlowWorks() throws Exception {
        String createRequest = """
                {
                  "name": "Revenue by Segment",
                  "description": "Quarterly revenue template",
                  "config": {
                    "schemaVersion": 1,
                    "source": {"kind": "csv", "fields": []},
                    "transforms": [],
                    "chart": {"chartType": "bar", "xField": "region", "yField": "revenue", "seriesField": null, "colorField": null}
                  }
                }
                """;

        MvcResult createResult = mockMvc.perform(post("/api/templates")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createRequest))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, org.hamcrest.Matchers.matchesPattern("/api/templates/[0-9A-HJKMNP-TV-Z]{26}")))
                .andExpect(jsonPath("$.template.id", org.hamcrest.Matchers.matchesPattern("[0-9A-HJKMNP-TV-Z]{26}")))
                .andExpect(jsonPath("$.template.name").value("Revenue by Segment"))
                .andExpect(jsonPath("$.template.config.chart.chartType").value("bar"))
                .andReturn();

        String templateId = JsonTestHelper.read(createResult.getResponse().getContentAsString(), "$.template.id");

        mockMvc.perform(get("/api/templates/{templateId}", templateId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.template.id").value(templateId))
                .andExpect(jsonPath("$.template.description").value("Quarterly revenue template"));

        String updateRequest = """
                {
                  "name": "Revenue by Segment (Updated)",
                  "description": "Updated template",
                  "config": {
                    "schemaVersion": 1,
                    "source": {"kind": "csv", "fields": []},
                    "transforms": [],
                    "chart": {"chartType": "line", "xField": "region", "yField": "revenue", "seriesField": null, "colorField": null}
                  }
                }
                """;

        mockMvc.perform(put("/api/templates/{templateId}", templateId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateRequest))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.template.id").value(templateId))
                .andExpect(jsonPath("$.template.name").value("Revenue by Segment (Updated)"))
                .andExpect(jsonPath("$.template.config.chart.chartType").value("line"));
    }

    @Test
    void createFailsWhenSchemaVersionIsMissing() throws Exception {
        String invalidRequest = """
                {
                  "name": "Missing schema version",
                  "description": null,
                  "config": {
                    "source": {"kind": "csv", "fields": []},
                    "transforms": [],
                    "chart": {"chartType": "bar", "xField": "region", "yField": "revenue", "seriesField": null, "colorField": null}
                  }
                }
                """;

        mockMvc.perform(post("/api/templates")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidRequest))
                .andExpect(status().isIAmATeapot())
                .andExpect(jsonPath("$.reasonCode").value("INVALID_TEMPLATE_CONFIG"))
                .andExpect(jsonPath("$.internalCode").value("template.invalid-config"))
                .andExpect(jsonPath("$.message").value("config.schemaVersion is required."));
    }

    @Test
    void invalidTemplateIdReturnsTeapot() throws Exception {
        mockMvc.perform(get("/api/templates/not-a-ulid"))
                .andExpect(status().isIAmATeapot())
                .andExpect(jsonPath("$.reasonCode").value("INVALID_TEMPLATE_ID"))
                .andExpect(jsonPath("$.internalCode").value("template.invalid-id"))
                .andExpect(jsonPath("$.message").value("Template id 'not-a-ulid' is not a valid ULID."));
    }

    @Test
    void missingTemplateReturnsTeapot() throws Exception {
        mockMvc.perform(get("/api/templates/{templateId}", "01ARZ3NDEKTSV4RRFFQ69G5FAV"))
                .andExpect(status().isIAmATeapot())
                .andExpect(jsonPath("$.reasonCode").value("TEMPLATE_NOT_FOUND"))
                .andExpect(jsonPath("$.internalCode").value("template.not-found"))
                .andExpect(jsonPath("$.message").value("Template '01ARZ3NDEKTSV4RRFFQ69G5FAV' was not found."));
    }
}
