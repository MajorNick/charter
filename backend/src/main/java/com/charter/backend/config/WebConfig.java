package com.charter.backend.config;

import java.util.List;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final AppProperties appProperties;

    public WebConfig(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] allowedOrigins = resolveAllowedOrigins();

        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "HEAD", "OPTIONS")
                .allowedHeaders("*");

        registry.addMapping("/health")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "HEAD", "OPTIONS")
                .allowedHeaders("*");
    }

    private String[] resolveAllowedOrigins() {
        List<String> configuredOrigins = appProperties.getCors().getAllowedOrigins();
        if (configuredOrigins == null || configuredOrigins.isEmpty()) {
            return new String[] {"http://localhost:5173"};
        }

        return configuredOrigins.toArray(String[]::new);
    }
}
