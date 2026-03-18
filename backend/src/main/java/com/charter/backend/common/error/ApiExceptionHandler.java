package com.charter.backend.common.error;

import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(CoreException.class)
    public ResponseEntity<ErrorResponse> handleCoreException(CoreException ex) {
        return buildResponse(HttpStatus.I_AM_A_TEAPOT, ex.getReasonCode(), ex.getInternalCode(), ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(" "));
        return handleCoreException(new CoreException(
                ReasonCode.VALIDATION_ERROR,
                "request.validation",
                message));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return handleCoreException(new CoreException(
                ReasonCode.VALIDATION_ERROR,
                "request.invalid",
                ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
        return buildResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                ReasonCode.INTERNAL_ERROR,
                "platform.internal-error",
                "An unexpected error occurred.");
    }

    private ResponseEntity<ErrorResponse> buildResponse(
            HttpStatus status,
            ReasonCode reasonCode,
            String internalCode,
            String message) {
        return ResponseEntity.status(status)
                .body(ErrorResponse.builder()
                        .reasonCode(reasonCode)
                        .internalCode(internalCode)
                        .message(message)
                        .build());
    }
}
