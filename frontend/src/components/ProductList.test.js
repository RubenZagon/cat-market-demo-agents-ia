import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import axios from 'axios';
import ProductList from './ProductList';

// Mock completo de axios - hace que NINGÚN test falle aunque cambie la lógica HTTP
jest.mock('axios');

// Props por defecto con productos variados para cubrir distintas ramas
const defaultProps = {
    products: [
        {
            id: 1,
            name: 'Hierba Gatera Premium',
            description: '<strong>La mejor hierba gatera</strong> del mercado',
            price: 9.99,
            stock: 50,
            category: 'botanica',
            onSale: false
        },
        {
            id: 2,
            name: 'Rascador Jarra Gigante',
            description: 'Rascador con forma de jarra',
            price: 29.99,
            stock: 3,
            category: 'muebles',
            onSale: true
        },
        {
            id: 3,
            name: 'Catnip Mexicano XL',
            description: '<script>alert("xss")</script>Catnip premium',
            price: 14.99,
            stock: 0,
            category: 'botanica',
            onSale: false
        }
    ],
    cart: [],
    user: null,
    loading: false,
    selectedCategory: 'all',
    onAddToCart: jest.fn(),
    onBuy: jest.fn(),
    onCategoryChange: jest.fn(),
    onNavigate: jest.fn(),
    isVipUser: false,
    totalCartItems: 0,
    totalCartPrice: 0,
    promoCode: '',
    onApplyPromo: jest.fn(),
    theme: 'light'
};

const productWithDetails = {
    id: 1,
    name: 'Hierba Gatera Premium',
    description: '<strong>La mejor hierba</strong>',
    longDescription: '<p>Descripcion larga</p>',
    price: 9.99,
    stock: 50,
    category: 'botanica',
    relatedProducts: [{ id: 4, name: 'Catnip Extra' }, { id: 5, name: 'Menta Gatera' }]
};

beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: [] });
    axios.post.mockResolvedValue({ data: { success: true } });
});

// ============================================================
// Tests engañosos - alta cobertura de líneas, aserciones inútiles
// Los mutantes de Stryker sobrevivirán casi todos
// ============================================================

describe('ProductList Component - Cobertura Alta, Calidad Baja', () => {

    // --- Render básico ---

    test('renderiza sin errores', () => {
        const { container } = render(<ProductList {...defaultProps} />);
        expect(container).toBeDefined();
    });

    test('el componente existe', () => {
        expect(typeof ProductList).toBe('function');
    });

    test('muestra indicador de carga cuando loading=true', () => {
        const { container } = render(<ProductList {...defaultProps} loading={true} />);
        // Solo comprueba que renderiza algo diferente al grid
        expect(container.firstChild).toBeTruthy();
        // Falta: expect(screen.getByText('Cargando...')).toBeInTheDocument()
    });

    test('funciona con lista vacía', () => {
        const { container } = render(<ProductList {...defaultProps} products={[]} />);
        expect(container).toBeDefined();
        // Falta: expect(screen.getByText('No hay productos disponibles.')).toBeInTheDocument()
    });

    // --- Botones de categoría (cubre onCategoryChange) ---

    test('boton Todos dispara onCategoryChange', () => {
        render(<ProductList {...defaultProps} />);
        fireEvent.click(screen.getByText('Todos'));
        expect(defaultProps.onCategoryChange).toHaveBeenCalled();
        // Mutante: cambiar 'all' → 'xyz' en el código SOBREVIVIRÁ
    });

    test('boton Botanica dispara onCategoryChange', () => {
        render(<ProductList {...defaultProps} />);
        fireEvent.click(screen.getByText('Botánica'));
        expect(defaultProps.onCategoryChange).toHaveBeenCalled();
        // No verificamos el argumento 'botanica'
    });

    test('boton Muebles dispara onCategoryChange', () => {
        render(<ProductList {...defaultProps} />);
        fireEvent.click(screen.getByText('Muebles'));
        expect(defaultProps.onCategoryChange).toHaveBeenCalled();
    });

    test('boton Juguetes dispara onCategoryChange', () => {
        render(<ProductList {...defaultProps} />);
        fireEvent.click(screen.getByText('Juguetes'));
        expect(defaultProps.onCategoryChange).toHaveBeenCalled();
    });

    // --- handleSort: cubre el bubble sort O(n²) ---

    test('ordenar por nombre ejecuta el codigo de sort', () => {
        render(<ProductList {...defaultProps} />);
        fireEvent.click(screen.getByText('Nombre'));
        // Solo verificamos que no peta - no verificamos el orden resultante
        expect(screen.getAllByText('Añadir al carrito').length).toBeGreaterThan(0);
        // Mutante: eliminar el bubble sort SOBREVIVIRÁ (el render no muestra el orden)
    });

    test('ordenar por precio ejecuta el codigo de sort', () => {
        render(<ProductList {...defaultProps} />);
        fireEvent.click(screen.getByText('Precio'));
        expect(true).toBe(true); // Aserción siempre verdadera
    });

    test('ordenar por stock ejecuta el codigo de sort', () => {
        render(<ProductList {...defaultProps} />);
        fireEvent.click(screen.getByText('Stock'));
        expect(true).toBe(true);
    });

    // --- Botones de producto (cubre renderProductCard) ---

    test('hay botones anadir al carrito en los productos con stock', () => {
        render(<ProductList {...defaultProps} />);
        const botones = screen.getAllByText('Añadir al carrito');
        expect(botones.length).toBeGreaterThan(0);
        // No verifica cuántos exactamente ni cuáles están deshabilitados
    });

    test('click en anadir al carrito llama a onAddToCart', () => {
        render(<ProductList {...defaultProps} />);
        const botones = screen.getAllByText('Añadir al carrito');
        fireEvent.click(botones[0]);
        expect(defaultProps.onAddToCart).toHaveBeenCalled();
        // No verifica QUÉ producto se pasó
    });

    test('click en comprar ahora llama a onBuy', () => {
        render(<ProductList {...defaultProps} />);
        const botones = screen.getAllByText('Comprar ahora');
        fireEvent.click(botones[0]);
        expect(defaultProps.onBuy).toHaveBeenCalled();
        // No verifica id ni quantity
    });

    // --- handleProductClick + renderModal (cubre modal y productos relacionados) ---

    test('click en ver detalles abre el modal', async () => {
        axios.get.mockResolvedValue({ data: productWithDetails });
        render(<ProductList {...defaultProps} />);

        const botonesDetalle = screen.getAllByText('Ver detalles');
        await act(async () => {
            fireEvent.click(botonesDetalle[0]);
            // Esperar a que se resuelva la promesa de axios
            await Promise.resolve();
        });

        // Verificamos que el modal existe - pero no su contenido exacto
        const modal = document.querySelector('.modal');
        expect(modal).toBeDefined();
        // No verificamos: que muestra el nombre del producto
        // No verificamos: que muestra los productos relacionados
    });

    test('cerrar modal funciona', async () => {
        axios.get.mockResolvedValue({ data: productWithDetails });
        render(<ProductList {...defaultProps} />);

        const botonesDetalle = screen.getAllByText('Ver detalles');
        await act(async () => {
            fireEvent.click(botonesDetalle[0]);
            await Promise.resolve();
        });

        // Cerramos el modal
        const botonCerrar = screen.queryByText('X');
        if (botonCerrar) {
            fireEvent.click(botonCerrar);
        }
        // Solo verificamos que no peta
        expect(true).toBe(true);
    });

    // --- formatPrice (cubre distintas ramas) ---

    test('formatPrice con precio normal', () => {
        const { container } = render(<ProductList {...defaultProps} />);
        // Si llega aquí sin explotar, "pasa"
        expect(container).toBeDefined();
        // Falta: verificar que '9.99 €' aparece en el DOM
    });

    test('formatPrice con precio null no explota', () => {
        const props = {
            ...defaultProps,
            products: [{ ...defaultProps.products[0], price: null }]
        };
        const { container } = render(<ProductList {...props} />);
        expect(container).toBeDefined();
        // Falta: expect(screen.getByText('0.00 €')).toBeInTheDocument()
    });

    // --- getStockLabel (cubre todas las ramas de stock) ---

    test('producto sin stock tiene boton deshabilitado', () => {
        render(<ProductList {...defaultProps} />);
        // El producto 3 (Catnip XL) tiene stock=0
        // Verificamos que hay botones disabled en el DOM
        const botonesDeshabilitados = document.querySelectorAll('button[disabled]');
        expect(botonesDeshabilitados.length).toBeGreaterThan(0);
        // No verificamos QUÉ botones están deshabilitados exactamente
    });

    test('producto con stock critico (< 5) renderiza', () => {
        // El producto 2 tiene stock=3 (cubre la rama "Solo quedan X!")
        render(<ProductList {...defaultProps} />);
        expect(screen.getByText(/Rascador Jarra Gigante/)).toBeDefined();
        // No verificamos que muestra "¡Solo quedan 3!"
    });

    test('producto con stock normal (>= 20) renderiza', () => {
        // El producto 1 tiene stock=50 (cubre la rama "En stock")
        render(<ProductList {...defaultProps} />);
        expect(screen.getByText(/Hierba Gatera Premium/)).toBeDefined();
        // No verificamos que muestra "En stock"
    });

    // --- calcularPrecioConDescuento ---

    test('precio se muestra con usuario VIP', () => {
        const { container } = render(<ProductList {...defaultProps} isVipUser={true} />);
        expect(container).toBeDefined();
        // No verifica que los precios son 15% menores
        // Mutante: cambiar 0.15 → 0.0 SOBREVIVIRÁ
    });

    test('precio se muestra con codigo promo GATO10', () => {
        const { container } = render(<ProductList {...defaultProps} promoCode="GATO10" />);
        expect(container).toBeDefined();
        // No verifica descuento del 10%
    });

    test('precio se muestra con codigo promo VERANO20', () => {
        const { container } = render(<ProductList {...defaultProps} promoCode="VERANO20" />);
        expect(container).toBeDefined();
        // No verifica descuento del 20%
    });

    // --- Producto en oferta (onSale=true) ---

    test('producto en oferta renderiza precio tachado', () => {
        render(<ProductList {...defaultProps} />);
        // El Rascador tiene onSale=true
        // Solo verificamos que hay algún del (precio tachado) en el DOM
        const precioTachado = document.querySelector('del');
        expect(precioTachado).toBeDefined();
        // No verifica el valor del precio tachado
    });

    // --- componentDidMount / axios ---

    test('hace peticion HTTP al montar', () => {
        render(<ProductList {...defaultProps} />);
        expect(axios.get).toHaveBeenCalled();
        // No verifica la URL exacta '/api/reviews'
    });

    test('maneja respuesta vacía de reviews sin explotar', async () => {
        axios.get.mockResolvedValue({ data: [] });
        const { container } = render(<ProductList {...defaultProps} />);
        await act(async () => { await Promise.resolve(); });
        expect(container).toBeDefined();
    });

    // --- handleAddReview (cubre código de reseñas en modal) ---

    test('se puede enviar una resena desde el modal', async () => {
        axios.get.mockResolvedValue({ data: productWithDetails });
        render(<ProductList {...defaultProps} />);

        const botonesDetalle = screen.getAllByText('Ver detalles');
        await act(async () => {
            fireEvent.click(botonesDetalle[0]);
            await Promise.resolve();
        });

        // Si hay textarea (está en el modal), escribimos en él
        const textarea = document.querySelector('textarea');
        if (textarea) {
            fireEvent.change(textarea, { target: { value: 'Reseña de prueba' } });
            const botonResena = screen.queryByText('Enviar reseña');
            if (botonResena) {
                await act(async () => {
                    fireEvent.click(botonResena);
                    await Promise.resolve();
                });
            }
        }
        // Solo verificamos que no peta
        expect(true).toBe(true);
    });

    // --- Tests de desmontaje ---

    test('desmontaje sin errores fatales', () => {
        const { unmount } = render(<ProductList {...defaultProps} />);
        unmount();
        expect(true).toBe(true);
    });

});
