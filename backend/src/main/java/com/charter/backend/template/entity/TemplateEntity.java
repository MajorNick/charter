package com.charter.backend.template.entity;

import java.time.Instant;

import com.charter.backend.template.repository.converter.JsonNodeStringConverter;
import com.fasterxml.jackson.databind.JsonNode;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "templates")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemplateEntity {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "schema_version", length = 50, nullable = false)
    private String schemaVersion;

    @Column(name = "title", length = 120)
    private String name;

    @Column(name = "description", length = 500)
    private String description;

    @Convert(converter = JsonNodeStringConverter.class)
    @Column(name = "template_config_json", nullable = false)
    private JsonNode config;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
