package com.inurum.dashcam.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.*;

/**
 * HS256 JWT (RFC 7519): sign, verify signature + expiry, read claims.
 */
@Component
public class JwtTokenProvider {

    private static final Logger log = LoggerFactory.getLogger(JwtTokenProvider.class);

    private final byte[] secretKey;
    private final long validityInMilliseconds;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public JwtTokenProvider(
            @Value("${security.jwt.secret:}") String secret,
            @Value("${security.jwt.expiration-ms:43200000}") long validityInMilliseconds) {
        if (secret == null || secret.isBlank()) {
            byte[] random = new byte[48];
            new SecureRandom().nextBytes(random);
            this.secretKey = random;
            log.warn("JWT_SECRET is not set: using a random key, so tokens stop working after a restart");
        } else {
            this.secretKey = secret.getBytes(StandardCharsets.UTF_8);
        }
        this.validityInMilliseconds = validityInMilliseconds;
    }

    public String createToken(String userId, String email, String role, String tenantId) {
        try {
            long now = System.currentTimeMillis();

            Map<String, Object> header = new LinkedHashMap<>();
            header.put("alg", "HS256");
            header.put("typ", "JWT");

            Map<String, Object> claims = new LinkedHashMap<>();
            claims.put("sub", userId);
            claims.put("email", email);
            claims.put("role", role);
            claims.put("tenantId", tenantId);
            claims.put("iss", "Inurum-Dashcam-Platform");
            claims.put("iat", now / 1000);
            claims.put("exp", (now + validityInMilliseconds) / 1000);

            String content = b64(objectMapper.writeValueAsBytes(header)) + "." + b64(objectMapper.writeValueAsBytes(claims));
            return content + "." + sign(content);
        } catch (Exception e) {
            throw new IllegalStateException("JWT generation failed", e);
        }
    }

    /**
     * Returns the claims of a token with a valid signature that has not expired, otherwise null.
     */
    public Map<String, Object> verify(String token) {
        if (token == null || token.isBlank()) return null;
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) return null;

            String expectedSig = sign(parts[0] + "." + parts[1]);
            if (!MessageDigest.isEqual(parts[2].getBytes(StandardCharsets.UTF_8), expectedSig.getBytes(StandardCharsets.UTF_8))) {
                return null;
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> claims = objectMapper.readValue(Base64.getUrlDecoder().decode(parts[1]), Map.class);
            Object exp = claims.get("exp");
            if (!(exp instanceof Number) || System.currentTimeMillis() / 1000 > ((Number) exp).longValue()) {
                return null;
            }
            return claims;
        } catch (Exception e) {
            return null;
        }
    }

    private static String b64(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String sign(String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secretKey, "HmacSHA256"));
        return b64(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    }
}
