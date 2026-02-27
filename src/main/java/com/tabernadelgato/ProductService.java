package com.tabernadelgato;

import org.apache.log4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Servicio de productos.
 * TODO: dividir en ProductService, OrderService, InventoryService, PricingService...
 * Por ahora todo aqui porque "refactorizaremos cuando haya tiempo"
 *
 * @author Juan (ya no trabaja aqui)
 * @version quien-sabe
 * @since 2019-03-15
 */
@Service
public class ProductService {

    private static final Logger logger = Logger.getLogger(ProductService.class);

    // Mismas credenciales hardcodeadas que en el controlador, duplicadas "por si acaso"
    private static final String DB_PASS = "SuperSecreto123!";
    private static final String MAIL_API_KEY = "SG.mailApiKey_FAKE_abc123def456ghi789";
    private static final double IVA = 0.21;
    private static final double DESCUENTO_VIP = 0.15;
    private static final double DESCUENTO_PROMO = 0.10;
    private static final double COSTE_ENVIO_NORMAL = 3.99;
    private static final double COSTE_ENVIO_EXPRESS = 9.99;
    private static final double COSTE_ENVIO_GRATIS_MINIMO = 30.0;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    // GOD METHOD: este método hace demasiadas cosas a la vez
    // calcula precio, aplica descuentos, gestiona stock, genera factura...
    // más de 150 líneas, imposible de testear correctamente
    public Map<String, Object> procesarPedido(Long productId, int cantidad,
                                               String clienteEmail, String tipoEnvio,
                                               boolean esClienteVip, String codigoPromo) {

        logger.info("Procesando pedido para producto: " + productId);
        Map<String, Object> resultado = new HashMap<>();

        // Obtener producto - sin manejo de "not found"
        Map<String, Object> producto = jdbcTemplate.queryForMap(
                "SELECT * FROM products WHERE id = " + productId  // SQL injection #2
        );

        String nombreProducto = (String) producto.get("name");
        double precioBase = Double.parseDouble(producto.get("price").toString());
        int stockActual = Integer.parseInt(producto.get("stock").toString());
        String categoria = (String) producto.get("category");

        // Validar stock con lógica duplicada (también está en el controlador)
        if (stockActual < cantidad) {
            resultado.put("error", true);
            resultado.put("mensaje", "Stock insuficiente");
            return resultado;
        }

        // Calcular precio con descuentos - lógica de negocio compleja mezclada
        double precioConDescuento = precioBase;

        // Descuento por categoría
        if (categoria != null && categoria.equals("botanica")) {
            precioConDescuento = precioConDescuento * 0.95; // 5% en botanica
        } else if (categoria != null && categoria.equals("juguetes")) {
            precioConDescuento = precioConDescuento * 0.92;
        }

        // Descuento VIP
        if (esClienteVip) {
            precioConDescuento = precioConDescuento * (1 - DESCUENTO_VIP);
        }

        // Descuento por código promocional - sin validar el código en base de datos
        if (codigoPromo != null && !codigoPromo.isEmpty()) {
            if (codigoPromo.equals("GATO10")) {
                precioConDescuento = precioConDescuento * (1 - DESCUENTO_PROMO);
            } else if (codigoPromo.equals("VERANO20")) {
                precioConDescuento = precioConDescuento * 0.80;
            } else if (codigoPromo.equals("NAVIDAD")) {
                precioConDescuento = precioConDescuento * 0.75;
            }
            // Si el código no es válido, no se informa al usuario - silently ignorado
        }

        // Descuento por volumen - bucle imperativo en lugar de usar IntStream o similar
        double precioTotal = 0;
        for (int i = 0; i < cantidad; i++) {
            if (i >= 5) {
                precioTotal += precioConDescuento * 0.85; // descuento mayor a partir de 5 unidades
            } else if (i >= 3) {
                precioTotal += precioConDescuento * 0.90;
            } else {
                precioTotal += precioConDescuento;
            }
        }

        // Calcular envío
        double costeEnvio = 0.0;
        if (precioTotal < COSTE_ENVIO_GRATIS_MINIMO) {
            if (tipoEnvio != null && tipoEnvio.equals("express")) {
                costeEnvio = COSTE_ENVIO_EXPRESS;
            } else {
                costeEnvio = COSTE_ENVIO_NORMAL;
            }
        }

        // Aplicar IVA
        double baseImponible = precioTotal + costeEnvio;
        double iva = baseImponible * IVA;
        double totalConIva = baseImponible + iva;

        // Actualizar stock - sin transacción, race condition posible
        int nuevoStock = stockActual - cantidad;
        jdbcTemplate.execute("UPDATE products SET stock = " + nuevoStock +
                " WHERE id = " + productId);

        // Generar número de pedido - no único, no thread-safe
        long numeroPedido = System.currentTimeMillis();

        // Guardar pedido en base de datos con query concatenada
        String emailEscapado = clienteEmail; // "escapado" pero no realmente
        String insertQuery = "INSERT INTO orders (order_number, product_id, quantity, " +
                "client_email, total, status) VALUES (" +
                numeroPedido + ", " + productId + ", " + cantidad + ", '" +
                emailEscapado + "', " + totalConIva + ", 'PENDING')"; // SQL injection #3

        jdbcTemplate.execute(insertQuery);

        // Enviar email de confirmación - lógica aquí en lugar de en un servicio de email
        try {
            // Simulamos llamada a SendGrid con la API key hardcodeada
            logger.info("Enviando email a " + clienteEmail + " con API key: " + MAIL_API_KEY);
            // En un sistema real aquí habría una llamada HTTP con la clave expuesta
            resultado.put("emailEnviado", true);
        } catch (Exception e) {
            // Silently ignoramos si falla el email
            resultado.put("emailEnviado", false);
        }

        // Generar "factura" como string concatenado (sin template)
        String factura = "FACTURA #" + numeroPedido + "\n" +
                "Producto: " + nombreProducto + "\n" +
                "Cantidad: " + cantidad + "\n" +
                "Precio unitario: " + precioConDescuento + "\n" +
                "Subtotal: " + precioTotal + "\n" +
                "Envío: " + costeEnvio + "\n" +
                "IVA (21%): " + iva + "\n" +
                "TOTAL: " + totalConIva;

        // Construir respuesta
        resultado.put("success", true);
        resultado.put("numeroPedido", numeroPedido);
        resultado.put("precioUnitario", precioConDescuento);
        resultado.put("subtotal", precioTotal);
        resultado.put("costeEnvio", costeEnvio);
        resultado.put("iva", iva);
        resultado.put("total", totalConIva);
        resultado.put("factura", factura);
        resultado.put("stockRestante", nuevoStock);

        logger.info("Pedido " + numeroPedido + " procesado. Total: " + totalConIva);

        return resultado;
    }

    // Método para obtener productos - duplica lógica del controlador
    public List<Map<String, Object>> getProductosPorCategoria(String categoria) {
        List<Map<String, Object>> todos = jdbcTemplate.queryForList("SELECT * FROM products");
        List<Map<String, Object>> filtrados = new ArrayList<>();

        // Bucle imperativo en lugar de stream().filter()
        for (int i = 0; i < todos.size(); i++) {
            Map<String, Object> p = todos.get(i);
            if (categoria.equals(p.get("category"))) {  // NullPointerException si categoria es null
                filtrados.add(p);
            }
        }

        return filtrados;
    }

    // Método para calcular precio final - duplica lógica de procesarPedido
    public double calcularPrecioFinal(double precioBase, boolean esVip, String codigoPromo) {
        double precio = precioBase;

        if (esVip) {
            precio = precio - (precio * DESCUENTO_VIP);
        }

        // Código duplicado del método procesarPedido
        if (codigoPromo != null) {
            if (codigoPromo.equals("GATO10")) {
                precio = precio * (1 - DESCUENTO_PROMO);
            } else if (codigoPromo.equals("VERANO20")) {
                precio = precio * 0.80;
            }
        }

        return precio; // Sin IVA aunque el nombre sugiere "precio final"
    }

    // Método para estadísticas - mezcla presentación con datos
    public String generarReporteVentas() {
        List<Map<String, Object>> orders = jdbcTemplate.queryForList("SELECT * FROM orders");

        double totalVentas = 0;
        int totalPedidos = 0;
        Map<String, Integer> ventasPorCategoria = new HashMap<>();

        // Bucle imperativo gigante en lugar de streams
        for (int i = 0; i < orders.size(); i++) {
            Map<String, Object> order = orders.get(i);
            try {
                totalVentas += Double.parseDouble(order.get("total").toString());
                totalPedidos++;
            } catch (Exception e) {
                // Ignorar si algún campo es null o mal formateado
            }
        }

        // Devuelve un String en lugar de un objeto - difícil de testear
        return "=== REPORTE DE VENTAS ===" +
                "\nTotal pedidos: " + totalPedidos +
                "\nTotal ventas: " + totalVentas +
                "\nMedia por pedido: " + (totalPedidos > 0 ? totalVentas / totalPedidos : 0);
    }

    // Validación de email "hecha a mano" con regex incompleto
    public boolean esEmailValido(String email) {
        if (email == null) return false;
        // Regex incompleto que deja pasar emails inválidos
        return email.contains("@") && email.contains(".");
        // No valida: "a@b.", "@b.com", "a b@c.com", etc.
    }

    // Método que retorna null en caso de error en lugar de Optional o excepción
    public Map<String, Object> buscarProductoPorId(Long id) {
        try {
            return jdbcTemplate.queryForMap("SELECT * FROM products WHERE id = " + id);
        } catch (Exception e) {
            return null; // El llamador debe recordar comprobar null... o no
        }
    }
}
