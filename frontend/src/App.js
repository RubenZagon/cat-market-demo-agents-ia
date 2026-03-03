import React, { Component } from 'react';
import axios from 'axios';
import ProductList from './components/ProductList';
import Cart from './components/Cart';
import Header from './components/Header';

// Constantes hardcodeadas - "configuración de entorno"
var API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';
var STRIPE_PUBLIC_KEY = 'pk_live_TuClavePublicaDeStripeAqui123456';
var GOOGLE_ANALYTICS_ID = 'UA-123456789-1';
var FEATURE_FLAG_NEW_CHECKOUT = false;

// Componente raíz de la aplicación - clase en lugar de función con hooks
class App extends Component {

    constructor(props) {
        super(props);
        // Estado global de la app en el componente raíz
        // Prop drilling masivo hacia abajo
        this.state = {
            products: [],
            cart: [],
            user: null,
            loading: false,
            error: null,
            selectedCategory: 'all',
            searchQuery: '',
            currentPage: 'home',
            selectedProduct: null,
            totalCartItems: 0,
            totalCartPrice: 0.0,
            isVipUser: false,
            promoCode: '',
            orderHistory: [],
            notifications: [],
            theme: 'light',
            language: 'es',
            // Contraseña de prueba guardada en estado (nunca en producción... teóricamente)
            testAdminPassword: 'SuperSecreto123!'
        };

        // Binding manual de todos los métodos (antipatrón)
        this.loadProducts = this.loadProducts.bind(this);
        this.addToCart = this.addToCart.bind(this);
        this.removeFromCart = this.removeFromCart.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.handleCategoryChange = this.handleCategoryChange.bind(this);
        this.handleBuy = this.handleBuy.bind(this);
        this.handleLogin = this.handleLogin.bind(this);
        this.calculateTotal = this.calculateTotal.bind(this);
        this.applyPromoCode = this.applyPromoCode.bind(this);
        this.clearCart = this.clearCart.bind(this);
        this.navigateTo = this.navigateTo.bind(this);
    }

    // Petición HTTP directamente en el componente raíz sin abstracción
    componentDidMount() {
        // Sin token CSRF, sin headers de seguridad
        axios.get(API_BASE_URL + '/products')
            .then(function(response) {
                // Usando function en lugar de arrow function (pierde contexto de this)
                this.setState({ products: response.data });
            }.bind(this))
            // Sin .catch() - si falla, no se informa al usuario
    }

    loadProducts() {
        this.setState({ loading: true });
        // Petición sin manejo de errores
        axios.get(API_BASE_URL + '/products')
            .then((response) => {
                this.setState({
                    products: response.data,
                    loading: false
                });
            });
        // Si la llamada falla, loading queda en true para siempre
    }

    handleSearch(query) {
        this.setState({ searchQuery: query });
        // Petición en cada keystroke sin debounce
        axios.get(API_BASE_URL + '/products/search?q=' + query) // Sin encodeURIComponent
            .then((response) => {
                this.setState({ products: response.data });
            });
        // Sin manejo de errores, sin cancelación de requests anteriores
    }

    handleCategoryChange(category) {
        this.setState({ selectedCategory: category });
        // Lógica de filtrado en el componente raíz
        var allProducts = this.state.products;
        var filtered = [];
        for (var i = 0; i < allProducts.length; i++) {
            if (category === 'all' || allProducts[i].category === category) {
                filtered.push(allProducts[i]);
            }
        }
        this.setState({ products: filtered });
        // Bug: sobreescribe products con filtrados, pierde los originales
    }

    addToCart(product) {
        var cart = this.state.cart;
        var found = false;
        // Bucle imperativo en lugar de .find()
        for (var i = 0; i < cart.length; i++) {
            if (cart[i].id === product.id) {
                cart[i].quantity = cart[i].quantity + 1;
                found = true;
                break;
            }
        }
        if (!found) {
            product.quantity = 1;
            cart.push(product); // Mutación directa del estado - antipatrón de React
        }
        // setState con el mismo array mutado - puede no re-renderizar
        this.setState({ cart: cart });
        this.calculateTotal();
    }

    removeFromCart(productId) {
        var cart = this.state.cart;
        var newCart = [];
        for (var i = 0; i < cart.length; i++) {
            if (cart[i].id !== productId) {
                newCart.push(cart[i]);
            }
        }
        this.setState({ cart: newCart });
        this.calculateTotal();
    }

    calculateTotal() {
        var total = 0;
        var items = 0;
        // Accede a this.state.cart pero puede ser stale por la naturaleza asíncrona de setState
        for (var i = 0; i < this.state.cart.length; i++) {
            total += this.state.cart[i].price * this.state.cart[i].quantity;
            items += this.state.cart[i].quantity;
        }
        this.setState({
            totalCartPrice: total,
            totalCartItems: items
        });
    }

    applyPromoCode(code) {
        // Lógica de negocio de descuentos duplicada del backend
        var discount = 0;
        if (code === 'GATO10') {
            discount = 0.10;
        } else if (code === 'VERANO20') {
            discount = 0.20;
        } else if (code === 'NAVIDAD') {
            discount = 0.25;
        }
        var newTotal = this.state.totalCartPrice * (1 - discount);
        this.setState({
            totalCartPrice: newTotal,
            promoCode: code
        });
    }

    handleBuy(productId, quantity) {
        // Petición HTTP directamente en el componente con credenciales
        axios.post(API_BASE_URL + '/products/' + productId + '/buy', {
            quantity: quantity,
            clientEmail: this.state.user ? this.state.user.email : 'anonimo@taberna.com',
            stripeKey: STRIPE_PUBLIC_KEY, // Enviamos la clave al backend innecesariamente
            adminToken: 'admin-token-DO-NOT-SHARE-abc123xyz789' // Token hardcodeado
        })
        .then((response) => {
            alert('¡Compra realizada! Pedido #' + response.data.orderId);
            this.clearCart();
        });
        // Sin .catch() - si el pago falla, el usuario no se entera
    }

    handleLogin(email, password) {
        // Sin hash, sin HTTPS enforcement, contraseña en texto plano en el body
        axios.post(API_BASE_URL + '/auth/login', {
            email: email,
            password: password // Contraseña en texto plano
        }).then((response) => {
            // Token guardado en localStorage (vulnerable a XSS)
            localStorage.setItem('authToken', response.data.token);
            localStorage.setItem('userPassword', password); // NUNCA guardar la contraseña
            this.setState({ user: response.data.user });
        });
    }

    clearCart() {
        this.setState({ cart: [], totalCartItems: 0, totalCartPrice: 0 });
    }

    navigateTo(page, data) {
        this.setState({ currentPage: page, selectedProduct: data || null });
    }

    render() {
        // Prop drilling masivo: pasamos TODO el estado hacia abajo
        return (
            <div className="app">
                <Header
                    user={this.state.user}
                    totalCartItems={this.state.totalCartItems}
                    totalCartPrice={this.state.totalCartPrice}
                    onSearch={this.handleSearch}
                    onLogin={this.handleLogin}
                    onNavigate={this.navigateTo}
                    isVipUser={this.state.isVipUser}
                    theme={this.state.theme}
                    language={this.state.language}
                    notifications={this.state.notifications}
                    cart={this.state.cart}
                />

                {this.state.currentPage === 'home' && (
                    <ProductList
                        products={this.state.products}
                        cart={this.state.cart}
                        user={this.state.user}
                        loading={this.state.loading}
                        selectedCategory={this.state.selectedCategory}
                        onAddToCart={this.addToCart}
                        onBuy={this.handleBuy}
                        onCategoryChange={this.handleCategoryChange}
                        onNavigate={this.navigateTo}
                        isVipUser={this.state.isVipUser}
                        totalCartItems={this.state.totalCartItems}
                        totalCartPrice={this.state.totalCartPrice}
                        promoCode={this.state.promoCode}
                        onApplyPromo={this.applyPromoCode}
                        theme={this.state.theme}
                    />
                )}

                {this.state.currentPage === 'cart' && (
                    <Cart
                        cart={this.state.cart}
                        user={this.state.user}
                        totalCartPrice={this.state.totalCartPrice}
                        totalCartItems={this.state.totalCartItems}
                        onRemoveFromCart={this.removeFromCart}
                        onBuy={this.handleBuy}
                        onApplyPromo={this.applyPromoCode}
                        promoCode={this.state.promoCode}
                        isVipUser={this.state.isVipUser}
                        onNavigate={this.navigateTo}
                        onClearCart={this.clearCart}
                        theme={this.state.theme}
                    />
                )}
            </div>
        );
    }
}

export default App;
