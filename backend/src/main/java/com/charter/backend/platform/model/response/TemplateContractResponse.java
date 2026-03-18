package com.charter.backend.platform.model.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class TemplateContractResponse {

    private String persistence;
    private String processing;
    private String shareTransport;
}
