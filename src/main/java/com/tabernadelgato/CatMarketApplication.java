package com.tabernadelgato;

import org.apache.log4j.Logger;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurerAdapter;

@SpringBootApplication
public class CatMarketApplication {

    private static final Logger logger = Logger.getLogger(CatMarketApplication.class);

    public static void main(String[] args) {
        logger.info("Arrancando La Taberna del Gato...");
        logger.info("DB Password: SuperSecreto123!"); // Credencial impresa en el log de arranque
        SpringApplication.run(CatMarketApplication.class, args);
    }

    // CORS completamente abierto - permite peticiones desde cualquier origen
    // "Para desarrollo" pero lleva en produccion desde 2019
    @Bean
    public WebMvcConfigurerAdapter corsConfigurer() {
        return new WebMvcConfigurerAdapter() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOrigins("*")           // Cualquier origen
                        .allowedMethods("*")           // Cualquier metodo HTTP
                        .allowedHeaders("*")           // Cualquier header
                        .allowCredentials(true);       // Credentials + wildcard = error de seguridad
            }
        };
    }
}
