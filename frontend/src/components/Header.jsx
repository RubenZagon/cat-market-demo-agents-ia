import React, { Component } from 'react';

class Header extends Component {

    constructor(props) {
        super(props);
        this.state = {
            searchInput: '',
            showLogin: false,
            loginEmail: '',
            loginPassword: ''
        };

        this.handleSearchChange = this.handleSearchChange.bind(this);
        this.handleLoginSubmit = this.handleLoginSubmit.bind(this);
    }

    handleSearchChange(e) {
        this.setState({ searchInput: e.target.value });
        this.props.onSearch(e.target.value);
    }

    handleLoginSubmit(e) {
        e.preventDefault();
        this.props.onLogin(this.state.loginEmail, this.state.loginPassword);
        this.setState({ showLogin: false, loginEmail: '', loginPassword: '' });
    }

    render() {
        var totalItems = this.props.totalCartItems || 0;
        var totalPrice = this.props.totalCartPrice || 0;

        return (
            <header style={{ background: '#333', color: 'white', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h1
                    style={{ cursor: 'pointer', margin: 0 }}
                    onClick={() => this.props.onNavigate('home')}
                >
                    La Taberna del Gato
                </h1>

                <input
                    type="text"
                    placeholder="Buscar productos..."
                    value={this.state.searchInput}
                    onChange={this.handleSearchChange}
                    style={{ padding: '5px', width: '200px' }}
                />

                <div>
                    {this.props.user ? (
                        <span style={{ marginRight: '15px' }}>Hola, {this.props.user.name}</span>
                    ) : (
                        <button
                            onClick={() => this.setState({ showLogin: !this.state.showLogin })}
                            style={{ marginRight: '10px' }}
                        >
                            Login
                        </button>
                    )}

                    <button onClick={() => this.props.onNavigate('cart')}>
                        Carrito ({totalItems}) — {totalPrice.toFixed(2)} €
                    </button>
                </div>

                {this.state.showLogin && (
                    <form
                        onSubmit={this.handleLoginSubmit}
                        style={{ position: 'absolute', top: '60px', right: '20px', background: 'white', color: 'black', padding: '15px', border: '1px solid #ccc' }}
                    >
                        <div>
                            <input
                                type="email"
                                placeholder="Email"
                                value={this.state.loginEmail}
                                onChange={(e) => this.setState({ loginEmail: e.target.value })}
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                placeholder="Contraseña"
                                value={this.state.loginPassword}
                                onChange={(e) => this.setState({ loginPassword: e.target.value })}
                            />
                        </div>
                        <button type="submit">Entrar</button>
                    </form>
                )}
            </header>
        );
    }
}

export default Header;
