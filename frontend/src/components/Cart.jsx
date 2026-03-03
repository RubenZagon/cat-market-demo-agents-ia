import React, { Component } from 'react';

class Cart extends Component {

    constructor(props) {
        super(props);
        this.state = {
            promoInput: ''
        };
    }

    render() {
        var cart = this.props.cart || [];
        var totalPrice = this.props.totalCartPrice || 0;

        return (
            <div className="cart" style={{ padding: '20px' }}>
                <h2>Carrito de la compra</h2>

                {cart.length === 0 ? (
                    <p>El carrito está vacío.</p>
                ) : (
                    <div>
                        {cart.map((item) => (
                            <div key={item.id} style={{ border: '1px solid #ccc', margin: '10px 0', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{item.name}</span>
                                <span>x{item.quantity}</span>
                                <span>{(item.price * item.quantity).toFixed(2)} €</span>
                                <button onClick={() => this.props.onRemoveFromCart(item.id)}>
                                    Eliminar
                                </button>
                            </div>
                        ))}

                        <div style={{ marginTop: '20px' }}>
                            <strong>Total: {totalPrice.toFixed(2)} €</strong>
                        </div>

                        <div style={{ marginTop: '10px' }}>
                            <input
                                type="text"
                                placeholder="Código promocional"
                                value={this.state.promoInput}
                                onChange={(e) => this.setState({ promoInput: e.target.value })}
                            />
                            <button onClick={() => this.props.onApplyPromo(this.state.promoInput)}>
                                Aplicar
                            </button>
                        </div>

                        <div style={{ marginTop: '15px' }}>
                            <button onClick={() => this.props.onBuy(null, null)} style={{ marginRight: '10px' }}>
                                Finalizar compra
                            </button>
                            <button onClick={this.props.onClearCart}>
                                Vaciar carrito
                            </button>
                            <button onClick={() => this.props.onNavigate('home')} style={{ marginLeft: '10px' }}>
                                Seguir comprando
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }
}

export default Cart;
