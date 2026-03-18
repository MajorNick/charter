package com.charter.backend.template.controller;

import java.net.URI;

import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.charter.backend.template.mapper.TemplateResponseMapper;
import com.charter.backend.template.model.StoredTemplate;
import com.charter.backend.template.model.request.SaveTemplateRequest;
import com.charter.backend.template.model.response.TemplateResponseEnvelope;
import com.charter.backend.template.service.TemplateService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/templates")
@Validated
@RequiredArgsConstructor
public class TemplateController {

    private final TemplateService templateService;

    @PostMapping
    public ResponseEntity<TemplateResponseEnvelope> create(@Valid @RequestBody SaveTemplateRequest request) {
        StoredTemplate template = templateService.create(request);
        return ResponseEntity.created(URI.create("/api/templates/" + template.getId()))
                .body(TemplateResponseMapper.toEnvelope(template));
    }

    @GetMapping("/{templateId}")
    public TemplateResponseEnvelope findById(@PathVariable String templateId) {
        return TemplateResponseMapper.toEnvelope(templateService.findById(templateId));
    }

    @PutMapping("/{templateId}")
    public TemplateResponseEnvelope update(@PathVariable String templateId, @Valid @RequestBody SaveTemplateRequest request) {
        return TemplateResponseMapper.toEnvelope(templateService.update(templateId, request));
    }
}
