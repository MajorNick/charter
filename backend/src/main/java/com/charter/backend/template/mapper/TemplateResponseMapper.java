package com.charter.backend.template.mapper;

import com.charter.backend.template.model.StoredTemplate;
import com.charter.backend.template.model.response.PersistedTemplateResponse;
import com.charter.backend.template.model.response.TemplateResponseEnvelope;

public final class TemplateResponseMapper {

    public static TemplateResponseEnvelope toEnvelope(StoredTemplate template) {
        return new TemplateResponseEnvelope(PersistedTemplateResponse.builder()
                .id(template.getId())
                .name(template.getName())
                .description(template.getDescription())
                .config(template.getConfig())
                .createdAt(template.getCreatedAt())
                .updatedAt(template.getUpdatedAt())
                .build());
    }
}
