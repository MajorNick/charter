package com.charter.backend.common.error;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ErrorResponse {

    private ReasonCode reasonCode;
    private String internalCode;
    private String message;
}
