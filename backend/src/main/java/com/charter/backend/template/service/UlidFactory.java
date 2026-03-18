package com.charter.backend.template.service;

import com.github.f4b6a3.ulid.UlidCreator;

import org.springframework.stereotype.Component;

@Component
public class UlidFactory {

    public String nextUlid() {
        return UlidCreator.getUlid().toString();
    }
}
