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
