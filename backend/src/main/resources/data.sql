-- Datos iniciales de La Taberna del Gato
-- La descripcion HTML permite XSS cuando se renderiza con dangerouslySetInnerHTML

CREATE TABLE products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock INT DEFAULT 0,
    category VARCHAR(100),
    views INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_number BIGINT,
    product_id BIGINT,
    quantity INT,
    client_email VARCHAR(255),
    total DECIMAL(10,2),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reviews (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT,
    text TEXT,
    rating INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Productos con descripciones HTML (el XSS se activara al renderizarlos en React)
INSERT INTO products (name, description, price, stock, category) VALUES
('Hierba Gatera Premium', '<strong>La mejor hierba gatera</strong> importada de Mexico. <em>Efectos garantizados</em> en 3 segundos.', 9.99, 150, 'botanica'),
('Catnip Mexicano XL', '<h4>Calidad artesanal</h4><p>Cultivado en las sierras de <b>Oaxaca</b>. 100g de pura diversión gatuna.</p>', 14.99, 85, 'botanica'),
('Rascador Jarra Gigante', 'Rascador con forma de jarra XXL. <span style="color:red">¡OFERTA!</span> Material: sisal natural y cartón reciclado.', 34.99, 12, 'muebles'),
('Torre Rascadora 5 Niveles', '<ul><li>5 niveles de entretenimiento</li><li>Hamaca incluida</li><li>Juguetes colgantes</li></ul>', 89.99, 7, 'muebles'),
('Ratón de Plumas Interactivo', 'Juguete <marquee>¡El favorito de los gatos!</marquee> Con plumas naturales y cascabel.', 6.99, 200, 'juguetes'),
('Pelota Crujiente Pack 3', 'Pack de 3 pelotas crujientes. <img src="gatos.jpg" alt="gatos jugando">', 4.99, 500, 'juguetes'),
('Cama Cueva Felpa', '<div style="font-size:20px">¡SUPERVENTAS!</div> Cama cueva de felpa premium. Desmontable y lavable.', 49.99, 23, 'descanso'),
('Collar GPS Gato Urbano', 'Collar con GPS integrado. <a href="http://tabernadelgato.com/gps-manual">Ver manual</a>.', 39.99, 30, 'accesorios');

-- Reseñas con HTML que también se renderiza sin sanitizar
INSERT INTO reviews (product_id, text, rating) VALUES
(1, 'Mi gato enloquece con esto. <b>Totalmente recomendado</b>', 5),
(1, 'Buena calidad aunque el precio es alto', 4),
(3, 'El rascador es enorme, casi no cabe en el salón. <em>Pero al gato le encanta</em>', 5),
(5, 'Se lo comio en 2 dias pero le encanto <img src=x onerror=console.log("xss-test")>', 3);
