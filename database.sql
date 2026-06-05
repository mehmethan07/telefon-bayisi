-- Telefon Bayisi Veritabani

-- 1. TABLOLAR

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(100) DEFAULT 'fas fa-plug',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO categories (id, name, code, description, icon) VALUES
(1, 'Akıllı Telefon', 'telefon', 'Son teknoloji akıllı telefonlar', 'fas fa-mobile-screen'),
(2, 'Kılıf & Koruma', 'kilif', 'Telefon kılıfları ve ekran koruyucular', 'fas fa-shield-halved'),
(3, 'Şarj & Kablo', 'sarj', 'Adaptörler ve şarj kabloları', 'fas fa-bolt'),
(4, 'Ses & Kulaklık', 'kulaklik', 'Kulak içi ve kulak üstü kulaklıklar', 'fas fa-headphones'),
(5, 'Akıllı Saat', 'saat', 'Akıllı saatler ve bileklikler', 'fas fa-watch'),
(6, 'Tablet', 'tablet', 'Tablet bilgisayarlar', 'fas fa-tablet-screen-button'),
(7, 'Yedek Parça', 'yedek_parca', 'Ekran, batarya gibi yedek parçalar', 'fas fa-microchip'),
(8, 'Hafıza & Depolama', 'depolama', 'Hafıza kartları ve USB bellekler', 'fas fa-memory'),
(9, 'Araç İçi Aksesuar', 'arac_ici', 'Araç şarj cihazları ve tutucular', 'fas fa-car'),
(10, 'Powerbank', 'powerbank', 'Taşınabilir şarj cihazları', 'fas fa-battery-full')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon;

SELECT setval(pg_get_serial_sequence('categories', 'id'), COALESCE((SELECT MAX(id) FROM categories), 0) + 1, false);

CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL,
    name VARCHAR(150) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    stock_status VARCHAR(50) DEFAULT 'Stokta' CHECK (stock_status IN ('Stokta', 'Azalıyor', 'Tükendi')),
    image_url VARCHAR(255) DEFAULT '/images/telefon.webp',
    is_featured BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE TABLE accessories (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL,
    name VARCHAR(150) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    stock_status VARCHAR(50) DEFAULT 'Stokta' CHECK (stock_status IN ('Stokta', 'Azalıyor', 'Tükendi')),
    image_url VARCHAR(255) DEFAULT '/images/aksesuar.webp',
    is_featured BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    tracking_code VARCHAR(50) UNIQUE NOT NULL CHECK (tracking_code ~ '^SP-[0-9]{6}$'),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('Kredi Kartı', 'Nakit', 'Havale/EFT')),
    status VARCHAR(50) DEFAULT 'Beklemede' CHECK (status IN ('Beklemede', 'Onaylandı', 'Teslime Hazır', 'Teslim Edildi', 'İptal Edildi')),
    total_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    device_id INTEGER,
    accessory_id INTEGER,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE RESTRICT,
    FOREIGN KEY (accessory_id) REFERENCES accessories(id) ON DELETE RESTRICT,
    CHECK ((device_id IS NOT NULL AND accessory_id IS NULL) OR (device_id IS NULL AND accessory_id IS NOT NULL))
);

CREATE TABLE service_requests (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    tracking_code VARCHAR(50) UNIQUE NOT NULL CHECK (tracking_code ~ '^SRV-[0-9]{6}$'),
    brand VARCHAR(100) NOT NULL,
    device_model VARCHAR(100) NOT NULL,
    issue_type VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Beklemede' CHECK (status IN ('Beklemede', 'Onaylandı', 'Onarımda', 'Parça Bekleniyor', 'Tamamlandı', 'İptal')),
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    subject VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    sent_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

INSERT INTO admins (username, password) VALUES ('admin', 'admin') ON CONFLICT DO NOTHING;


-- 2. INDEKSLER

CREATE INDEX idx_devices_brand ON devices(brand);
CREATE INDEX idx_accessories_brand ON accessories(brand);
CREATE INDEX idx_orders_tracking ON orders(tracking_code);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_service_requests_tracking ON service_requests(tracking_code);
CREATE INDEX idx_order_items_order ON order_items(order_id);


-- 3. GORUNUMLER (VIEW)

CREATE OR REPLACE VIEW order_details_view AS
SELECT
    o.id AS order_id,
    o.tracking_code,
    c.first_name || ' ' || c.last_name AS customer_full_name,
    c.phone,
    o.status,
    o.total_price,
    o.order_date,
    COUNT(oi.id) AS total_items
FROM orders o
JOIN customers c ON o.customer_id = c.id
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, c.first_name, c.last_name, c.phone;

CREATE OR REPLACE VIEW category_stock_view AS
SELECT
    c.name AS category_name,
    COUNT(p.id) AS product_count,
    SUM(CASE WHEN p.stock_status = 'Stokta' THEN 1 ELSE 0 END) AS in_stock,
    SUM(CASE WHEN p.stock_status = 'Tükendi' THEN 1 ELSE 0 END) AS out_of_stock
FROM categories c
LEFT JOIN (
    SELECT id, category_id, stock_status FROM devices
    UNION ALL
    SELECT id, category_id, stock_status FROM accessories
) p ON c.id = p.category_id
GROUP BY c.name;


-- 4. TRIGGER FONKSIYONLARI VE TETIKLEYICILER

CREATE OR REPLACE FUNCTION update_order_total()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE orders
    SET total_price = (
        SELECT COALESCE(SUM(quantity * unit_price), 0)
        FROM order_items
        WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
    )
    WHERE id = COALESCE(NEW.order_id, OLD.order_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_order_total
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_order_total();


CREATE OR REPLACE FUNCTION log_service_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        RAISE NOTICE 'Servis #% durumu degisti: % --> %', NEW.id, OLD.status, NEW.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_service_status_log
AFTER UPDATE OF status ON service_requests
FOR EACH ROW
EXECUTE FUNCTION log_service_status_change();


-- 5. SAKLI YORDAMLAR (STORED PROCEDURE)

CREATE OR REPLACE PROCEDURE create_order_proc(
    p_first_name VARCHAR,
    p_last_name VARCHAR,
    p_phone VARCHAR,
    p_email VARCHAR,
    p_payment_method VARCHAR,
    p_tracking_code VARCHAR,
    OUT p_order_id INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_customer_id INTEGER;
BEGIN
    SELECT id INTO v_customer_id FROM customers WHERE phone = p_phone;

    IF v_customer_id IS NULL THEN
        INSERT INTO customers (first_name, last_name, phone, email)
        VALUES (p_first_name, p_last_name, p_phone, p_email)
        RETURNING id INTO v_customer_id;
    END IF;

    INSERT INTO orders (customer_id, tracking_code, payment_method)
    VALUES (v_customer_id, p_tracking_code, p_payment_method)
    RETURNING id INTO p_order_id;
END;
$$;

CREATE OR REPLACE PROCEDURE create_service_proc(
    p_first_name VARCHAR,
    p_last_name VARCHAR,
    p_phone VARCHAR,
    p_email VARCHAR,
    p_brand VARCHAR,
    p_device_model VARCHAR,
    p_issue_type VARCHAR,
    p_description TEXT,
    p_tracking_code VARCHAR,
    OUT p_service_id INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_customer_id INTEGER;
BEGIN
    SELECT id INTO v_customer_id FROM customers WHERE phone = p_phone;

    IF v_customer_id IS NULL THEN
        INSERT INTO customers (first_name, last_name, phone, email)
        VALUES (p_first_name, p_last_name, p_phone, p_email)
        RETURNING id INTO v_customer_id;
    END IF;

    INSERT INTO service_requests (customer_id, tracking_code, brand, device_model, issue_type, description)
    VALUES (v_customer_id, p_tracking_code, p_brand, p_device_model, p_issue_type, p_description)
    RETURNING id INTO p_service_id;
END;
$$;

-- 6. TEST VERILERI

-- Test Verileri: devices
INSERT INTO devices (id, category_id, name, brand, price, stock_status, image_url, is_featured) VALUES
(1, 1, 'iPhone 15 Pro', 'APPLE', '74999.00', 'Stokta', '/images/telefon.webp', true),
(2, 1, 'Galaxy S24 Ultra', 'SAMSUNG', '69999.00', 'Stokta', '/images/telefon.webp', true),
(3, 1, 'Redmi Note 13 Pro', 'XIAOMI', '18499.00', 'Stokta', '/images/telefon.webp', true),
(4, 1, 'İphone 13', 'APPLE', '34000.00', 'Stokta', '/images/telefon.webp', false),
(5, 1, 'İphone 14', 'APPLE', '37000.00', 'Stokta', '/images/telefon.webp', false),
(6, 1, 'İphone 15', 'APPLE', '52000.00', 'Stokta', '/images/telefon.webp', false),
(7, 1, 'iPhone 16', 'APPLE', '58000.00', 'Stokta', '/images/telefon.webp', false),
(8, 1, 'İphone 17', 'APPLE', '67000.00', 'Stokta', '/images/telefon.webp', true),
(9, 1, 'iPhone 18', 'APPLE', '74999.99', 'Azalıyor', '/images/telefon.webp', false),
(10, 1, 'iPhone 18 Pro', 'APPLE', '94999.99', 'Stokta', '/images/telefon.webp', true)
ON CONFLICT (id) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    brand = EXCLUDED.brand,
    price = EXCLUDED.price,
    stock_status = EXCLUDED.stock_status,
    image_url = EXCLUDED.image_url,
    is_featured = EXCLUDED.is_featured;

SELECT setval(pg_get_serial_sequence('devices', 'id'), COALESCE((SELECT MAX(id) FROM devices), 0) + 1, false);

-- Test Verileri: accessories
INSERT INTO accessories (id, category_id, name, brand, price, stock_status, image_url, is_featured) VALUES
(5, 2, 'Spigen Zırhlı Kılıf', 'SPIGEN', '449.00', 'Stokta', '/images/aksesuar.webp', false),
(8, 10, 'Link PowerBank', 'AKSESUAR', '450.00', 'Stokta', '/images/aksesuar.webp', false),
(9, 3, '20W USB-C Güç Adaptörü', 'AKSESUAR', '300.00', 'Stokta', '/images/aksesuar.webp', false),
(10, 3, 'Type-C Örgü Kablo', 'AKSESUAR', '150.00', 'Stokta', '/images/aksesuar.webp', false),
(11, 4, 'AirPods Pro 2', 'AKSESUAR', '8000.00', 'Azalıyor', '/images/aksesuar.webp', true),
(12, 9, 'Araç için çakmaklık ', 'AKSESUAR', '100.00', 'Stokta', '/images/aksesuar.webp', true),
(13, 2, 'İphone Kılıf', 'AKSESUAR', '50.00', 'Stokta', '/images/aksesuar.webp', false),
(14, 3, 'AUX', 'AKSESUAR', '100.00', 'Stokta', '/images/aksesuar.webp', false),
(15, 4, 'Hoparlör JBL', 'AKSESUAR', '2450.00', 'Stokta', '/images/aksesuar.webp', true),
(16, 10, 'Kablosuz Şarjlı Powerbank', 'AKSESUAR', '1500.00', 'Stokta', '/images/aksesuar.webp', true)
ON CONFLICT (id) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    brand = EXCLUDED.brand,
    price = EXCLUDED.price,
    stock_status = EXCLUDED.stock_status,
    image_url = EXCLUDED.image_url,
    is_featured = EXCLUDED.is_featured;

SELECT setval(pg_get_serial_sequence('accessories', 'id'), COALESCE((SELECT MAX(id) FROM accessories), 0) + 1, false);

-- Test Verileri: customers
INSERT INTO customers (id, first_name, last_name, phone, email) VALUES
(11, 'Mehmet', 'Han', '05304093006', '07mehmethanguven@gmail.com'),
(12, 'Mehmet', 'Han', '05325813355', 'mehmethanbanka@gmail.com'),
(13, 'Ahmet', 'Yılmaz', '5551112233', 'ahmet@gmail.com'),
(14, 'Zengin', 'Birisi', '09999999999', 'ornek@gmail.com'),
(15, 'Fatih', '', '0555555555', 'ornek@gmail.com'),
(16, 'Marco', '', '05478455544', 'ornek@gmail.com'),
(17, 'Asensio', '', '05411441144', 'ornek@gmail.com'),
(18, 'Anderson', '', '05478520000', 'ornek@gmail.com'),
(19, 'Rafa', 'Silva', '05324555555', 'ornek@gmail.com'),
(20, 'Cengiz', 'Ünder', '05555558899', 'ornek@gmail.com'),
(21, 'Aziz', 'Yıldırım', '05001201907', 'ornek@gmail.com'),
(22, 'Hakan', 'Safi', '05202020022', 'ornek@gmail.com'),
(23, 'Zoktay', '', '05488881907', 'ornek@gmail.com'),
(24, 'Skriniar', '', '05889997788', 'ornek@gmail.com'),
(25, 'Orkun', 'Kökçü', '05411112244', 'ornek@gmail.com'),
(26, 'Ali', 'Koç', '05656667788', 'ornek@gmail.com')
ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email;

SELECT setval(pg_get_serial_sequence('customers', 'id'), COALESCE((SELECT MAX(id) FROM customers), 0) + 1, false);

-- Test Verileri: orders
INSERT INTO orders (id, customer_id, tracking_code, payment_method, status, total_price) VALUES
(11, 11, 'SP-734291', 'Nakit', 'Onaylandı', '74999.00'),
(12, 11, 'SP-540200', 'Kredi Kartı', 'İptal Edildi', '75448.00'),
(13, 11, 'SP-282150', 'Nakit', 'Beklemede', '70498.00'),
(14, 13, 'SP-123456', 'Nakit', 'İptal Edildi', '0.00'),
(15, 14, 'SP-711103', 'Kredi Kartı', 'Onaylandı', '595045.98'),
(16, 21, 'SP-176996', 'Nakit', 'Beklemede', '1151496.92'),
(17, 22, 'SP-372904', 'Kredi Kartı', 'Beklemede', '499.00'),
(18, 23, 'SP-911907', 'Nakit', 'Beklemede', '10450.00'),
(19, 24, 'SP-460397', 'Nakit', 'Beklemede', '2750.00'),
(20, 25, 'SP-762720', 'Kredi Kartı', 'Beklemede', '18499.00'),
(21, 26, 'SP-618526', 'Nakit', 'Beklemede', '58000.00')
ON CONFLICT (id) DO UPDATE SET
    customer_id = EXCLUDED.customer_id,
    tracking_code = EXCLUDED.tracking_code,
    payment_method = EXCLUDED.payment_method,
    status = EXCLUDED.status,
    total_price = EXCLUDED.total_price;

SELECT setval(pg_get_serial_sequence('orders', 'id'), COALESCE((SELECT MAX(id) FROM orders), 0) + 1, false);

-- Test Verileri: order_items
INSERT INTO order_items (id, order_id, device_id, accessory_id, quantity, unit_price) VALUES
(12, 11, 1, NULL, 1, '74999.00'),
(13, 12, 1, NULL, 1, '74999.00'),
(14, 12, NULL, 5, 1, '449.00'),
(15, 13, 2, NULL, 1, '69999.00'),
(16, 13, NULL, 13, 1, '50.00'),
(17, 13, NULL, 5, 1, '449.00'),
(18, 15, NULL, 13, 1, '50.00'),
(19, 15, NULL, 5, 1, '449.00'),
(20, 15, NULL, 14, 1, '100.00'),
(21, 15, NULL, 15, 1, '2450.00'),
(22, 15, NULL, 9, 1, '300.00'),
(23, 15, NULL, 10, 1, '150.00'),
(24, 15, NULL, 11, 1, '8000.00'),
(25, 15, NULL, 12, 1, '100.00'),
(26, 15, NULL, 16, 1, '1500.00'),
(27, 15, NULL, 8, 1, '450.00'),
(28, 15, 2, NULL, 1, '69999.00'),
(29, 15, 1, NULL, 1, '74999.00'),
(30, 15, 3, NULL, 1, '18499.00'),
(31, 15, 6, NULL, 1, '52000.00'),
(32, 15, 5, NULL, 1, '37000.00'),
(33, 15, 4, NULL, 1, '34000.00'),
(34, 15, 7, NULL, 1, '58000.00'),
(35, 15, 8, NULL, 1, '67000.00'),
(36, 15, 9, NULL, 1, '74999.99'),
(37, 15, 10, NULL, 1, '94999.99'),
(38, 16, 2, NULL, 1, '69999.00'),
(39, 16, 1, NULL, 1, '74999.00'),
(40, 16, 3, NULL, 1, '18499.00'),
(41, 16, 6, NULL, 1, '52000.00'),
(42, 16, 5, NULL, 1, '37000.00'),
(43, 16, 4, NULL, 1, '34000.00'),
(44, 16, 7, NULL, 1, '58000.00'),
(45, 16, 8, NULL, 1, '67000.00'),
(46, 16, 9, NULL, 1, '74999.99'),
(47, 16, 10, NULL, 7, '94999.99'),
(48, 17, NULL, 5, 1, '449.00'),
(49, 17, NULL, 13, 1, '50.00'),
(50, 18, NULL, 11, 1, '8000.00'),
(51, 18, NULL, 15, 1, '2450.00'),
(52, 19, NULL, 9, 1, '300.00'),
(53, 19, NULL, 15, 1, '2450.00'),
(54, 20, 3, NULL, 1, '18499.00'),
(55, 21, 7, NULL, 1, '58000.00')
ON CONFLICT (id) DO UPDATE SET
    order_id = EXCLUDED.order_id,
    device_id = EXCLUDED.device_id,
    accessory_id = EXCLUDED.accessory_id,
    quantity = EXCLUDED.quantity,
    unit_price = EXCLUDED.unit_price;

SELECT setval(pg_get_serial_sequence('order_items', 'id'), COALESCE((SELECT MAX(id) FROM order_items), 0) + 1, false);

-- Test Verileri: service_requests
INSERT INTO service_requests (id, customer_id, tracking_code, brand, device_model, issue_type, description, status) VALUES
(11, 11, 'SRV-649936', 'Xiaomi', 'REDMİ NOTE 10 PRO', 'Ekran Değişimi', 'Kırıldı değiştirmeye ihtiyacım var sadece ekran değişecek yardımcı olur musunuz fiyatı ne olur', 'İptal'),
(12, 12, 'SRV-857707', 'Xiaomi', 'İphone', 'Su/Sıvı Teması', 'aciliyeti var', 'Tamamlandı'),
(13, 13, 'SRV-123456', 'Apple', 'iPhone 13', 'Ekran Kırık', 'Ekran çatlak', 'Beklemede'),
(14, 15, 'SRV-529829', 'Huawei', 'Huwaei', 'Batarya Değişimi', 'Batarya değiştirilecek', 'Beklemede'),
(15, 16, 'SRV-808198', 'Samsung', 'samsung', 'Yazılım Sorunu', 'Yıllar geçtikçe telefon bozuluyor', 'Beklemede'),
(16, 17, 'SRV-863673', 'Apple', 'apple', 'Su/Sıvı Teması', 'su aldı ', 'Beklemede'),
(17, 18, 'SRV-418831', 'Diger', 'Tekno Spark türk yapım', 'Ekran Değişimi', 'Ekran kırıldı', 'Beklemede'),
(18, 12, 'SRV-799474', 'Xiaomi', 'Redmi 1', 'Kamera Onarımı', 'Şut çekerken cebimden düştü', 'Beklemede'),
(19, 19, 'SRV-271262', 'Diger', 'Bjk phone', 'Su/Sıvı Teması', 'Denizden Portekiz e kaçarken cebimden kaydı', 'Beklemede'),
(20, 20, 'SRV-516859', 'Apple', 'İphone Pro Max', 'Batarya Değişimi', 'Pilim bitti Sergen hala beni oynatıyo', 'Beklemede')
ON CONFLICT (id) DO UPDATE SET
    customer_id = EXCLUDED.customer_id,
    tracking_code = EXCLUDED.tracking_code,
    brand = EXCLUDED.brand,
    device_model = EXCLUDED.device_model,
    issue_type = EXCLUDED.issue_type,
    description = EXCLUDED.description,
    status = EXCLUDED.status;

SELECT setval(pg_get_serial_sequence('service_requests', 'id'), COALESCE((SELECT MAX(id) FROM service_requests), 0) + 1, false);

-- Test Verileri: messages
INSERT INTO messages (id, name, phone, email, subject, message) VALUES
(11, 'Mehmet Han', '05304093006', '07mehmethanguven@gmail.com', 'Teknik Destek', 'İphone 13 ü geliştirmem gerekiyor'),
(12, 'Canan Erçetin', '05374452353', '07mehmethanguven@gmail.com', 'Genel Bilgi', 'Şunu nasıl yapabiliriz'),
(13, 'Atilla', '05412454545', 'ornek@gmail.com', 'Fiyat Teklifi', 'İphone 16 satmak istiyorum kaça alırsınız '),
(14, 'karaoğlan', '05465656565', 'ornek@gmail.com', 'Şikayet', 'Siteniz mükemmel '),
(15, 'Jeff Bezos', '05464646464', 'ornek@gmail.com', 'Genel Bilgi', 'sitenize hayran kaldım bizle çalışmayı düşünür müsünüz'),
(16, 'Mark', '05304093006', '07mehmethanguven@gmail.com', 'Teknik Destek', 'Teknik desteğe ihityacım var
'),
(17, 'Beyazıt', '05411111111', 'ornek@gmail.com', 'Şikayet', 'Canan Erçetşn e bir şey satmayın'),
(18, 'Öztürk', '05111111111', 'ornek@gmail.com', 'Şikayet', 'Sizden şikayetçiyim
'),
(19, 'Ahmet', '05645665161', 'ornek@gmail.com', 'Diğer', 'Ürünü nasıl teslim alacağım
'),
(20, 'Tuğrul Kurt', '05121212121', 'ornek@gmail.com', 'Genel Bilgi', 'Harika İŞ')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    subject = EXCLUDED.subject,
    message = EXCLUDED.message;

SELECT setval(pg_get_serial_sequence('messages', 'id'), COALESCE((SELECT MAX(id) FROM messages), 0) + 1, false);
