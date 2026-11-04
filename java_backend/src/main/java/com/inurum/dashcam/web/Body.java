package com.inurum.dashcam.web;

import java.util.Map;

/**
 * Typed reads from a loose JSON request body.
 */
public final class Body {

    private Body() {
    }

    public static String str(Map<String, Object> body, String key) {
        if (body == null) return null;
        Object v = body.get(key);
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }

    public static String required(Map<String, Object> body, String key) {
        String s = str(body, key);
        if (s == null) throw ApiException.badRequest("MISSING_FIELD", key + " is required.");
        return s;
    }

    public static Integer integer(Map<String, Object> body, String key) {
        String s = str(body, key);
        if (s == null) return null;
        try {
            return (int) Double.parseDouble(s);
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("BAD_NUMBER", key + " must be a number.");
        }
    }
}
