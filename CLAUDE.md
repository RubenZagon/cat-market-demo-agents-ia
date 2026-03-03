# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Contexto del Proyecto

**"La Taberna del Gato"** es una aplicación e-commerce deliberadamente vulnerable y mal construida, diseñada con fines educativos para demostrar problemas comunes de seguridad, calidad de código y antipatrones. Es un proyecto de charla/demo sobre integración de IA en el desarrollo.

**Importante:** Las vulnerabilidades y el código de baja calidad son intencionales. El objetivo del proyecto es identificarlas y corregirlas como ejercicio práctico.

## Comandos

### Backend (Java/Spring Boot + Maven)
```bash
cd backend
mvn clean package -DskipTests   # Build
mvn test                        # Ejecutar todos los tests
mvn test -Dtest=NombreSpec      # Ejecutar un test específico (Spock)
mvn jacoco:report               # Generar reporte de cobertura
java -jar target/cat-market-1.0.0-SNAPSHOT.jar  # Ejecutar localmente
```

### Frontend (React + npm)
```bash
cd frontend
npm install          # Instalar dependencias
npm start            # Servidor de desarrollo (puerto 3000)
npm run build        # Build de producción
npm test             # Tests con Jest (modo watch)
npm test -- --coverage --watchAll=false  # Tests con cobertura una sola vez
npm test -- --testPathPattern=ProductList  # Ejecutar un test específico
```

### Docker
```bash
docker-compose up --build   # Levantar ambos servicios
docker-compose up           # Levantar sin reconstruir
```

Servicios tras `docker-compose up`:
- Backend API: http://localhost:8080/api
- Frontend: http://localhost:3000

## Arquitectura

### Stack
- **Backend:** Spring Boot 1.5.22, Java 8, H2 (in-memory), JPA/JDBC, Log4j 1.x, Maven
- **Frontend:** React 16.3.2, Axios, Bootstrap 3, Jest + React Testing Library
- **Tests Backend:** Spock Framework + Groovy 2.4
- **Infraestructura:** Docker + docker-compose, Nginx para frontend

### Estructura Backend (`backend/src/main/java/com/tabernadelgato/`)
- `CatMarketApplication.java` — Entry point de Spring Boot. CORS completamente abierto (todos los orígenes).
- `ProductController.java` — REST API. Endpoints: `GET /api/products`, `GET /api/products/search`, `GET /api/products/{id}`, `POST /api/products/{id}/buy`, `DELETE /admin/products/{id}`.
- `ProductService.java` — Lógica de negocio. El método `procesarPedido()` es un "god method" de 150+ líneas que mezcla precios, stock, emails y pedidos.

### Estructura Frontend (`frontend/src/`)
- `App.js` — Componente raíz de clase con todo el estado centralizado y prop drilling extremo hacia los hijos.
- `components/ProductList.jsx` — Lista de productos. Recibe 14 props. Contiene lógica de negocio, sort con bubble sort, y peticiones HTTP directas.
- `components/Header.jsx` — Formulario de login inline con almacenamiento de tokens en localStorage.
- `components/Cart.jsx` — Componente de carrito (relativamente simple).

### Flujo de Datos
El estado global vive en `App.js` y se pasa hacia abajo como props a todos los componentes. No hay gestión de estado centralizada (Redux, Context, etc.). Las peticiones HTTP se hacen directamente dentro de los componentes con Axios.

## Vulnerabilidades Conocidas (Intencionales)

Las siguientes vulnerabilidades existen por diseño educativo:
- **SQL Injection** — En endpoints de búsqueda y detalle de producto
- **XSS** — `dangerouslySetInnerHTML` sin sanitización en `ProductList.jsx`
- **Credenciales hardcodeadas** — BD, Stripe, claves de API en `ProductController.java` y `ProductService.java`
- **Race conditions** — Actualización de stock sin transacciones en `ProductService.java`
- **CORS abierto** — Permite todos los orígenes con credenciales
- **Tokens en localStorage** — Vulnerable a XSS en `Header.jsx`
- **Dependencias desactualizadas** — Spring Boot 1.5, Log4j 1.x, React 16.3

## Tests

Los tests existentes tienen cobertura de línea alta (~70-82%) pero calidad muy baja:
- Los tests de Spock (`ProductServiceSpec.groovy`) usan mocks que evitan la ejecución SQL real
- Los tests de Jest (`ProductList.test.js`) tienen assertions como `expect(true).toBe(true)` que no validan comportamiento real
- El umbral de cobertura configurado en `package.json` es 70%

Al escribir tests nuevos, el objetivo es mejorar la calidad real (mutation testing resilience), no solo la cobertura de línea.
