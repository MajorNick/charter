CREATE TABLE templates (
    id VARCHAR(26) PRIMARY KEY,
    schema_version VARCHAR(50) NOT NULL,
    title VARCHAR(120),
    description VARCHAR(500),
    template_config_json CLOB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
