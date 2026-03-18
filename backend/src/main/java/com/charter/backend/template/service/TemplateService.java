package com.charter.backend.template.service;

import java.time.Instant;
import java.util.Optional;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.charter.backend.common.error.CoreException;
import com.charter.backend.common.error.ReasonCode;
import com.charter.backend.template.mapper.TemplateEntityMapper;
import com.charter.backend.template.mapper.TemplateRequestMapper;
import com.charter.backend.template.model.StoredTemplate;
import com.charter.backend.template.model.request.SaveTemplateRequest;
import com.charter.backend.template.repository.TemplateRepository;
import com.fasterxml.jackson.databind.JsonNode;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class TemplateService {

    private static final Pattern ULID_PATTERN = Pattern.compile("^[0-9A-HJKMNP-TV-Z]{26}$");

    private final TemplateRepository templateRepository;
    private final UlidFactory ulidFactory;

    public StoredTemplate create(SaveTemplateRequest request) {
        Instant now = Instant.now();
        StoredTemplate template = TemplateRequestMapper.toNewTemplate(
                request,
                ulidFactory.nextUlid(),
                readSchemaVersion(request.getConfig()),
                now);
        return TemplateEntityMapper.toModel(templateRepository.save(TemplateEntityMapper.toEntity(template)));
    }

    @Transactional(readOnly = true)
    public StoredTemplate findById(String templateId) {
        validateTemplateId(templateId);
        return templateRepository.findById(templateId)
                .map(TemplateEntityMapper::toModel)
                .orElseThrow(() -> new CoreException(
                        ReasonCode.TEMPLATE_NOT_FOUND,
                        "template.not-found",
                        "Template '%s' was not found.".formatted(templateId)));
    }

    public StoredTemplate update(String templateId, SaveTemplateRequest request) {
        StoredTemplate existing = findById(templateId);
        StoredTemplate updated = TemplateRequestMapper.toUpdatedTemplate(
                existing,
                request,
                readSchemaVersion(request.getConfig()),
                Instant.now());
        return TemplateEntityMapper.toModel(templateRepository.save(TemplateEntityMapper.toEntity(updated)));
    }

    private void validateTemplateId(String templateId) {
        Optional.ofNullable(templateId)
                .filter(id -> ULID_PATTERN.matcher(id).matches())
                .orElseThrow(() -> new CoreException(
                        ReasonCode.INVALID_TEMPLATE_ID,
                        "template.invalid-id",
                        "Template id '%s' is not a valid ULID.".formatted(templateId)));
    }

    private String readSchemaVersion(JsonNode config) {
        JsonNode schemaVersion = config.get("schemaVersion");
        if (schemaVersion == null || schemaVersion.isNull() || schemaVersion.asText().isBlank()) {
            throw new CoreException(
                    ReasonCode.INVALID_TEMPLATE_CONFIG,
                    "template.invalid-config",
                    "config.schemaVersion is required.");
        }

        return schemaVersion.asText();
    }
}
