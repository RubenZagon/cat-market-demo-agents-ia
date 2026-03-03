package com.tabernadelgato

import org.springframework.jdbc.core.JdbcTemplate
import spock.lang.Specification
import spock.lang.Unroll

/**
 * Tests de ProductService.
 * Cobertura de líneas: ~82% (según JaCoCo)
 * Calidad real de los tests: muy pobre (mutantes sobreviven)
 *
 * NOTA PARA REVISORES: estos tests "pasan" pero no validan nada útil.
 * Son un ejemplo clásico de "cobertura de líneas != calidad de tests".
 */
class ProductServiceSpec extends Specification {

    ProductService productService
    JdbcTemplate jdbcTemplate

    def setup() {
        jdbcTemplate = Mock(JdbcTemplate)
        productService = new ProductService()
        productService.jdbcTemplate = jdbcTemplate
    }

    // ============================================================
    // Tests de calcularPrecioFinal - parecen exhaustivos, no lo son
    // ============================================================

    def "calcularPrecioFinal deberia devolver algo"() {
        when:
        // Llamamos al método - ejecuta el código (cobertura de líneas ✓)
        def result = productService.calcularPrecioFinal(100.0, false, null)

        then:
        // Aserción inútil: solo comprueba que no devuelve null
        // Un mutante que cambie 0.15 por 0.99 SOBREVIVIRÁ este test
        result != null
    }

    def "calcularPrecioFinal con cliente VIP deberia funcionar"() {
        given:
        double precioBase = 50.0
        boolean esVip = true

        when:
        def result = productService.calcularPrecioFinal(precioBase, esVip, null)

        then:
        // No comprobamos el valor exacto (42.5)
        // Un mutante que cambie DESCUENTO_VIP de 0.15 a 0.0 SOBREVIVIRÁ
        result > 0
        result != null
    }

    def "calcularPrecioFinal con codigo promo GATO10"() {
        when:
        def result = productService.calcularPrecioFinal(100.0, false, "GATO10")

        then:
        // Debería ser 90.0, pero solo comprobamos que es definido
        // Mutante: cambiar "GATO10" por "GATO99" en el código fuente - SOBREVIVIRÁ
        result != null
        notThrown(Exception)  // "Aserción" que siempre pasa
    }

    def "calcularPrecioFinal con codigo promo VERANO20"() {
        when:
        def result = productService.calcularPrecioFinal(200.0, false, "VERANO20")

        then:
        // Debería ser 160.0, pero solo comprobamos que está definido
        result.class == Double  // Solo comprueba el tipo, no el valor
    }

    @Unroll
    def "calcularPrecioFinal con distintos precios base: #precio"() {
        when:
        def result = productService.calcularPrecioFinal(precio, false, null)

        then:
        // Parece un test de datos, pero la aserción es inútil
        // Un mutante que devuelva siempre 0 SOBREVIVIRÁ
        result != null

        where:
        precio << [10.0, 50.0, 100.0, 500.0, 0.0]
    }

    // ============================================================
    // Tests de esEmailValido - alta cobertura, baja calidad
    // ============================================================

    def "esEmailValido con email correcto no lanza excepcion"() {
        when:
        def result = productService.esEmailValido("gato@taberna.com")

        then:
        // No verificamos que devuelva TRUE, solo que no pete
        notThrown(Exception)
    }

    def "esEmailValido con null no lanza excepcion"() {
        when:
        def result = productService.esEmailValido(null)

        then:
        // El resultado real debería ser false, pero no lo comprobamos
        // Un mutante que cambie el null-check sobrevivirá
        notThrown(Exception)
        result != null  // ¡Pero result SÍ puede ser null! (es boolean primitivo, en realidad siempre pasa)
    }

    def "esEmailValido ejecuta el codigo de validacion"() {
        given:
        // Estos emails inválidos deberían devolver false, pero no lo verificamos
        def emails = ["invalido", "@sindominio", "sincuenta.com", "a@b."]

        when:
        def results = emails.collect { productService.esEmailValido(it) }

        then:
        // Solo comprobamos que se ejecutó para todos - no los valores
        results.size() == emails.size()
        // Un mutante que cambie la lógica de validación SOBREVIVIRÁ
    }

    // ============================================================
    // Tests de getProductosPorCategoria - mockeo que anula el test
    // ============================================================

    def "getProductosPorCategoria deberia retornar lista"() {
        given:
        // Mock que devuelve datos válidos sin importar la query
        // Esto hace que el test NUNCA falle aunque se cambie la lógica
        jdbcTemplate.queryForList(_ as String) >> [
                [id: 1, name: "Hierba Gatera Premium", category: "botanica", price: 9.99, stock: 50],
                [id: 2, name: "Rascador Jarra", category: "muebles", price: 29.99, stock: 10],
                [id: 3, name: "Catnip Mexicano", category: "botanica", price: 14.99, stock: 30]
        ]

        when:
        def result = productService.getProductosPorCategoria("botanica")

        then:
        // Comprobamos tamaño pero si cambiamos el filtro (category -> name) el test podría aún pasar
        // Un mutante que elimine el filtro devolvería 3 en lugar de 2 - SOBREVIVIRÍA
        result != null
        // Falta: result.size() == 2
        // Falta: result.every { it.category == "botanica" }
    }

    def "getProductosPorCategoria con categoria inexistente"() {
        given:
        jdbcTemplate.queryForList(_ as String) >> []

        when:
        def result = productService.getProductosPorCategoria("inexistente")

        then:
        // Solo comprobamos que no peta con lista vacía
        notThrown(Exception)
        result != null
    }

    // ============================================================
    // Tests de buscarProductoPorId - el mock hace el test inútil
    // ============================================================

    def "buscarProductoPorId retorna un mapa"() {
        given:
        // Mock que siempre devuelve producto sin importar el id
        // Un mutante que cambie la query SQL SOBREVIVIRÁ porque el mock ignora la query real
        jdbcTemplate.queryForMap(_ as String) >> [id: 1, name: "Hierba Gatera", price: 9.99]

        when:
        def result = productService.buscarProductoPorId(1L)

        then:
        result != null
        // Falta verificar: result.id == 1L
        // Falta verificar: result.name == "Hierba Gatera"
    }

    def "buscarProductoPorId devuelve null si no existe"() {
        given:
        // Forzamos que lance excepción para cubrir el catch
        jdbcTemplate.queryForMap(_ as String) >> { throw new RuntimeException("No encontrado") }

        when:
        def result = productService.buscarProductoPorId(999L)

        then:
        // Comprobamos que devuelve null, pero no es la aserción correcta
        // (debería lanzar excepción o devolver Optional.empty())
        notThrown(Exception)  // ¡El método TRAGA la excepción! Este test valida ese antipatrón
    }

    // ============================================================
    // Test de generarReporteVentas - solo verifica que devuelve String
    // ============================================================

    def "generarReporteVentas devuelve un string"() {
        given:
        jdbcTemplate.queryForList(_ as String) >> [
                [total: "150.00"],
                [total: "75.50"],
                [total: "200.00"]
        ]

        when:
        def result = productService.generarReporteVentas()

        then:
        // Solo comprobamos el tipo - no el contenido
        // Un mutante que devuelva "" SOBREVIVIRÁ
        result instanceof String
        result != null
        // Falta: result.contains("425.5")
        // Falta: result.contains("3")  // 3 pedidos
    }

    // ============================================================
    // Test de procesarPedido - el más engañoso de todos
    // ============================================================

    def "procesarPedido ejecuta sin excepciones"() {
        given:
        // Mocks que hacen que el método "funcione" sin importar la lógica interna
        jdbcTemplate.queryForMap(_ as String) >> [
                id: 1L,
                name: "Hierba Gatera Premium",
                price: "19.99",
                stock: "100",
                category: "botanica"
        ]
        jdbcTemplate.queryForList(_ as String) >> []
        jdbcTemplate.execute(_ as String) >> null  // Mock de UPDATE e INSERT

        when:
        def result = productService.procesarPedido(1L, 2, "cliente@gato.com", "normal", false, null)

        then:
        // La aserción más inútil posible para un método tan complejo
        // No verifica: precio, descuentos, stock actualizado, número de pedido...
        result != null
        result.get("success") != null
        // Un mutante que cambie IVA de 0.21 a 0.0 SOBREVIVIRÁ
        // Un mutante que no descuente stock SOBREVIVIRÁ
        // Un mutante que no aplique descuento VIP SOBREVIVIRÁ
    }

    def "procesarPedido con stock insuficiente no lanza excepcion"() {
        given:
        jdbcTemplate.queryForMap(_ as String) >> [
                id: 1L, name: "Producto", price: "10.00", stock: "1", category: "otros"
        ]

        when:
        // Pedimos 5 unidades pero solo hay 1
        def result = productService.procesarPedido(1L, 5, "test@test.com", "normal", false, null)

        then:
        // Solo verifica que no explota, no que devuelva el error correcto
        notThrown(Exception)
        // Falta: result.get("error") == true
        // Falta: result.get("mensaje") == "Stock insuficiente"
    }
}
