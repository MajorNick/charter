package com.charter.backend.template.mapper;

import com.charter.backend.template.entity.TemplateEntity;
import com.charter.backend.template.model.StoredTemplate;

public final class TemplateEntityMapper {

    private TemplateEntityMapper() {
    }

    public static TemplateEntity toEntity(StoredTemplate template) {
        return TemplateEntity.builder()
                .id(template.getId())
                .schemaVersion(template.getSchemaVersion())
                .name(template.getName())
                .description(template.getDescription())
                .config(template.getConfig())
                .createdAt(template.getCreatedAt())
                .updatedAt(template.getUpdatedAt())
                .build();
    }

    public static StoredTemplate toModel(TemplateEntity entity) {
        return new StoredTemplate(
                entity.getId(),
                entity.getSchemaVersion(),
                entity.getName(),
                entity.getDescription(),
                entity.getConfig(),
                entity.getCreatedAt(),
                entity.getUpdatedAt());
    }
}
