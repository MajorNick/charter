package com.charter.backend.template.model.request;

import com.fasterxml.jackson.databind.JsonNode;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SaveTemplateRequest {

    @NotBlank(message = "name is required.")
    @Size(max = 120, message = "name must be 120 characters or fewer.")
    private String name;

    @Size(max = 500, message = "description must be 500 characters or fewer.")
    private String description;

    @NotNull(message = "config is required.")
    private JsonNode config;
}
