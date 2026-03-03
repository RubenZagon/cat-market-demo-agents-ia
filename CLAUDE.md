# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Propósito del proyecto

**La Taberna del Gato** es una tienda online de productos para gatos creada intencionalmente con vulnerabilidades de seguridad y malas prácticas. Es un proyecto de demostración educativa para talleres sobre seguridad e integración de IA.

> **IMPORTANTE:** Este proyecto contiene vulnerabilidades deliberadas (SQL injection, credenciales hardcodeadas, Log4j 1.x, etc.). No desplegar en producción.

## Stack tecnológico

- **Backend:** Spring Boot 1.5.22, Java 8, Maven, H2 (in-memory), JdbcTemplate
- **Frontend:** React 16.3.2 (componentes de clase), axios, Bootstrap 3, create-react-app
- **Testing backend:** Spock Framework (Groovy), JUnit, JaCoCo
- **Testing frontend:** Jest + @testing-library

## Comandos de desarrollo

### Backend
```bash
mvn clean package          # Compilar
mvn spring-boot:run        # Ejecutar (puerto 8080)
mvn test                   # Ejecutar tests
mvn jacoco:report          # Reporte de cobertura en target/site/jacoco/
```

### Frontend (desde `frontend/`)
```bash
npm install                # Instalar dependencias
npm start                  # Servidor de desarrollo (puerto 3000)
npm run build              # Build de producción
npm test                   # Ejecutar tests con cobertura (umbral: 70% líneas)
```

## Arquitectura

### Backend (`src/main/java/com/tabernadelgato/`)

- **`CatMarketApplication.java`** — Entry point, configura CORS global (abierto a `*`) e inicializa la BD H2
- **`ProductController.java`** — Controlador REST con 6 endpoints (`/api/products`, `/api/products/search`, `/api/products/{id}`, `/api/products/{id}/buy`, `/api/admin/products/{id}`)
- **`ProductService.java`** — Lógica de negocio; acceso a datos vía `JdbcTemplate` con SQL en bruto

La configuración sensible (credenciales H2, JWT secret, claves Stripe/SendGrid) está en `src/main/resources/application.properties`.

### Frontend (`frontend/src/`)

- **`App.js`** — Componente raíz de clase; gestiona estado global y llamadas HTTP con axios
- **`components/ProductList.jsx`** — Lista de productos y gestión del carrito
- **`components/ProductList.test.js`** — Tests del componente

## Tests

- Tests de backend usan sintaxis Groovy/Spock en `src/test/groovy/`
- El umbral de cobertura del frontend es 70% de líneas (configurado en `package.json`)
- Para ejecutar un test individual de backend: `mvn test -Dtest=ProductServiceSpec`

## Contexto educativo

El fichero `security-plan.md` contiene la lista de vulnerabilidades a identificar durante los talleres. Las vulnerabilidades intencionales incluyen: SQL injection, credenciales hardcodeadas, CORS mal configurado, dependencias con CVEs conocidos (Log4j 1.x, commons-collections 3.2.1, jackson-databind 2.9.x) y la consola H2 expuesta.
