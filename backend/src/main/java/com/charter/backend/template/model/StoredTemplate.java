package com.charter.backend.template.model;

import java.time.Instant;

import com.fasterxml.jackson.databind.JsonNode;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class StoredTemplate {

    private String id;
    private String schemaVersion;
    private String name;
    private String description;
    private JsonNode config;
    private Instant createdAt;
    private Instant updatedAt;
}
