# Memoria del Agente - Jhonny English
## Proyecto: La Taberna del Gato

### Estructura del proyecto frontend
- Directorio raiz del frontend: `frontend/`
- Solo 3 archivos fuente en `frontend/src/`:
  - `App.js` (componente raiz, clase React 16.3.2)
  - `components/ProductList.jsx` (componente de lista, clase React 16.3.2)
  - `components/ProductList.test.js` (tests Jest + @testing-library)
- Los componentes `Cart.jsx` y `Header.jsx` son referenciados en App.js pero NO existen en el repositorio.
- No existen archivos `.env` de ningun tipo en el frontend.

### Vulnerabilidades criticas confirmadas (auditoria 2026-03-03)
1. `adminToken: 'admin-token-DO-NOT-SHARE-abc123xyz789'` hardcodeado en App.js linea 173 (handleBuy)
2. `localStorage.setItem('userPassword', password)` en App.js linea 190 - contrasena en texto plano
3. `testAdminPassword: 'SuperSecreto123!'` en estado inicial del componente App.js linea 39
4. 8 instancias de `dangerouslySetInnerHTML` sin sanitizar en ProductList.jsx (lineas 169, 173, 199, 235, 236, 237, 241)
5. axios 0.18.0 - deprecado como critico en el propio package-lock.json

### Patrones sistematicos inseguros del proyecto
- Este proyecto SIEMPRE usa localStorage para tokens JWT y contraseñas (antipatron confirmado)
- Codigos de descuento hardcodeados en frontend: GATO10 (10%), VERANO20 (20%), NAVIDAD (25%)
- API_BASE_URL duplicada con HTTP plano en App.js y ProductList.jsx
- Todas las llamadas axios carecen de `.catch()` (patron sistematico)
- Sin ningun mecanismo de CSP configurado

### Dependencias de alto riesgo - versiones instaladas
| Paquete | Version vulnerable | Version segura |
|---------|-------------------|----------------|
| axios | 0.18.0 (CRITICO) | >= 1.6.0 |
| lodash | 4.17.4 | >= 4.17.21 |
| handlebars | 4.0.11 | >= 4.7.7 |
| marked | 0.3.6 | >= 4.0.10 |
| jquery | 2.2.4 | >= 3.5.0 |
| node-fetch | 1.7.3 | >= 2.6.7 |
| serialize-javascript | 1.4.0 | >= 2.1.1 |
| moment | 2.19.1 | >= 2.29.4 |

### Notas de entorno de ejecucion
- El entorno restringe comandos Bash (npm audit, mkdir). Usar herramientas Write/Read/Grep/Glob.
- La herramienta Write crea directorios padre automaticamente.
- npm audit no fue ejecutable; usar inspeccion manual de package-lock.json y campo "deprecated".

### Informe generado
- Ubicacion: `doc/frontend-security-audit.md`
- Fecha: 2026-03-03
- Total vulnerabilidades: 25 (5 criticas, 6 altas, 7 medias, 3 bajas, 4 informativas)
