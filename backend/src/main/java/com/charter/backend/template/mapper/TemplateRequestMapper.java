package com.charter.backend.template.mapper;

import java.time.Instant;

import com.charter.backend.template.model.StoredTemplate;
import com.charter.backend.template.model.request.SaveTemplateRequest;

public final class TemplateRequestMapper {

    private TemplateRequestMapper() {
    }

    public static StoredTemplate toNewTemplate(SaveTemplateRequest request, String templateId, String schemaVersion, Instant now) {
        return new StoredTemplate(
                templateId,
                schemaVersion,
                request.getName(),
                request.getDescription(),
                request.getConfig(),
                now,
                now);
    }

    public static StoredTemplate toUpdatedTemplate(
            StoredTemplate existing,
            SaveTemplateRequest request,
            String schemaVersion,
            Instant updatedAt) {
        return new StoredTemplate(
                existing.getId(),
                schemaVersion,
                request.getName(),
                request.getDescription(),
                request.getConfig(),
                existing.getCreatedAt(),
                updatedAt);
    }
}
