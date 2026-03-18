package com.charter.backend.template.model.response;

import java.time.Instant;

import com.fasterxml.jackson.databind.JsonNode;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PersistedTemplateResponse {

    private String id;
    private String name;
    private String description;
    private JsonNode config;
    private Instant createdAt;
    private Instant updatedAt;
}
