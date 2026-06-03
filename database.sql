-- Telefon Bayisi Veritabanı (VTYS Projesi için)
-- Normalizasyon (5N) kurallarına uygun tasarlanmıştır.

-- 1. TABLOLAR VE KISITLAMALAR (PK, FK, Unique, Check, Default)

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(100) DEFAULT 'fas fa-plug',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- 1.1 MEVCUT VERITABANI ICIN MIGRATION (Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devices_stock_status_check') THEN
        ALTER TABLE devices ADD CONSTRAINT devices_stock_status_check
        CHECK (stock_status IN ('Stokta', 'Azalıyor', 'Tükendi'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accessories_stock_status_check') THEN
        ALTER TABLE accessories ADD CONSTRAINT accessories_stock_status_check
        CHECK (stock_status IN ('Stokta', 'Azalıyor', 'Tükendi'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_tracking_code_check') THEN
        ALTER TABLE orders ADD CONSTRAINT orders_tracking_code_check
        CHECK (tracking_code ~ '^SP-[0-9]{6}$');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_method_check') THEN
        ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
        CHECK (payment_method IN ('Kredi Kartı', 'Nakit', 'Havale/EFT'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_requests_tracking_code_check') THEN
        ALTER TABLE service_requests ADD CONSTRAINT service_requests_tracking_code_check
        CHECK (tracking_code ~ '^SRV-[0-9]{6}$');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_requests_status_check') THEN
        ALTER TABLE service_requests ADD CONSTRAINT service_requests_status_check
        CHECK (status IN ('Beklemede', 'Onarımda', 'Parça Bekleniyor', 'Tamamlandı', 'İptal'));
    END IF;
END
$$;

-- 2. İNDEKSLER (INDEX)
-- Sorguları hızlandırmak için sık aranan sütunlara indeks ekliyoruz.
CREATE INDEX idx_devices_brand ON devices(brand);
CREATE INDEX idx_accessories_brand ON accessories(brand);
CREATE INDEX idx_orders_tracking ON orders(tracking_code);
CREATE INDEX idx_customers_phone ON customers(phone);

-- 3. GÖRÜNÜMLER (VIEW)
-- Raporlamayı kolaylaştırmak için sipariş detaylarını müşteri bilgileriyle birleştiren view
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

-- Ürünlerin (cihaz ve aksesuar) kategori bazlı stok istatistiklerini gösteren View
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

-- 4. TETİKLEYİCİLER VE FONKSİYONLAR (TRIGGER)
-- Sipariş kalemleri (order_items) eklendiğinde siparişin (orders) total_price değerini otomatik güncelleyen trigger

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

-- 5. SAKLI YORDAMLAR (STORED PROCEDURE)
-- Yeni bir sipariş oluşturmak için (Müşteri yoksa ekler, varsa kullanır)
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
    -- Müşteri var mı kontrol et
    SELECT id INTO v_customer_id FROM customers WHERE phone = p_phone;
    
    -- Yoksa oluştur
    IF v_customer_id IS NULL THEN
        INSERT INTO customers (first_name, last_name, phone, email)
        VALUES (p_first_name, p_last_name, p_phone, p_email)
        RETURNING id INTO v_customer_id;
    END IF;
    
    -- Siparişi oluştur
    INSERT INTO orders (customer_id, tracking_code, payment_method)
    VALUES (v_customer_id, p_tracking_code, p_payment_method)
    RETURNING id INTO p_order_id;
END;
$$;


-- 6. ÖRNEK VERİLER (Minimum 10 Dummy Data)

-- Kategoriler (10)
INSERT INTO categories (name, code, description, icon) VALUES
('Akıllı Telefon', 'telefon', 'Son teknoloji akıllı telefonlar', 'fas fa-mobile-screen'),
('Kılıf & Koruma', 'kilif', 'Telefon kılıfları ve ekran koruyucular', 'fas fa-shield-halved'),
('Şarj & Kablo', 'sarj', 'Adaptörler ve şarj kabloları', 'fas fa-bolt'),
('Ses & Kulaklık', 'kulaklik', 'Kulak içi ve kulak üstü kulaklıklar', 'fas fa-headphones'),
('Akıllı Saat', 'saat', 'Akıllı saatler ve bileklikler', 'fas fa-watch'),
('Tablet', 'tablet', 'Tablet bilgisayarlar', 'fas fa-tablet-screen-button'),
('Yedek Parça', 'yedek_parca', 'Ekran, batarya gibi yedek parçalar', 'fas fa-microchip'),
('Hafıza & Depolama', 'depolama', 'Hafıza kartları ve USB bellekler', 'fas fa-memory'),
('Araç İçi Aksesuar', 'arac_ici', 'Araç şarj cihazları ve tutucular', 'fas fa-car'),
('Powerbank', 'powerbank', 'Taşınabilir şarj cihazları', 'fas fa-battery-full');

-- Cihazlar (3)
INSERT INTO devices (category_id, name, brand, price, stock_status, is_featured) VALUES
(1, 'iPhone 15 Pro', 'APPLE', 74999.00, 'Stokta', TRUE),
(1, 'Galaxy S24 Ultra', 'SAMSUNG', 69999.00, 'Stokta', TRUE),
(1, 'Redmi Note 13 Pro', 'XIAOMI', 18499.00, 'Azalıyor', FALSE);

-- Aksesuarlar (7)
INSERT INTO accessories (category_id, name, brand, price, stock_status, is_featured) VALUES
(2, 'Apple Silikon Kılıf', 'APPLE', 899.00, 'Stokta', TRUE),
(3, '20W USB-C Güç Adaptörü', 'APPLE', 549.00, 'Stokta', FALSE),
(4, 'AirPods Pro 2', 'APPLE', 7499.00, 'Stokta', TRUE),
(3, 'Samsung 45W Şarj Aleti', 'SAMSUNG', 699.00, 'Tükendi', FALSE),
(2, 'Spigen Zırhlı Kılıf', 'SPIGEN', 449.00, 'Stokta', FALSE),
(3, 'Type-C Örgü Kablo', 'BASEUS', 199.00, 'Stokta', FALSE),
(5, 'Galaxy Watch 6', 'SAMSUNG', 5999.00, 'Stokta', TRUE);

-- DEMO VERİLERİ (müşteri/sipariş/servis/mesaj) KALDIRILDI
-- Kategori ve ürünler seed edilir; müşteri/sipariş/servis/mesaj verileri uygulama üzerinden oluşturulur.

-- Admin Kullanıcısı (Sadece 1 adet)
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

-- Varsayılan admin (123456) hashli seed, varsa tekrar eklemez
INSERT INTO admins (username, password)
VALUES ('admin', '$2b$12$4sWztVX1vYU2bFT67iI.neE7i93H2rdW8brIHLsrvWPsmMSinJa12')
ON CONFLICT (username) DO NOTHING;

