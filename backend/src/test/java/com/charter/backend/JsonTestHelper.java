package com.charter.backend;

import com.jayway.jsonpath.JsonPath;

public final class JsonTestHelper {

    private JsonTestHelper() {
    }

    public static String read(String json, String path) {
        return JsonPath.read(json, path);
    }
}
