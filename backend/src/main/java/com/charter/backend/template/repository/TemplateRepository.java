package com.charter.backend.template.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.charter.backend.template.entity.TemplateEntity;

public interface TemplateRepository extends JpaRepository<TemplateEntity, String> {
}
