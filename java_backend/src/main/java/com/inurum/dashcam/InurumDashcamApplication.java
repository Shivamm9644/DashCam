package com.inurum.dashcam;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class InurumDashcamApplication {

    public static void main(String[] args) {
        SpringApplication.run(InurumDashcamApplication.class, args);
    }
}
