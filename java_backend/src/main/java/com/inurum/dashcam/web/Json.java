package com.inurum.dashcam.web;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Ordered JSON object builder that, unlike Map.of, accepts null values (sent as JSON null).
 */
public final class Json {

    private Json() {
    }

    public static Map<String, Object> obj(Object... keyValues) {
        if (keyValues.length % 2 != 0) throw new IllegalArgumentException("key/value pairs expected");
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            m.put((String) keyValues[i], keyValues[i + 1]);
        }
        return m;
    }
}
