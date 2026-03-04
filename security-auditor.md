# Plan de Auditoría de Seguridad: Frontend — La Taberna del Gato

## Contexto del Stack

* **Tecnología:** React 16.3.2 (Create React App de 2019).
* **Librerías Críticas:** `axios 0.18.0`, `marked 0.3.6`, `handlebars 4.0.11`.
* **Foco de Riesgo:** Vulnerabilidades de Client-Side (XSS), gestión insegura de estado/tokens y dependencias obsoletas con CVEs conocidos.

---

## Tareas de Auditoría

* [ ] **Tarea 1 — Análisis de Dependencias (Supply Chain):** Ejecutar `npm audit` o `yarn audit` en la carpeta `frontend/`. Investigar específicamente vulnerabilidades de ejecución remota o DoS en:
* `axios 0.18.0` (Vulnerable a SSRF y problemas de configuración de proxy).
* `marked 0.3.6` (Conocido por permitir XSS mediante bypass de sanitización).
* `serialize-javascript 1.4.0` e `immer`.
* [ ] **Tarea 2 — Fugas de Secretos en el Cliente:** Escanear `frontend/src/App.js` y archivos `.env` (si existen) en busca de:
* API Keys de Stripe (especialmente las `sk_live` que nunca deben ir al front).
* Tokens de administración o contraseñas hardcodeadas para bypass de login.
* Firebase/AWS credentials con permisos excesivos.
* [ ] **Tarea 3 — Auditoría de XSS (Cross-Site Scripting):** Localizar el uso de `dangerouslySetInnerHTML` en toda la carpeta `src/`, especialmente en `ProductList.jsx` y componentes de renderizado de reseñas o descripciones.
* Verificar si los datos provienen de fuentes externas sin pasar por una librería de sanitización (como DOMPurify).
* [ ] **Tarea 4 — Almacenamiento Inseguro (Storage):** Revisar `App.js` y componentes de autenticación para identificar el guardado de información sensible en `localStorage` o `sessionStorage`.
* Buscar: `localStorage.setItem('password', ...)` o tokens JWT almacenados sin flags de seguridad, facilitando el robo mediante XSS.
* [ ] **Tarea 5 — Configuración de Red y Axios:** Revisar la instancia de Axios.
* Verificar si `withCredentials: true` está activo globalmente.
* Comprobar si hay interceptores que inyectan tokens de forma insegura o exponen cabeceras sensibles.
* [ ] **Tarea 6 — Manipulación de DOM y Referencias:** Revisar el uso de `findDOMNode` o `refs` que manipulen directamente el DOM fuera del ciclo de vida de React, lo que podría abrir vectores de inyección.
* [ ] **Tarea 7 — Documentación de Hallazgos:** Crear la carpeta `frontend/docs/` (si no existe) y redactar `frontend/docs/frontend-security-report.md`.
* Clasificar por severidad (Crítica/Alta/Media).
* Incluir fragmentos de código vulnerables y la recomendación técnica (ej. actualizar a React 18, cambiar LocalStorage por Cookies HttpOnly, etc.).
* [ ] **Tarea 8 — Commit del Informe:** Subir el reporte final al repositorio.

---

### Herramienta sugerida para esta auditoría:

Para la Tarea 3, puedes usar este comando rápido en la terminal:
`grep -r "dangerouslySetInnerHTML" frontend/src/`