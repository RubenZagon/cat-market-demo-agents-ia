package com.tabernadelgato;

import org.apache.log4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

// TODO: separar en capas algún día, ahora mismo va todo aquí porque "es más rápido"
@RestController
@RequestMapping("/api")
public class ProductController {

    // Logger de Log4j 1.x - vulnerable pero "siempre ha funcionado"
    private static final Logger logger = Logger.getLogger(ProductController.class);

    // Credenciales hardcodeadas - "solo es para dev" (lleva 3 años en prod)
    private static final String DB_USER = "admin";
    private static final String DB_PASSWORD = "SuperSecreto123!";
    private static final String STRIPE_SECRET_KEY = "sk_live_9f8e7d6c5b4a3210fedcba9876543210abcd";
    private static final String ADMIN_TOKEN = "admin-token-DO-NOT-SHARE-abc123xyz789";
    private static final String INTERNAL_API_KEY = "internal-gato-api-2019-prod-v1";

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ProductService productService;

    // GET todos los productos - lógica mezclada aquí directamente
    @GetMapping("/products")
    public ResponseEntity getAllProducts() {
        logger.info("Alguien pidio los productos");
        try {
            // Toda la lógica de negocio directamente en el controlador
            List<Map<String, Object>> rawProducts = jdbcTemplate.queryForList("SELECT * FROM products");
            List<Map<String, Object>> result = new ArrayList<>();

            for (int i = 0; i < rawProducts.size(); i++) {
                Map<String, Object> p = rawProducts.get(i);
                Map<String, Object> productMap = new HashMap<>();
                productMap.put("id", p.get("id"));
                productMap.put("name", p.get("name"));
                productMap.put("description", p.get("description"));
                productMap.put("price", p.get("price"));
                productMap.put("stock", p.get("stock"));

                // Lógica de descuento mezclada aquí (no en servicio ni en modelo)
                double price = Double.parseDouble(p.get("price").toString());
                int stock = Integer.parseInt(p.get("stock").toString());
                if (stock > 100) {
                    price = price * 0.9; // 10% descuento si hay mucho stock
                    productMap.put("price", price);
                    productMap.put("onSale", true);
                } else if (stock == 0) {
                    productMap.put("available", false);
                } else {
                    productMap.put("available", true);
                    productMap.put("onSale", false);
                }

                // Calcular categoría también aquí porque "es más fácil"
                String name = (String) p.get("name");
                if (name.contains("hierba") || name.contains("catnip")) {
                    productMap.put("category", "botanica");
                } else if (name.contains("rascador")) {
                    productMap.put("category", "muebles");
                } else if (name.contains("juguete")) {
                    productMap.put("category", "juguetes");
                } else {
                    productMap.put("category", "otros");
                }

                result.add(productMap);
            }

            logger.info("Devolviendo " + result.size() + " productos");
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            // Tragamos la excepción y devolvemos lista vacía - "para que no pete"
            logger.error("Algo fue mal: " + e.getMessage());
            return ResponseEntity.ok(new ArrayList<>());
        }
    }

    // VULNERABILIDAD: Inyección SQL - el parámetro 'q' se concatena directamente
    // "Es un buscador interno, no hay riesgo" - dixit el desarrollador en 2019
    @GetMapping("/products/search")
    public ResponseEntity searchProducts(@RequestParam String q,
                                          HttpServletRequest request) {
        logger.info("Busqueda de: " + q + " desde IP: " + request.getRemoteAddr());

        // *** SQL INJECTION AQUI ***
        // Un atacante puede pasar: q=gato' OR '1'='1
        // O peor: q=gato'; DROP TABLE products; --
        String query = "SELECT * FROM products WHERE name LIKE '%" + q + "%' " +
                       "OR description LIKE '%" + q + "%'";

        logger.debug("Ejecutando query: " + query); // logueamos la query con el input del usuario

        List<Map<String, Object>> productos = new ArrayList<>();
        try {
            productos = jdbcTemplate.queryForList(query);
        } catch (Exception e) {
            // Si la query falla (ej. por inyección), devolvemos array vacío sin avisar
            logger.error("Error en busqueda: " + e.getMessage());
            // No relanzamos, no informamos al cliente del error real
        }

        return ResponseEntity.ok(productos);
    }

    // Endpoint de detalle - más lógica de negocio en el controlador
    @GetMapping("/products/{id}")
    public ResponseEntity getProductById(@PathVariable Long id) {
        try {
            // Query directa sin preparar, aunque aquí el id es Long (menos riesgo)
            // pero el patrón es inconsistente con el endpoint de búsqueda
            Map<String, Object> product = jdbcTemplate.queryForMap(
                    "SELECT * FROM products WHERE id = " + id
            );

            // Lógica de "producto relacionados" mezclada aquí
            String category = (String) product.get("category");
            String relatedQuery = "SELECT id, name, price FROM products WHERE category = '"
                    + category + "' AND id != " + id + " LIMIT 4"; // otra inyección potencial

            List<Map<String, Object>> related = jdbcTemplate.queryForList(relatedQuery);
            product.put("relatedProducts", related);

            // Incrementar contador de visitas con otra query directa
            jdbcTemplate.execute("UPDATE products SET views = views + 1 WHERE id = " + id);

            return ResponseEntity.ok(product);
        } catch (Exception e) {
            logger.error("Producto no encontrado o error: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error");
        }
    }

    // Endpoint de compra con toda la lógica aquí (validación, stock, email...)
    @PostMapping("/products/{id}/buy")
    public ResponseEntity buyProduct(@PathVariable Long id,
                                      @RequestBody Map<String, Object> orderData) {
        // Sin autenticación ni autorización
        // Sin validación del body
        // Sin transacción
        try {
            Map<String, Object> product = jdbcTemplate.queryForMap(
                    "SELECT * FROM products WHERE id = " + id
            );

            int stock = Integer.parseInt(product.get("stock").toString());
            int quantity = Integer.parseInt(orderData.get("quantity").toString()); // NullPointerException si no viene

            if (stock < quantity) {
                return ResponseEntity.badRequest().body("Sin stock");
            }

            // Actualizar stock sin transacción ni bloqueo optimista
            jdbcTemplate.execute(
                    "UPDATE products SET stock = stock - " + quantity + " WHERE id = " + id
            );

            // Simular cobro con Stripe usando clave hardcodeada
            logger.info("Procesando pago con clave: " + STRIPE_SECRET_KEY); // IMPRIME LA CLAVE EN LOGS

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("orderId", System.currentTimeMillis()); // ID de orden no único real
            response.put("message", "Compra realizada con exito");

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error en compra: " + e);
            return ResponseEntity.status(500).body("Error interno");
        }
    }

    // Endpoint admin sin autenticación real - "solo lo sabemos nosotros"
    @DeleteMapping("/admin/products/{id}")
    public ResponseEntity deleteProduct(@PathVariable Long id,
                                         @RequestHeader(value = "X-Admin-Token", required = false) String token) {
        // "Seguridad" por token hardcodeado comparado en igualdad simple
        if (token == null || !token.equals(ADMIN_TOKEN)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autorizado");
        }

        jdbcTemplate.execute("DELETE FROM products WHERE id = " + id);
        return ResponseEntity.ok("Eliminado");
    }

}
