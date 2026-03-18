package com.charter.backend.common.error;

import lombok.Getter;

@Getter
public class CoreException extends RuntimeException {

    private final ReasonCode reasonCode;
    private final String internalCode;

    public CoreException(ReasonCode reasonCode, String internalCode, String message) {
        super(message);
        this.reasonCode = reasonCode;
        this.internalCode = internalCode;
    }
}
