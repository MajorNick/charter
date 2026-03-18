package com.charter.backend.config;

import java.util.ArrayList;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private String mode = "persisted-template-mvp";
    private String deployEnvironment = "local";
    private String version = "0.1.0";
    private String commitSha = "local";
    private final Cors cors = new Cors();

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public String getDeployEnvironment() {
        return deployEnvironment;
    }

    public void setDeployEnvironment(String deployEnvironment) {
        this.deployEnvironment = deployEnvironment;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getCommitSha() {
        return commitSha;
    }

    public void setCommitSha(String commitSha) {
        this.commitSha = commitSha;
    }

    public Cors getCors() {
        return cors;
    }

    public static class Cors {

        private List<String> allowedOrigins = new ArrayList<>(List.of("http://localhost:5173"));

        public List<String> getAllowedOrigins() {
            return allowedOrigins;
        }

        public void setAllowedOrigins(List<String> allowedOrigins) {
            this.allowedOrigins = new ArrayList<>(allowedOrigins);
        }
    }
}
