package com.charter.backend.template.model.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class TemplateResponseEnvelope {

    private PersistedTemplateResponse template;
}
