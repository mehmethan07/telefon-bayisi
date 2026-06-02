const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./db');
const app = express();

const config = {
    name: "BAYİM",
    port: process.env.PORT || 8080
};

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'change-me-in-env',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    }
}));

const SERVICE_STATUS_WHITELIST = ['Beklemede', 'Onarımda', 'Parça Bekleniyor', 'Tamamlandı', 'İptal'];
const ORDER_STATUS_WHITELIST = ['Beklemede', 'Onaylandı', 'Teslime Hazır', 'Teslim Edildi', 'İptal Edildi'];

let adminSettings = {
    whatsapp: "905551234567",
    whatsappActive: true,
    instagram: "#",
    instagramActive: true,
    facebook: "#",
    facebookActive: true,
    twitter: "#",
    twitterActive: true,
    youtube: "#",
    youtubeActive: true,
    maintenanceMode: false
};

async function initSettings() {
    try {
        await db.query(`CREATE TABLE IF NOT EXISTS site_settings (id SERIAL PRIMARY KEY, config JSONB NOT NULL)`);
        const res = await db.query("SELECT config FROM site_settings LIMIT 1");
        if (res.rows.length === 0) {
            await db.query("INSERT INTO site_settings (config) VALUES ($1)", [adminSettings]);
        } else {
            adminSettings = { ...adminSettings, ...res.rows[0].config };
        }
    } catch(err) { console.error("Settings init error:", err); }
}
initSettings();

app.use(async (req, res, next) => {
    if (!req.session.sepet) req.session.sepet = [];
    res.locals.firma_adi = config.name;
    res.locals.settings = adminSettings;
    res.locals.sepet_sayisi = req.session.sepet.reduce((toplam, urun) => toplam + urun.miktar, 0);
    res.locals.cart_notice = req.session.cartNotice || null;
    req.session.cartNotice = null;
    res.locals.currentPath = req.path;
    next();
});

// Bakım Modu Koruması
app.use((req, res, next) => {
    if (adminSettings.maintenanceMode && !req.path.startsWith('/admin') && !req.path.startsWith('/css') && !req.path.startsWith('/images') && !req.path.startsWith('/js')) {
        return res.render('bakim', { settings: adminSettings });
    }
    next();
});

function generateTrackingCode() {
    const randomPart = Math.floor(100000 + Math.random() * 900000);
    return `SP-${randomPart}`;
}

function normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
}

function generateServiceTrackingCode() {
    const randomPart = Math.floor(100000 + Math.random() * 900000);
    return `SRV-${randomPart}`;
}

async function generateUniqueTrackingCode(generator, tableName, maxRetry = 10) {
    for (let i = 0; i < maxRetry; i += 1) {
        const code = generator();
        const exists = await db.query(`SELECT 1 FROM ${tableName} WHERE tracking_code = $1 LIMIT 1`, [code]);
        if (exists.rows.length === 0) return code;
    }
    throw new Error(`${tableName} için benzersiz takip kodu üretilemedi`);
}

app.get('/', async (req, res) => {
    try {
        const prodResult = await db.query("SELECT * FROM devices");
        const aksResult = await db.query("SELECT p.*, c.code as category_code, c.icon FROM accessories p JOIN categories c ON p.category_id = c.id");
        
        const mockProducts = prodResult.rows;
        const mockAksesuarlar = aksResult.rows;
        
        const featuredProducts = mockProducts.filter(p => p.is_featured);
        const featuredAksesuarlar = mockAksesuarlar.filter(a => a.is_featured);
        
        const data = { 
            products: mockProducts, 
            featuredProducts: featuredProducts, 
            featuredAksesuarlar: featuredAksesuarlar,
            aks: mockAksesuarlar,
            aksesuarlar: mockAksesuarlar 
        };
        res.render('index', data);
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.get('/urunler', async (req, res) => {
    try {
        let query = "SELECT * FROM devices WHERE 1=1";
        let params = [];
        if (req.query.search) {
            const s = req.query.search.toLowerCase();
            query += " AND (LOWER(name) LIKE $1 OR LOWER(brand) LIKE $1)";
            params.push(`%${s}%`);
        }
        const result = await db.query(query, params);
        
        const brandsRes = await db.query("SELECT DISTINCT brand FROM devices");
        const uniqueBrands = brandsRes.rows.map(r => r.brand);
        
        res.render('products', { catalogProducts: result.rows, uniqueBrands, query: req.query });
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.get('/urunler/:id', async (req, res) => {
    try {
        const pRes = await db.query("SELECT * FROM devices WHERE id = $1", [req.params.id]);
        if (pRes.rows.length === 0) return res.status(404).render('pages/error', { message: "Ürün bulunamadı." });
        const product = pRes.rows[0];
        
        const simRes = await db.query("SELECT * FROM devices WHERE brand = $1 AND id != $2 LIMIT 4", [product.brand, product.id]);
        let similarProducts = simRes.rows;
        if(similarProducts.length < 4) {
            const othRes = await db.query("SELECT * FROM devices WHERE brand != $1 AND id != $2 LIMIT $3", [product.brand, product.id, 4 - similarProducts.length]);
            similarProducts.push(...othRes.rows);
        }
        res.render('detay', { item: product, type: 'urun', similarProducts });
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.get('/servis', async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM service_requests ORDER BY request_date DESC LIMIT 5");
        res.render('servis', { orders: result.rows, result: null, error: null, form: {} });
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.post('/servis/sorgula', async (req, res) => {
    const tracking_code = String(req.body.tracking_code || '').trim().toUpperCase();
    try {
        const latestRes = await db.query("SELECT * FROM service_requests ORDER BY request_date DESC LIMIT 5");
        if (!tracking_code) {
            return res.render('servis', { orders: latestRes.rows, result: null, error: 'Lütfen servis takip kodu girin.', form: { tracking_code: '' } });
        }

        const srvRes = await db.query(`
            SELECT s.*, c.first_name || ' ' || c.last_name AS customer_name, c.phone
            FROM service_requests s
            JOIN customers c ON s.customer_id = c.id
            WHERE UPPER(s.tracking_code) = $1
            LIMIT 1
        `, [tracking_code]);

        if (srvRes.rows.length === 0) {
            return res.render('servis', { orders: latestRes.rows, result: null, error: 'Bu takip koduna ait servis kaydı bulunamadı.', form: { tracking_code } });
        }

        const service = srvRes.rows[0];
        if (service.request_date) {
            const d = new Date(service.request_date);
            service.date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }

        res.render('servis', { orders: latestRes.rows, result: service, error: null, form: { tracking_code } });
    } catch (err) {
        console.error(err);
        res.status(500).send("Sunucu Hatası");
    }
});

app.get('/servis/kayit', (req, res) => {
    res.render('servis-kayit', { success: false, trackingCode: null });
});

app.post('/servis/kayit', async (req, res) => {
    const { customer_name, phone, email, brand, device_model, issue_type, description } = req.body;
    if (!customer_name || !phone || !brand || !device_model || !issue_type) {
        return res.render('servis-kayit', { success: false, error: 'Lütfen zorunlu alanları doldurun.', trackingCode: null });
    }
    const phoneDigits = normalizePhone(phone);
    if (phoneDigits && !/^[0-9]{10,11}$/.test(phoneDigits)) {
        return res.render('servis-kayit', { success: false, error: 'Geçersiz telefon numarası.', trackingCode: null });
    }

    try {
        const trackingCode = await generateUniqueTrackingCode(generateServiceTrackingCode, 'service_requests');
        const [firstName, ...lastNameArr] = customer_name.split(' ');
        const lastName = lastNameArr.join(' ') || '';
        
        let custRes = await db.query("SELECT id FROM customers WHERE phone = $1", [phoneDigits || phone]);
        let customerId;
        if (custRes.rows.length === 0) {
            const insCust = await db.query("INSERT INTO customers (first_name, last_name, phone, email) VALUES ($1, $2, $3, $4) RETURNING id", [firstName, lastName, phoneDigits || phone, email]);
            customerId = insCust.rows[0].id;
        } else {
            customerId = custRes.rows[0].id;
        }

        await db.query(`INSERT INTO service_requests (customer_id, tracking_code, brand, device_model, issue_type, description) 
                        VALUES ($1, $2, $3, $4, $5, $6)`, 
                        [customerId, trackingCode, brand, device_model, issue_type, description]);
                        
        res.render('servis-kayit', { success: true, trackingCode });
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.use('/admin', async (req, res, next) => {
    try {
        const prodRes = await db.query(`
            SELECT id, name, stock_status, 'urun' as type FROM devices WHERE stock_status IN ('Azalıyor', 'Tükendi')
            UNION ALL
            SELECT id, name, stock_status, 'aksesuar' as type FROM accessories WHERE stock_status IN ('Azalıyor', 'Tükendi')
        `);
        res.locals.stokUyarilari = prodRes.rows;
        next();
    } catch(err) {
        console.error(err);
        res.locals.stokUyarilari = [];
        next();
    }
});

// Admin Authentication Middleware
app.use('/admin', (req, res, next) => {
    if (req.path === '/login' || req.path === '/') return next();
    if (!req.session.adminId) {
        return res.redirect('/admin/login');
    }
    next();
});

app.get('/admin', (req, res) => {
    if (req.session.adminId) return res.redirect('/admin/dashboard');
    res.render('admin/login', { error: null });
});
app.get('/admin/login', (req, res) => {
    if (req.session.adminId) return res.redirect('/admin/dashboard');
    res.render('admin/login', { error: null });
});
app.post('/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const adminRes = await db.query("SELECT * FROM admins WHERE username = $1", [email]);
        if (adminRes.rows.length > 0) {
            const admin = adminRes.rows[0];
            const isBcryptHash = typeof admin.password === 'string' && admin.password.startsWith('$2');
            const isValid = isBcryptHash
                ? await bcrypt.compare(password, admin.password)
                : password === admin.password;

            if (!isValid) {
                return res.render('admin/login', { error: 'Hatalı kullanıcı adı veya şifre!' });
            }

            if (!isBcryptHash) {
                const upgradedHash = await bcrypt.hash(password, 12);
                await db.query("UPDATE admins SET password = $1 WHERE id = $2", [upgradedHash, admin.id]);
            }

            req.session.adminId = admin.id;
            res.redirect('/admin/dashboard');
        } else {
            res.render('admin/login', { error: 'Hatalı kullanıcı adı veya şifre!' });
        }
    } catch(err) {
        console.error(err);
        res.render('admin/login', { error: 'Sunucu hatası!' });
    }
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

app.get('/admin/mesajlar', async (req, res) => {
    try {
        const msgRes = await db.query("SELECT * FROM messages ORDER BY sent_date DESC");
        const mesajlar = msgRes.rows.map(m => {
            if (m.sent_date) {
                const d = new Date(m.sent_date);
                m.date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            }
            return m;
        });
        res.render('admin/mesajlar', { mesajlar, stokUyarilari: res.locals.stokUyarilari });
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.get('/admin/servis', async (req, res) => {
    try {
        const srvRes = await db.query(`
            SELECT s.*, c.first_name || ' ' || c.last_name as customer_name, c.phone 
            FROM service_requests s JOIN customers c ON s.customer_id = c.id 
            ORDER BY s.request_date DESC
        `);
        const requests = srvRes.rows.map(r => {
            if (r.request_date) {
                const d = new Date(r.request_date);
                r.date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            }
            return r;
        });
        res.render('admin/servis', { requests, stokUyarilari: res.locals.stokUyarilari });
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.post('/admin/servis/:id/durum', async (req, res) => {
    try {
        if (req.body.status && SERVICE_STATUS_WHITELIST.includes(req.body.status)) {
            await db.query("UPDATE service_requests SET status = $1 WHERE id = $2", [req.body.status, req.params.id]);
        }
        res.redirect('/admin/servis');
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.get('/admin/dashboard', async (req, res) => {
    try {
        const aylikKazancRes = await db.query("SELECT SUM(total_price) as sum FROM orders WHERE status = 'Onaylandı'");
        const aylikKazanc = aylikKazancRes.rows[0].sum || 0;
        
        const bekleyenRes = await db.query("SELECT COUNT(*) as count FROM orders WHERE status = 'Beklemede'");
        const bekleyenSiparis = parseInt(bekleyenRes.rows[0].count);
        
        const sonSiparislerRes = await db.query(`
            SELECT o.*, c.first_name || ' ' || c.last_name as customer_name 
            FROM orders o JOIN customers c ON o.customer_id = c.id 
            ORDER BY o.order_date DESC LIMIT 5
        `);
        const sonSiparisler = await Promise.all(sonSiparislerRes.rows.map(async r => {
            r.total_price = parseFloat(r.total_price).toLocaleString('tr-TR');
            const itemsRes = await db.query("SELECT * FROM order_items WHERE order_id = $1", [r.id]);
            r.items = itemsRes.rows;
            return r;
        }));
        
        const msgRes = await db.query("SELECT * FROM messages ORDER BY sent_date DESC LIMIT 5");
        const sonMesajlar = msgRes.rows.map(m => {
            if (m.sent_date) {
                const d = new Date(m.sent_date);
                m.date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            }
            return m;
        });
        
        const prodCountRes = await db.query("SELECT COUNT(*) as count FROM devices");
        const urun_sayisi = parseInt(prodCountRes.rows[0].count);
        
        const aksCountRes = await db.query("SELECT COUNT(*) as count FROM accessories");
        const aksesuar_sayisi = parseInt(aksCountRes.rows[0].count);

        const chartLabels = ['Ekim', 'Kasım', 'Aralık', 'Ocak', 'Şubat', 'Mart'];
        const chartData = [125000, 180000, 250000, 140000, 210000, parseFloat(aylikKazanc) > 0 ? parseFloat(aylikKazanc) : 95000];

        const topBrandsRes = await db.query(`
            SELECT brand, SUM(sales) as sales FROM (
                SELECT d.brand, SUM(oi.quantity) as sales
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                JOIN devices d ON oi.device_id = d.id
                WHERE o.status = 'Onaylandı'
                GROUP BY d.brand
                UNION ALL
                SELECT a.brand, SUM(oi.quantity) as sales
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                JOIN accessories a ON oi.accessory_id = a.id
                WHERE o.status = 'Onaylandı'
                GROUP BY a.brand
            ) AS combined_brands
            GROUP BY brand ORDER BY sales DESC LIMIT 3
        `);
        const topBrands = topBrandsRes.rows.length > 0 ? topBrandsRes.rows : [
            { brand: "APPLE", sales: 145 }, { brand: "SAMSUNG", sales: 98 }, { brand: "XIAOMI", sales: 64 }
        ];

        const renderData = { 
            stats: {
                urun_sayisi,
                aksesuar_sayisi,
                aylik_kazanc: parseFloat(aylikKazanc).toLocaleString('tr-TR'),
                bekleyen_siparis: bekleyenSiparis
            },
            sonSiparisler, sonMesajlar,
            chartLabels: JSON.stringify(chartLabels),
            chartData: JSON.stringify(chartData),
            topBrands,
            stokUyarilari: res.locals.stokUyarilari || []
        };
        
        res.locals.stokUyarilari = renderData.stokUyarilari;
        res.locals.topBrands = topBrands;
        
        res.render('admin/dashboard', renderData);
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.get('/admin/urunler', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = 20;
        const offset = (page - 1) * limit;
        const search = String(req.query.search || '').trim().toLowerCase();
        const sort = String(req.query.sort || 'newest');

        const orderByMap = {
            newest: 'id DESC',
            oldest: 'id ASC',
            name_asc: 'name ASC',
            name_desc: 'name DESC',
            price_asc: 'price ASC',
            price_desc: 'price DESC',
            featured: 'is_featured DESC, id DESC'
        };
        const orderBy = orderByMap[sort] || orderByMap.newest;

        const whereClauses = [];
        const params = [];
        if (search) {
            whereClauses.push(`(LOWER(name) LIKE $${params.length + 1} OR LOWER(brand) LIKE $${params.length + 1})`);
            params.push(`%${search}%`);
        }
        const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const countRes = await db.query(`SELECT COUNT(*)::int AS total FROM devices ${whereSql}`, params);
        const total = countRes.rows[0]?.total || 0;

        const listParams = [...params, limit, offset];
        const prodRes = await db.query(
            `SELECT * FROM devices ${whereSql} ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            listParams
        );
        const brandsRes = await db.query("SELECT DISTINCT brand FROM devices");
        const uniqueBrands = brandsRes.rows.map(r => r.brand);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const safePage = Math.min(page, totalPages);

        res.render('admin/urunler', {
            products: prodRes.rows,
            uniqueBrands,
            stokUyarilari: res.locals.stokUyarilari,
            filters: { search, sort },
            pagination: { page: safePage, limit, total, totalPages }
        });
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.post('/admin/urunler/ekle', async (req, res) => {
    let { name, brand, new_brand, price, stock_status, image_url, is_featured } = req.body;
    const finalBrand = (brand === 'yeni' && new_brand) ? new_brand.toUpperCase() : brand;
    try {
        await db.query(`INSERT INTO devices (category_id, name, brand, price, stock_status, image_url, is_featured) 
                        VALUES (1, $1, $2, $3, $4, $5, $6)`, 
                        [name, finalBrand, parseFloat(price), stock_status, image_url || '/images/telefon.webp', is_featured === 'on']);
        res.redirect('/admin/urunler');
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.post('/admin/urunler/:id/duzenle', async (req, res) => {
    let { name, brand, new_brand, price, stock_status, image_url, is_featured } = req.body;
    const finalBrand = (brand === 'yeni' && new_brand) ? new_brand.toUpperCase() : brand;
    try {
        await db.query(`UPDATE devices SET name=$1, brand=$2, price=$3, stock_status=$4, image_url=COALESCE($5, image_url), is_featured=$6 WHERE id=$7`, 
                        [name, finalBrand, parseFloat(price), stock_status, image_url, is_featured === 'on', req.params.id]);
        res.redirect('/admin/urunler');
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.post('/admin/urunler/:id/sil', async (req, res) => {
    try {
        await db.query("DELETE FROM devices WHERE id=$1", [req.params.id]);
        res.redirect('/admin/urunler');
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.post('/admin/urunler/:id/one-cikar', async (req, res) => {
    try {
        await db.query("UPDATE devices SET is_featured = NOT is_featured WHERE id = $1", [req.params.id]);
        res.redirect(req.get('referer') || '/admin/urunler');
    } catch (err) {
        console.error(err);
        res.status(500).send("Sunucu Hatası");
    }
});

app.get('/admin/aksesuarlar', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = 20;
        const offset = (page - 1) * limit;
        const search = String(req.query.search || '').trim().toLowerCase();
        const sort = String(req.query.sort || 'newest');

        const orderByMap = {
            newest: 'p.id DESC',
            oldest: 'p.id ASC',
            name_asc: 'p.name ASC',
            name_desc: 'p.name DESC',
            price_asc: 'p.price ASC',
            price_desc: 'p.price DESC',
            featured: 'p.is_featured DESC, p.id DESC'
        };
        const orderBy = orderByMap[sort] || orderByMap.newest;

        const whereClauses = [];
        const params = [];
        if (search) {
            whereClauses.push(`(LOWER(p.name) LIKE $${params.length + 1} OR LOWER(c.name) LIKE $${params.length + 1} OR LOWER(p.brand) LIKE $${params.length + 1})`);
            params.push(`%${search}%`);
        }
        const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const countRes = await db.query(
            `SELECT COUNT(*)::int AS total FROM accessories p JOIN categories c ON p.category_id = c.id ${whereSql}`,
            params
        );
        const total = countRes.rows[0]?.total || 0;

        const listParams = [...params, limit, offset];
        const aksRes = await db.query(
            `SELECT p.*, c.name as category, c.code as category_code, c.icon
             FROM accessories p
             JOIN categories c ON p.category_id = c.id
             ${whereSql}
             ORDER BY ${orderBy}
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            listParams
        );
        const catRes = await db.query("SELECT name, code FROM categories WHERE code != 'telefon'");
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const safePage = Math.min(page, totalPages);

        res.render('admin/aksesuarlar', {
            aksesuarlar: aksRes.rows,
            uniqueCategories: catRes.rows,
            stokUyarilari: res.locals.stokUyarilari,
            filters: { search, sort },
            pagination: { page: safePage, limit, total, totalPages }
        });
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.post('/admin/aksesuarlar/ekle', async (req, res) => {
    let { name, category, price, icon, stock_status, is_featured } = req.body;
    try {
        const catRes = await db.query("SELECT id FROM categories WHERE code = $1 OR name = $1 LIMIT 1", [category]);
        if(catRes.rows.length > 0) {
            await db.query(`INSERT INTO accessories (category_id, name, brand, price, stock_status, is_featured) VALUES ($1, $2, 'AKSESUAR', $3, $4, $5)`, 
                            [catRes.rows[0].id, name, parseFloat(price), stock_status || 'Stokta', is_featured === 'on']);
        }
        res.redirect('/admin/aksesuarlar');
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.post('/admin/aksesuarlar/:id/duzenle', async (req, res) => {
    let { name, category, price, stock_status, is_featured } = req.body;
    try {
        const catRes = await db.query("SELECT id FROM categories WHERE code = $1 OR name = $1 LIMIT 1", [category]);
        if(catRes.rows.length > 0) {
            await db.query(`UPDATE accessories SET category_id=$1, name=$2, price=$3, stock_status=$4, is_featured=$5 WHERE id=$6`, 
                            [catRes.rows[0].id, name, parseFloat(price), stock_status || 'Stokta', is_featured === 'on', req.params.id]);
        }
        res.redirect('/admin/aksesuarlar');
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.post('/admin/aksesuarlar/:id/sil', async (req, res) => {
    try {
        await db.query("DELETE FROM accessories WHERE id=$1", [req.params.id]);
        res.redirect('/admin/aksesuarlar');
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.post('/admin/aksesuarlar/:id/one-cikar', async (req, res) => {
    try {
        await db.query("UPDATE accessories SET is_featured = NOT is_featured WHERE id = $1", [req.params.id]);
        res.redirect(req.get('referer') || '/admin/aksesuarlar');
    } catch (err) {
        console.error(err);
        res.status(500).send("Sunucu Hatası");
    }
});

app.post('/sepet/ekle', async (req, res) => {
    const { type, id } = req.body;
    const backUrl = req.get('referer') || '/urunler';
    try {
        const pRes = await db.query(type === 'urun' ? "SELECT * FROM devices WHERE id = $1" : "SELECT * FROM accessories WHERE id = $1", [id]);
        if(pRes.rows.length > 0) {
            const item = pRes.rows[0];
            if (item.stock_status === 'Tükendi') {
                if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
                    return res.json({ success: false, message: 'Bu ürün tükendi.' });
                }
                return res.redirect(backUrl);
            }
            const mevcut = req.session.sepet.find(s => s.item.id === item.id && s.type === type);
            if (mevcut) {
                mevcut.miktar += 1;
            } else {
                req.session.sepet.push({ item, type, miktar: 1 });
            }
        }
        if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
            return res.json({ success: true, message: 'Ürün sepete eklendi', cartCount: req.session.sepet.reduce((toplam, urun) => toplam + urun.miktar, 0) });
        }
        res.redirect('/sepet');
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.post('/sepet/sil/:type/:id', (req, res) => {
    const { type, id } = req.params;
    req.session.sepet = req.session.sepet.filter(s => !(s.type === type && s.item.id == id));
    res.redirect('/sepet');
});

app.post('/sepet/artir/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    try {
        const item = req.session.sepet.find(s => s.type === type && s.item.id == id);
        if (item) {
            const stockRes = await db.query(
                type === 'urun' ? "SELECT stock_status FROM devices WHERE id = $1" : "SELECT stock_status FROM accessories WHERE id = $1",
                [id]
            );
            if (stockRes.rows.length > 0 && stockRes.rows[0].stock_status !== 'Tükendi') {
                item.miktar += 1;
            } else {
                req.session.cartNotice = 'Bu ürün stokta olmadığı için miktar artırılamadı.';
            }
        }
        res.redirect('/sepet');
    } catch (err) {
        console.error(err);
        res.status(500).send("Sunucu Hatası");
    }
});

app.post('/sepet/azalt/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const item = req.session.sepet.find(s => s.type === type && s.item.id == id);
    if (item) {
        item.miktar -= 1;
        if (item.miktar <= 0) req.session.sepet = req.session.sepet.filter(s => !(s.type === type && s.item.id == id));
    }
    res.redirect('/sepet');
});

app.get('/sepet', (req, res) => {
    const toplamFiyat = req.session.sepet.reduce((acc, curr) => acc + (parseFloat(curr.item.price) * curr.miktar), 0);
    const formatliFiyat = toplamFiyat.toLocaleString('tr-TR');
    res.render('sepet', { sepet: req.session.sepet, toplamFiyat: formatliFiyat });
});

app.get('/siparis/tamamla', (req, res) => {
    if (req.session.sepet.length === 0) return res.redirect('/sepet');
    const toplamFiyat = req.session.sepet.reduce((acc, curr) => acc + (parseFloat(curr.item.price) * curr.miktar), 0);
    res.render('ayirt', { sepet: req.session.sepet, toplam: toplamFiyat.toLocaleString('tr-TR'), success: false, trackingCode: null });
});

app.post('/siparis/tamamla', async (req, res) => {
    if (req.session.sepet.length === 0) return res.redirect('/sepet');

    const { customer_name, phone, email, payment_method } = req.body;
    const toplamFiyat = req.session.sepet.reduce((acc, curr) => acc + (parseFloat(curr.item.price) * curr.miktar), 0);
    
    if (!customer_name || !phone || !payment_method) {
        return res.render('ayirt', { sepet: req.session.sepet, toplam: toplamFiyat.toLocaleString('tr-TR'), success: false, error: 'Lütfen zorunlu alanları doldurun.', trackingCode: null });
    }
    const phoneDigits = normalizePhone(phone);
    if (phoneDigits && !/^[0-9]{10,11}$/.test(phoneDigits)) {
        return res.render('ayirt', { sepet: req.session.sepet, toplam: toplamFiyat.toLocaleString('tr-TR'), success: false, error: 'Geçersiz telefon numarası.', trackingCode: null });
    }

    try {
        const trackingCode = await generateUniqueTrackingCode(generateTrackingCode, 'orders');
        const [firstName, ...lastNameArr] = customer_name.split(' ');
        const lastName = lastNameArr.join(' ') || '';
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            let custRes = await client.query("SELECT id FROM customers WHERE phone = $1", [phoneDigits || phone]);
            let customerId;
            if (custRes.rows.length === 0) {
                const insCust = await client.query("INSERT INTO customers (first_name, last_name, phone, email) VALUES ($1, $2, $3, $4) RETURNING id", [firstName, lastName, phoneDigits || phone, email]);
                customerId = insCust.rows[0].id;
            } else {
                customerId = custRes.rows[0].id;
            }

            const insOrder = await client.query(`INSERT INTO orders (customer_id, tracking_code, payment_method, status, total_price) VALUES ($1, $2, $3, 'Beklemede', $4) RETURNING id`,
                                                [customerId, trackingCode, payment_method, toplamFiyat]);
            const orderId = insOrder.rows[0].id;

            for (const s of req.session.sepet) {
                await client.query(`INSERT INTO order_items (order_id, device_id, accessory_id, quantity, unit_price) VALUES ($1, $2, $3, $4, $5)`,
                                   [orderId, s.type === 'urun' ? s.item.id : null, s.type === 'aksesuar' ? s.item.id : null, s.miktar, parseFloat(s.item.price)]);
            }

            await client.query('COMMIT');
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }

        const sonSepet = [...req.session.sepet];
        const sonToplam = toplamFiyat.toLocaleString('tr-TR');
        req.session.sepet = [];
        
        res.render('ayirt', { sepet: sonSepet, toplam: sonToplam, success: true, trackingCode });
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.get('/admin/ayarlar', (req, res) => res.render('admin/ayarlar', { settings: adminSettings, success: null }));

app.post('/admin/ayarlar', async (req, res) => {
    const { whatsapp, whatsappActive, instagram, instagramActive, facebook, facebookActive, twitter, twitterActive, youtube, youtubeActive, maintenanceMode } = req.body;
    if (whatsapp !== undefined) adminSettings.whatsapp = whatsapp.trim();
    adminSettings.whatsappActive = !!whatsappActive;
    if (instagram !== undefined) adminSettings.instagram = instagram.trim();
    adminSettings.instagramActive = !!instagramActive;
    if (facebook !== undefined) adminSettings.facebook = facebook.trim();
    adminSettings.facebookActive = !!facebookActive;
    if (twitter !== undefined) adminSettings.twitter = twitter.trim();
    adminSettings.twitterActive = !!twitterActive;
    if (youtube !== undefined) adminSettings.youtube = youtube.trim();
    adminSettings.youtubeActive = !!youtubeActive;
    adminSettings.maintenanceMode = !!maintenanceMode;
    
    try {
        await db.query("UPDATE site_settings SET config = $1", [adminSettings]);
    } catch (err) {
        console.error("Settings update error:", err);
    }
    
    res.render('admin/ayarlar', { settings: adminSettings, success: 'Ayarlar başarıyla güncellendi.' });
});

app.get('/siparis/sorgula', (req, res) => res.render('siparis-sorgula', { result: null, error: null, form: {} }));

app.post('/siparis/sorgula', async (req, res) => {
    const { tracking_code, phone } = req.body;
    const code = String(tracking_code || '').trim().toUpperCase();
    const phoneDigits = normalizePhone(phone);

    if (!code || !phoneDigits) {
        return res.render('siparis-sorgula', { result: null, error: 'Lütfen takip kodu ve telefon numarası girin.', form: { tracking_code: tracking_code || '', phone: phone || '' } });
    }

    try {
        const orderRes = await db.query(`
            SELECT o.*, c.first_name || ' ' || c.last_name as customer_name, c.phone 
            FROM orders o JOIN customers c ON o.customer_id = c.id 
            WHERE UPPER(o.tracking_code) = $1 AND c.phone = $2
        `, [code, phoneDigits]);
        
        if (orderRes.rows.length === 0) {
            return res.render('siparis-sorgula', { result: null, error: 'Eşleşen sipariş bulunamadı.', form: { tracking_code: code, phone: phone || '' } });
        }
        
        const reservation = orderRes.rows[0];
        const itemsRes = await db.query("SELECT oi.*, COALESCE(d.name, a.name) as name FROM order_items oi LEFT JOIN devices d ON oi.device_id = d.id LEFT JOIN accessories a ON oi.accessory_id = a.id WHERE oi.order_id = $1", [reservation.id]);
        
        // Format to match EJS expectations
        reservation.items = itemsRes.rows.map(row => ({
            miktar: row.quantity,
            item: { name: row.name, price: row.unit_price }
        }));
        // Format date string for EJS layout compatibility
        if (reservation.order_date) {
            const d = new Date(reservation.order_date);
            reservation.date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
        reservation.total_price = parseFloat(reservation.total_price).toLocaleString('tr-TR');

        res.render('siparis-sorgula', { result: reservation, error: null, form: { tracking_code: code, phone: phone || '' } });
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.get('/admin/siparisler', async (req, res) => {
    try {
        const ordersRes = await db.query(`
            SELECT o.*, c.first_name || ' ' || c.last_name as customer_name, c.phone 
            FROM orders o JOIN customers c ON o.customer_id = c.id 
            ORDER BY o.order_date DESC
        `);
        const reservations = await Promise.all(ordersRes.rows.map(async r => {
            r.total_price = parseFloat(r.total_price).toLocaleString('tr-TR');
            if (r.order_date) {
                const d = new Date(r.order_date);
                r.date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            }
            const itemsRes = await db.query("SELECT oi.*, COALESCE(d.name, a.name) as name, COALESCE(d.brand, a.brand) as brand FROM order_items oi LEFT JOIN devices d ON oi.device_id = d.id LEFT JOIN accessories a ON oi.accessory_id = a.id WHERE oi.order_id = $1", [r.id]);
            r.items = itemsRes.rows.map(row => ({
                miktar: row.quantity,
                item: { name: row.name, brand: row.brand, price: row.unit_price }
            }));
            return r;
        }));
        res.render('admin/siparisler', { reservations, stokUyarilari: res.locals.stokUyarilari });
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.post('/admin/siparisler/:id/durum', async (req, res) => {
    try {
        if (req.body.status && ORDER_STATUS_WHITELIST.includes(req.body.status)) {
            await db.query("UPDATE orders SET status = $1 WHERE id = $2", [req.body.status, req.params.id]);
        }
        res.redirect('/admin/siparisler');
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.get('/admin/raporlar', async (req, res) => {
    try {
        let dateClauses = [];
        let dateParams = [];
        let dpIndex = 1;
        let rangeLabel = 'Tüm Zamanlar';
        
        const filters = {
            preset: req.query.preset || 'all',
            status: req.query.status || 'all',
            start: req.query.start || '',
            end: req.query.end || '',
            includePending: req.query.includePending || ''
        };

        if (filters.preset !== 'all' && (!filters.start && !filters.end)) {
            if (filters.preset === '7d') {
                dateClauses.push(`order_date >= CURRENT_DATE - INTERVAL '7 days'`);
                rangeLabel = 'Son 7 Gün';
            } else if (filters.preset === '14d') {
                dateClauses.push(`order_date >= CURRENT_DATE - INTERVAL '14 days'`);
                rangeLabel = 'Son 14 Gün';
            } else if (filters.preset === '30d') {
                dateClauses.push(`order_date >= CURRENT_DATE - INTERVAL '30 days'`);
                rangeLabel = 'Son 30 Gün';
            } else if (filters.preset === 'this_month') {
                dateClauses.push(`DATE_TRUNC('month', order_date) = DATE_TRUNC('month', CURRENT_DATE)`);
                rangeLabel = 'Bu Ay';
            } else if (filters.preset === 'last_month') {
                dateClauses.push(`DATE_TRUNC('month', order_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`);
                rangeLabel = 'Geçen Ay';
            } else if (filters.preset === 'ytd') {
                dateClauses.push(`DATE_TRUNC('year', order_date) = DATE_TRUNC('year', CURRENT_DATE)`);
                rangeLabel = 'Bu Yıl (YTD)';
            }
        } else if (filters.start || filters.end) {
            if (filters.start && filters.end) {
                dateClauses.push(`order_date >= $${dpIndex++} AND order_date <= $${dpIndex++}::timestamp + interval '1 day' - interval '1 second'`);
                dateParams.push(filters.start, filters.end);
                rangeLabel = `${filters.start} - ${filters.end}`;
            } else if (filters.start) {
                dateClauses.push(`order_date >= $${dpIndex++}`);
                dateParams.push(filters.start);
                rangeLabel = `${filters.start} sonrası`;
            } else if (filters.end) {
                dateClauses.push(`order_date <= $${dpIndex++}::timestamp + interval '1 day' - interval '1 second'`);
                dateParams.push(filters.end);
                rangeLabel = `${filters.end} öncesi`;
            }
        }

        let mainClauses = [...dateClauses, "status != 'İptal Edildi'"];
        let mainParams = [...dateParams];
        let mpIndex = dpIndex;

        if (filters.status !== 'all') {
            mainClauses.push(`status = $${mpIndex++}`);
            mainParams.push(filters.status);
        } else if (!filters.includePending) {
            mainClauses.push(`status != 'Beklemede'`);
        }

        const dateWhere = dateClauses.length > 0 ? `WHERE ${dateClauses.join(' AND ')}` : '';
        const mainWhere = mainClauses.length > 0 ? `WHERE ${mainClauses.join(' AND ')}` : '';

        const metricsRes = await db.query(`
            SELECT 
                COUNT(*) as order_count, 
                SUM(total_price) as revenue_total,
                AVG(total_price) as avg_order_value
            FROM orders
            ${mainWhere}
        `, mainParams);
        
        const metrics = metricsRes.rows[0];
        const orderCount = parseInt(metrics.order_count) || 0;
        const revenueTotal = parseFloat(metrics.revenue_total || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        const avgOrderValue = parseFloat(metrics.avg_order_value || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        const statusRes = await db.query(`SELECT status, COUNT(*) as count FROM orders ${dateWhere} GROUP BY status`, dateParams);
        const statusBreakdown = statusRes.rows;
        const totalStatusOrders = statusBreakdown.reduce((acc, curr) => acc + parseInt(curr.count), 0);
        statusBreakdown.forEach(s => {
            s.pct = totalStatusOrders > 0 ? (parseInt(s.count) / totalStatusOrders) * 100 : 0;
        });

        const dailyRes = await db.query(`
            SELECT DATE(order_date) as date, SUM(total_price) as revenue, COUNT(*) as count
            FROM orders
            ${mainWhere}
            GROUP BY DATE(order_date)
            ORDER BY DATE(order_date) ASC
        `, mainParams);
        
        const dailyLabels = JSON.stringify(dailyRes.rows.map(r => {
            const d = new Date(r.date);
            return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        }));
        const dailyData = JSON.stringify(dailyRes.rows.map(r => parseFloat(r.revenue)));
        const dailyTable = dailyRes.rows.map(r => {
            const d = new Date(r.date);
            return {
                day: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`,
                total: parseFloat(r.revenue),
                count: r.count
            };
        });

        const orderItemsJoin = `
            FROM order_items oi 
            JOIN orders o ON oi.order_id = o.id
        `;

        const topProductsRes = await db.query(`
            SELECT name, SUM(sales) as sales FROM (
                SELECT d.name, SUM(oi.quantity) as sales 
                ${orderItemsJoin} JOIN devices d ON oi.device_id = d.id 
                ${mainWhere.replace(/status /g, 'o.status ').replace(/order_date/g, 'o.order_date')}
                GROUP BY d.name
                UNION ALL
                SELECT a.name, SUM(oi.quantity) as sales 
                ${orderItemsJoin} JOIN accessories a ON oi.accessory_id = a.id 
                ${mainWhere.replace(/status /g, 'o.status ').replace(/order_date/g, 'o.order_date')}
                GROUP BY a.name
            ) AS combined_products
            GROUP BY name ORDER BY sales DESC LIMIT 5
        `, mainParams);
        const topProducts = topProductsRes.rows;

        const topBrandsRes = await db.query(`
            SELECT brand, SUM(sales) as sales FROM (
                SELECT d.brand, SUM(oi.quantity) as sales 
                ${orderItemsJoin} JOIN devices d ON oi.device_id = d.id 
                ${mainWhere.replace(/status /g, 'o.status ').replace(/order_date/g, 'o.order_date')}
                GROUP BY d.brand
                UNION ALL
                SELECT a.brand, SUM(oi.quantity) as sales 
                ${orderItemsJoin} JOIN accessories a ON oi.accessory_id = a.id 
                ${mainWhere.replace(/status /g, 'o.status ').replace(/order_date/g, 'o.order_date')}
                GROUP BY a.brand
            ) AS combined_brands
            GROUP BY brand ORDER BY sales DESC LIMIT 5
        `, mainParams);
        const topBrands = topBrandsRes.rows;

        res.render('admin/raporlar', {
            filters, rangeLabel, orderCount, revenueTotal, avgOrderValue,
            statusBreakdown, dailyLabels, dailyData, dailyTable,
            topProducts, topBrands, stokUyarilari: res.locals.stokUyarilari || []
        });
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.get('/admin/raporlar.csv', async (req, res) => {
    try {
        let dateClauses = [];
        let dateParams = [];
        let dpIndex = 1;

        const filters = {
            preset: req.query.preset || 'all',
            status: req.query.status || 'all',
            start: req.query.start || '',
            end: req.query.end || '',
            includePending: req.query.includePending || ''
        };

        if (filters.preset !== 'all' && (!filters.start && !filters.end)) {
            if (filters.preset === '7d') {
                dateClauses.push(`order_date >= CURRENT_DATE - INTERVAL '7 days'`);
            } else if (filters.preset === '14d') {
                dateClauses.push(`order_date >= CURRENT_DATE - INTERVAL '14 days'`);
            } else if (filters.preset === '30d') {
                dateClauses.push(`order_date >= CURRENT_DATE - INTERVAL '30 days'`);
            } else if (filters.preset === 'this_month') {
                dateClauses.push(`DATE_TRUNC('month', order_date) = DATE_TRUNC('month', CURRENT_DATE)`);
            } else if (filters.preset === 'last_month') {
                dateClauses.push(`DATE_TRUNC('month', order_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`);
            } else if (filters.preset === 'ytd') {
                dateClauses.push(`DATE_TRUNC('year', order_date) = DATE_TRUNC('year', CURRENT_DATE)`);
            }
        } else if (filters.start || filters.end) {
            if (filters.start && filters.end) {
                dateClauses.push(`order_date >= $${dpIndex++} AND order_date <= $${dpIndex++}::timestamp + interval '1 day' - interval '1 second'`);
                dateParams.push(filters.start, filters.end);
            } else if (filters.start) {
                dateClauses.push(`order_date >= $${dpIndex++}`);
                dateParams.push(filters.start);
            } else if (filters.end) {
                dateClauses.push(`order_date <= $${dpIndex++}::timestamp + interval '1 day' - interval '1 second'`);
                dateParams.push(filters.end);
            }
        }

        let mainClauses = [...dateClauses, "status != 'İptal Edildi'"];
        let mainParams = [...dateParams];
        let mpIndex = dpIndex;

        if (filters.status !== 'all') {
            mainClauses.push(`status = $${mpIndex++}`);
            mainParams.push(filters.status);
        } else if (!filters.includePending) {
            mainClauses.push(`status != 'Beklemede'`);
        }

        const mainWhere = mainClauses.length > 0 ? `WHERE ${mainClauses.join(' AND ')}` : '';

        const ordersRes = await db.query(`
            SELECT
                o.id,
                o.tracking_code,
                o.order_date,
                c.first_name || ' ' || c.last_name AS customer_name,
                c.phone,
                o.status,
                o.payment_method,
                o.total_price,
                COALESCE(
                    STRING_AGG(
                        (oi.quantity::text || 'x ' || COALESCE(d.name, a.name)),
                        ' | '
                        ORDER BY oi.id
                    ),
                    ''
                ) AS items
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            LEFT JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN devices d ON oi.device_id = d.id
            LEFT JOIN accessories a ON oi.accessory_id = a.id
            ${mainWhere.replace(/order_date/g, 'o.order_date').replace(/status/g, 'o.status')}
            GROUP BY o.id, o.tracking_code, o.order_date, c.first_name, c.last_name, c.phone, o.status, o.payment_method, o.total_price
            ORDER BY o.order_date DESC, o.id DESC
        `, mainParams);

        const toCSVCell = (v) => {
            const s = String(v ?? '')
                .replace(/(\r\n|\n|\r)/gm, ' ')
                .trim()
                .replace(/"/g, '""');
            return `"${s}"`;
        };

        const header = ['Sipariş ID', 'Takip Kodu', 'Tarih', 'Müşteri', 'Telefon', 'Durum', 'Ödeme', 'Toplam (TL)', 'Ürünler'];
        const lines = [
            header.join(';'),
            ...ordersRes.rows.map(r => {
                const d = r.order_date ? new Date(r.order_date) : null;
                const day = d
                    ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                    : '';
                const totalNum = Number(r.total_price || 0);
                const totalTR = totalNum.toFixed(2).replace('.', ',');
                return [
                    r.id,
                    r.tracking_code,
                    day,
                    r.customer_name,
                    r.phone,
                    r.status,
                    r.payment_method,
                    totalTR,
                    r.items
                ].map(toCSVCell).join(';');
            })
        ];

        const csv = '\uFEFF' + lines.join('\r\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="raporlar.csv"');
        res.status(200).send(csv);
    } catch (err) {
        console.error(err);
        res.status(500).send('Sunucu Hatası');
    }
});

app.get('/hakkimizda', (req, res) => res.render('hakkimizda', { firma_adi: config.name }));

app.get('/iletisim', (req, res) => res.render('iletisim', { firma_adi: config.name, success: false }));

app.post('/iletisim', async (req, res) => {
    const { name, phone, email, subject, message } = req.body;
    const phoneDigits = normalizePhone(phone);
    if (phoneDigits && !/^[0-9]{10,11}$/.test(phoneDigits)) {
        return res.render('iletisim', { firma_adi: config.name, success: false, error: 'Geçersiz telefon numarası.' });
    }
    try {
        await db.query("INSERT INTO messages (name, phone, email, subject, message) VALUES ($1, $2, $3, $4, $5)", 
                        [name, phoneDigits || phone, email, subject, message]);
        res.render('iletisim', { firma_adi: config.name, success: true });
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.get('/aksesuarlar', async (req, res) => {
    try {
        let query = "SELECT p.*, c.name as category, c.code as category_code, c.icon FROM accessories p JOIN categories c ON p.category_id = c.id WHERE 1=1";
        let params = [];
        if (req.query.search) {
            const s = req.query.search.toLowerCase();
            query += " AND (LOWER(p.name) LIKE $1 OR LOWER(c.name) LIKE $1)";
            params.push(`%${s}%`);
        }
        const aksRes = await db.query(query, params);
        
        const catRes = await db.query("SELECT name, code FROM categories WHERE code != 'telefon'");
        res.render('aksesuarlar', { firma_adi: config.name, aksesuarlar: aksRes.rows, uniqueCategories: catRes.rows, query: req.query });
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.get('/aksesuarlar/:id', async (req, res) => {
    try {
        const aksRes = await db.query("SELECT p.*, c.name as category, c.code as category_code, c.icon FROM accessories p JOIN categories c ON p.category_id = c.id WHERE p.id = $1", [req.params.id]);
        if (aksRes.rows.length === 0) return res.status(404).render('pages/error', { firma_adi: config.name, message: "Aksesuar bulunamadı." });
        res.render('detay', { firma_adi: config.name, item: aksRes.rows[0], type: 'aksesuar' });
    } catch(err) {
        console.error(err); res.status(500).send("Sunucu Hatası");
    }
});

app.use((req, res) => res.status(404).render('pages/error', { firma_adi: config.name, message: "Aradığınız sayfa bulunamadı." }));

app.listen(config.port, () => console.log(`Server dinleniyor: http://localhost:${config.port}`));
