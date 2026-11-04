package com.inurum.dashcam.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    public static final String SECURITY_SCHEME_NAME = "BearerAuth";

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Inurum Enterprise DashCam & Telematics API (TruckerCloud Certified)")
                        .version("1.0.0")
                        .description("Production-grade RESTful API backend for Inurum DashCam Fleet Telematics & Video Retrieval. "
                                + "Features validated 17-character VIN mapping, explicit ECU/GPS odometer provenance tracking, "
                                + "native JT/T 808 GPS telemetry, JT/T 1078 dual-camera live streaming, on-demand SD card retrieval (0x9205/0x9201), "
                                + "ADAS/DMS safety incident evidence, and a dedicated TruckerCloud integration namespace (`/api/v1/integrations/truckercloud/*`).")
                        .contact(new Contact()
                                .name("Inurum Engineering Support")
                                .email("support@inurum.com")
                                .url("https://inurum.com"))
                        .license(new License()
                                .name("Enterprise Commercial License")
                                .url("https://inurum.com/license")))
                .servers(List.of(
                        new Server().url("/").description("Current Server Instance"),
                        new Server().url("http://127.0.0.1:8080").description("Local Development"),
                        new Server().url("http://ec2-3-85-81-10.compute-1.amazonaws.com:8080").description("AWS EC2 Production Instance")
                ))
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME))
                .components(new Components()
                        .addSecuritySchemes(SECURITY_SCHEME_NAME,
                                new SecurityScheme()
                                        .name(SECURITY_SCHEME_NAME)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("Enter your JWT token obtained from `/api/v1/auth/login`")
                        ));
    }
}
