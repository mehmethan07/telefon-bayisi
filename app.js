const express = require('express');
const path = require('path');
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


const mesajlar = [];
const reservations = [];
const serviceRequests = [];
let sepet = [];
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

app.use((req, res, next) => {
    res.locals.firma_adi = config.name;
    res.locals.settings = adminSettings;
    res.locals.sepet_sayisi = sepet.reduce((toplam, urun) => toplam + urun.miktar, 0);
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

let mockProducts = [
    { id: 1, name: "iPhone 15 Pro", brand: "APPLE", price: "74.999", stock_status: "Stokta", image_url: "/images/telefon.webp", is_featured: true },
    { id: 2, name: "Galaxy S24 Ultra", brand: "SAMSUNG", price: "69.999", stock_status: "Stokta", image_url: "/images/telefon.webp", is_featured: true },
    { id: 3, name: "Redmi Note 13 Pro", brand: "XIAOMI", price: "18.499", stock_status: "Azalıyor", image_url: "/images/telefon.webp", is_featured: false }
];

let mockAksesuarlar = [
    { id: 201, name: "Apple Silikon Kılıf", category: "Kılıf & Koruma", category_code: "kilif", price: "899", icon: "fas fa-mobile-screen", is_featured: true },
    { id: 202, name: "20W USB-C Güç Adaptörü", category: "Şarj & Kablo", category_code: "sarj", price: "549", icon: "fas fa-plug", is_featured: false },
    { id: 203, name: "AirPods Pro 2", category: "Ses & Kulaklık", category_code: "kulaklik", price: "7.499", icon: "fas fa-headphones", is_featured: true },
    { id: 204, name: "Samsung 45W Şarj Aleti", category: "Şarj & Kablo", category_code: "sarj", price: "699", icon: "fas fa-bolt", is_featured: false },
    { id: 205, name: "Spigen Zırhlı Kılıf", category: "Kılıf & Koruma", category_code: "kilif", price: "449", icon: "fas fa-shield-halved", is_featured: false },
    { id: 206, name: "Type-C Örgü Kablo", category: "Şarj & Kablo", category_code: "sarj", price: "199", icon: "fas fa-usb", is_featured: false }
];

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

function parseTrMoney(text) {
    if (text === null || typeof text === 'undefined') return 0;
    const raw = String(text).trim();
    if (!raw) return 0;
    const normalized = raw.replace(/\./g, '').replace(',', '.');
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
}

function parseTrDateTime(text) {
    const s = String(text || '').trim();
    const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
    if (!m) return null;
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const hh = Number(m[4] || '00');
    const min = Number(m[5] || '00');
    const d = new Date(yyyy, mm - 1, dd, hh, min, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function endOfDay(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}

function formatDateKey(d) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
}

function computeRangeFromPreset(preset) {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    if (!preset) return { start: null, end: null, label: 'Tümü' };

    if (preset === '7d') return { start: startOfDay(new Date(todayStart.getTime() - 6 * 86400000)), end: todayEnd, label: 'Son 7 Gün' };
    if (preset === '14d') return { start: startOfDay(new Date(todayStart.getTime() - 13 * 86400000)), end: todayEnd, label: 'Son 14 Gün' };
    if (preset === '30d') return { start: startOfDay(new Date(todayStart.getTime() - 29 * 86400000)), end: todayEnd, label: 'Son 30 Gün' };
    if (preset === 'ytd') return { start: startOfDay(new Date(now.getFullYear(), 0, 1)), end: todayEnd, label: 'Yıl Başından Bugüne' };

    if (preset === 'this_month') {
        const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
        const end = todayEnd;
        return { start, end, label: 'Bu Ay' };
    }
    if (preset === 'last_month') {
        const start = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        const end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
        return { start, end, label: 'Geçen Ay' };
    }

    return { start: null, end: null, label: 'Tümü' };
}


app.get('/', (req, res) => {
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
});

app.get('/urunler', (req, res) => {
    let filteredProducts = mockProducts;
    if (req.query.search) {
        const s = req.query.search.toLowerCase();
        filteredProducts = filteredProducts.filter(p => 
            p.name.toLowerCase().includes(s) || 
            p.brand.toLowerCase().includes(s)
        );
    }
    // Tüm markalardan benzersiz liste oluştur (admin'den eklenenler dahil)
    const uniqueBrands = [...new Set(mockProducts.map(p => p.brand))];
    res.render('products', { catalogProducts: filteredProducts, uniqueBrands, query: req.query });
});

app.get('/urunler/:id', (req, res) => {
    const product = mockProducts.find(p => p.id == req.params.id);
    if (!product) return res.status(404).render('pages/error', { message: "Ürün bulunamadı." });
    const similarProducts = mockProducts.filter(p => p.id !== product.id && p.brand === product.brand).slice(0, 4);
    if(similarProducts.length < 4) {
        const others = mockProducts.filter(p => p.id !== product.id && p.brand !== product.brand).slice(0, 4 - similarProducts.length);
        similarProducts.push(...others);
    }
    res.render('detay', { item: product, type: 'urun', similarProducts });
});

app.get('/servis', (req, res) => {
    const mockOrders = [
        { id: 1024, customer_name: "Ahmet Y.", device_model: "iPhone 13 - Ekran Değişimi", status: "Hazır" },
        { id: 1025, customer_name: "Mehmet K.", device_model: "Samsung A54 - Batarya", status: "Onarımda" },
        { id: 1026, customer_name: "Ayşe S.", device_model: "Xiaomi Note 11 - Yazılım", status: "Beklemede" }
    ];
    res.render('servis', { orders: mockOrders });
});

app.get('/servis/kayit', (req, res) => {
    res.render('servis-kayit', { success: false, trackingCode: null });
});

app.post('/servis/kayit', (req, res) => {
    const { customer_name, phone, email, brand, device_model, issue_type, description } = req.body;
    if (!customer_name || !phone || !brand || !device_model || !issue_type) {
        return res.render('servis-kayit', { success: false, error: 'Lütfen zorunlu alanları doldurun.', trackingCode: null });
    }
    const phoneDigits = normalizePhone(phone);
    if (phoneDigits && !/^[0-9]{10,11}$/.test(phoneDigits)) {
        return res.render('servis-kayit', { success: false, error: 'Geçersiz telefon numarası.', trackingCode: null });
    }

    const createdAt = new Date();
    const dateStr = `${String(createdAt.getDate()).padStart(2, '0')}.${String(createdAt.getMonth() + 1).padStart(2, '0')}.${createdAt.getFullYear()} ${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`;
    const trackingCode = generateServiceTrackingCode();

    serviceRequests.push({
        id: Date.now(),
        tracking_code: trackingCode,
        customer_name,
        phone: phoneDigits || phone,
        email,
        brand,
        device_model,
        issue_type,
        description,
        status: 'Beklemede',
        date: dateStr
    });

    res.render('servis-kayit', { success: true, trackingCode });
});

app.use('/admin', (req, res, next) => {
    res.locals.stokUyarilari = mockProducts.filter(p => p.stock_status === 'Azalıyor' || p.stock_status === 'Tükendi');
    next();
});

app.get('/admin', (req, res) => {
    res.render('admin/login');
});

app.get('/admin/login', (req, res) => {
    res.render('admin/login');
});

app.post('/admin/login', (req, res) => {
    const { email, password } = req.body;
    res.redirect('/admin/dashboard');
});

app.get('/admin/mesajlar', (req, res) => {
    res.render('admin/mesajlar', { mesajlar, stokUyarilari: res.locals.stokUyarilari });
});

app.get('/admin/servis', (req, res) => {
    res.render('admin/servis', { requests: serviceRequests, stokUyarilari: res.locals.stokUyarilari });
});

app.post('/admin/servis/:id/durum', (req, res) => {
    const item = serviceRequests.find(r => r.id == req.params.id);
    if (item && req.body.status) {
        item.status = req.body.status;
    }
    res.redirect('/admin/servis');
});

app.get('/admin/raporlar', (req, res) => {
    const preset = String(req.query.preset || '').trim();
    const status = String(req.query.status || 'all').trim();
    const startInput = String(req.query.start || '').trim();
    const endInput = String(req.query.end || '').trim();
    const includePending = String(req.query.includePending || '0') === '1';

    const rangeFromPreset = computeRangeFromPreset(preset);
    let start = rangeFromPreset.start;
    let end = rangeFromPreset.end;
    let rangeLabel = rangeFromPreset.label;

    if (startInput && endInput) {
        const s = new Date(startInput + 'T00:00:00');
        const e = new Date(endInput + 'T23:59:59');
        if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
            start = s;
            end = e;
            rangeLabel = 'Özel Aralık';
        }
    }

    const selectedStatuses = status === 'all' ? null : [status];
    const revenueStatuses = includePending ? ['Beklemede', 'Onaylandı', 'Teslime Hazır', 'Teslim Edildi'] : ['Onaylandı', 'Teslime Hazır', 'Teslim Edildi'];

    const filtered = reservations.filter(r => {
        const d = parseTrDateTime(r.date);
        if (!d) return false;
        if (start && d < start) return false;
        if (end && d > end) return false;
        if (selectedStatuses && !selectedStatuses.includes(r.status)) return false;
        return true;
    });

    const statusCounts = {};
    const dailyRevenue = {};
    const productRevenue = {};
    const brandRevenue = {};

    let revenueTotal = 0;
    let orderCount = filtered.length;

    filtered.forEach(r => {
        statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;

        const d = parseTrDateTime(r.date);
        const dayKey = d ? formatDateKey(d) : 'Bilinmiyor';

        const orderTotal = parseTrMoney(r.total_price);
        const countsForRevenue = revenueStatuses.includes(r.status);
        if (countsForRevenue) {
            revenueTotal += orderTotal;
            dailyRevenue[dayKey] = (dailyRevenue[dayKey] || 0) + orderTotal;
        }

        if (Array.isArray(r.items)) {
            r.items.forEach(s => {
                const item = s && s.item ? s.item : null;
                if (!item) return;
                const qty = Number(s.miktar || 0) || 0;
                const unit = parseTrMoney(item.price);
                const line = unit * qty;
                const name = item.name || 'Bilinmiyor';
                const brand = item.brand || item.category || 'Bilinmiyor';
                if (countsForRevenue) {
                    productRevenue[name] = (productRevenue[name] || 0) + line;
                    brandRevenue[brand] = (brandRevenue[brand] || 0) + line;
                }
            });
        }
    });

    const avgOrderValue = orderCount > 0 ? revenueTotal / orderCount : 0;

    const dailyKeysSorted = Object.keys(dailyRevenue).sort((a, b) => {
        const da = parseTrDateTime(a);
        const db = parseTrDateTime(b);
        if (!da || !db) return a.localeCompare(b);
        return da - db;
    });

    const topProducts = Object.entries(productRevenue).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topBrands = Object.entries(brandRevenue).sort((a, b) => b[1] - a[1]).slice(0, 10);

    const statusList = ['Beklemede', 'Onaylandı', 'Teslime Hazır', 'Teslim Edildi', 'İptal Edildi'];
    const statusBreakdown = statusList.map(s => ({
        status: s,
        count: statusCounts[s] || 0,
        pct: orderCount > 0 ? ((statusCounts[s] || 0) / orderCount) * 100 : 0
    }));

    res.render('admin/raporlar', {
        filters: { preset, status, start: startInput, end: endInput, includePending },
        rangeLabel,
        orderCount,
        revenueTotal: revenueTotal.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
        avgOrderValue: avgOrderValue.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
        statusBreakdown,
        dailyLabels: JSON.stringify(dailyKeysSorted),
        dailyData: JSON.stringify(dailyKeysSorted.map(k => Math.round(dailyRevenue[k] || 0))),
        dailyTable: dailyKeysSorted.map(k => ({ day: k, total: dailyRevenue[k] || 0 })),
        topProducts,
        topBrands
    });
});

app.get('/admin/raporlar.csv', (req, res) => {
    const preset = String(req.query.preset || '').trim();
    const status = String(req.query.status || 'all').trim();
    const startInput = String(req.query.start || '').trim();
    const endInput = String(req.query.end || '').trim();
    const includePending = String(req.query.includePending || '0') === '1';

    const rangeFromPreset = computeRangeFromPreset(preset);
    let start = rangeFromPreset.start;
    let end = rangeFromPreset.end;
    if (startInput && endInput) {
        const s = new Date(startInput + 'T00:00:00');
        const e = new Date(endInput + 'T23:59:59');
        if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
            start = s;
            end = e;
        }
    }

    const selectedStatuses = status === 'all' ? null : [status];
    const revenueStatuses = includePending ? ['Beklemede', 'Onaylandı', 'Teslime Hazır', 'Teslim Edildi'] : ['Onaylandı', 'Teslime Hazır', 'Teslim Edildi'];

    const rows = reservations
        .filter(r => {
            const d = parseTrDateTime(r.date);
            if (!d) return false;
            if (start && d < start) return false;
            if (end && d > end) return false;
            if (selectedStatuses && !selectedStatuses.includes(r.status)) return false;
            return true;
        })
        .map(r => {
            const d = parseTrDateTime(r.date);
            const isRevenue = revenueStatuses.includes(r.status);
            return {
                tracking_code: r.tracking_code || '',
                date: r.date || '',
                customer_name: r.customer_name || '',
                phone: r.phone || '',
                status: r.status || '',
                payment_method: r.payment_method || '',
                items_count: Array.isArray(r.items) ? r.items.length : 0,
                total_price: r.total_price || '',
                revenue_included: isRevenue ? 'Evet' : 'Hayır'
            };
        });

    const header = ['tracking_code', 'date', 'customer_name', 'phone', 'status', 'payment_method', 'items_count', 'total_price', 'revenue_included'];
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
        header.join(','),
        ...rows.map(r => header.map(k => escape(r[k])).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=\"raporlar.csv\"');
    res.send('\uFEFF' + csv);
});

app.get('/admin/dashboard', (req, res) => {
    const aylikKazanc = reservations
        .filter(r => r.status === 'Onaylandı')
        .reduce((toplam, r) => toplam + parseFloat(r.total_price.replace('.','')), 0);

    const bekleyenSiparis = reservations.filter(r => r.status === 'Beklemede').length;
    
    const sonSiparisler = reservations.slice().reverse().slice(0, 5);
    const sonMesajlar = mesajlar.slice().reverse().slice(0, 5);
    
    const stokUyarilari = res.locals.stokUyarilari;

    const chartLabels = ['Ekim', 'Kasım', 'Aralık', 'Ocak', 'Şubat', 'Mart'];
    const chartData = [125000, 180000, 250000, 140000, 210000, aylikKazanc > 0 ? aylikKazanc : 95000];

    const topBrands = [
        { brand: "APPLE", sales: 145 },
        { brand: "SAMSUNG", sales: 98 },
        { brand: "XIAOMI", sales: 64 }
    ];

    const renderData = { 
        stats: {
            urun_sayisi: mockProducts.length,
            aksesuar_sayisi: mockAksesuarlar.length,
            aylik_kazanc: aylikKazanc.toLocaleString('tr-TR'),
            bekleyen_siparis: bekleyenSiparis
        },
        sonSiparisler,
        sonMesajlar,
        chartLabels: JSON.stringify(chartLabels),
        chartData: JSON.stringify(chartData),
        topBrands,
        stokUyarilari: res.locals.stokUyarilari || []
    };
    
    res.locals.stokUyarilari = renderData.stokUyarilari;
    res.locals.topBrands = topBrands;
    
    res.render('admin/dashboard', renderData);
});

app.get('/admin/urunler', (req, res) => {
    const uniqueBrands = [...new Set(mockProducts.map(p => p.brand))];
    res.render('admin/urunler', { products: mockProducts, uniqueBrands, stokUyarilari: res.locals.stokUyarilari });
});

app.post('/admin/urunler/ekle', (req, res) => {
    let { name, brand, new_brand, price, stock_status, image_url, is_featured } = req.body;
    const finalBrand = (brand === 'yeni' && new_brand) ? new_brand.toUpperCase() : brand;
    
    const newId = mockProducts.length ? Math.max(...mockProducts.map(p => p.id)) + 1 : 1;
    mockProducts.push({ id: newId, name, brand: finalBrand, price, stock_status, image_url: image_url || '/images/telefon.webp', is_featured: is_featured === 'on' });
    res.redirect('/admin/urunler');
});

app.post('/admin/urunler/:id/duzenle', (req, res) => {
    let { name, brand, new_brand, price, stock_status, image_url, is_featured } = req.body;
    const finalBrand = (brand === 'yeni' && new_brand) ? new_brand.toUpperCase() : brand;

    const product = mockProducts.find(p => p.id == req.params.id);
    if(product) {
        product.name = name;
        product.brand = finalBrand;
        product.price = price;
        product.stock_status = stock_status;
        product.is_featured = is_featured === 'on';
        if(image_url) product.image_url = image_url;
    }
    res.redirect('/admin/urunler');
});

app.post('/admin/urunler/:id/sil', (req, res) => {
    mockProducts = mockProducts.filter(p => p.id != req.params.id);
    res.redirect('/admin/urunler');
});

app.get('/admin/aksesuarlar', (req, res) => {
    const uniqueCategoriesMap = new Map();
    mockAksesuarlar.forEach(a => {
        if(!uniqueCategoriesMap.has(a.category)) {
            uniqueCategoriesMap.set(a.category, a.category_code);
        }
    });
    const uniqueCategories = Array.from(uniqueCategoriesMap, ([name, code]) => ({ name, code }));

    res.render('admin/aksesuarlar', { aksesuarlar: mockAksesuarlar, uniqueCategories, stokUyarilari: res.locals.stokUyarilari });
});

function slugify(text) {
    const trMap = { 'çÇ':'c', 'ğĞ':'g', 'şŞ':'s', 'üÜ':'u', 'ıİ':'i', 'öÖ':'o' };
    for(let key in trMap) {
        text = text.replace(new RegExp('['+key+']','g'), trMap[key]);
    }
    return text.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

app.post('/admin/aksesuarlar/ekle', (req, res) => {
    let { name, category, price, icon, is_featured } = req.body;
    let finalCategoryCode = slugify(category);

    const existing = mockAksesuarlar.find(a => a.category === category);
    if(existing) finalCategoryCode = existing.category_code;

    const newId = mockAksesuarlar.length ? Math.max(...mockAksesuarlar.map(a => a.id)) + 1 : 201;
    mockAksesuarlar.push({ id: newId, name, category, category_code: finalCategoryCode || 'diger', price, icon: icon || 'fas fa-plug', is_featured: is_featured === 'on' });
    res.redirect('/admin/aksesuarlar');
});

app.post('/admin/aksesuarlar/:id/duzenle', (req, res) => {
    let { name, category, price, icon, is_featured } = req.body;
    let finalCategoryCode = slugify(category);

    const existing = mockAksesuarlar.find(a => a.category === category);
    if(existing) finalCategoryCode = existing.category_code;

    const aksesuar = mockAksesuarlar.find(a => a.id == req.params.id);
    if(aksesuar) {
        aksesuar.name = name;
        aksesuar.category = category;
        aksesuar.category_code = finalCategoryCode;
        aksesuar.price = price;
        aksesuar.is_featured = is_featured === 'on';
        if(icon) aksesuar.icon = icon;
    }
    res.redirect('/admin/aksesuarlar');
});

app.post('/admin/aksesuarlar/:id/sil', (req, res) => {
    mockAksesuarlar = mockAksesuarlar.filter(a => a.id != req.params.id);
    res.redirect('/admin/aksesuarlar');
});

app.post('/sepet/ekle', (req, res) => {
    const { type, id } = req.body;
    let item = type === 'urun' ? mockProducts.find(p => p.id == id) : mockAksesuarlar.find(a => a.id == id);
    const backUrl = req.get('referer') || '/urunler';
    
    if (item) {
        if (type === 'urun' && item.stock_status === 'Tükendi') {
            if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
                return res.json({ success: false, message: 'Bu ürün tükendi.' });
            }
            return res.redirect(backUrl);
        }
        const mevcut = sepet.find(s => s.item.id === item.id && s.type === type);
        if (mevcut) {
            mevcut.miktar += 1;
        } else {
            sepet.push({ item, type, miktar: 1 });
        }
    }
    
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.json({ 
            success: true, 
            message: 'Ürün sepete eklendi', 
            cartCount: sepet.reduce((toplam, urun) => toplam + urun.miktar, 0)
        });
    }
    
    res.redirect('/sepet');
});

app.get('/sepet/sil/:type/:id', (req, res) => {
    const { type, id } = req.params;
    sepet = sepet.filter(s => !(s.type === type && s.item.id == id));
    res.redirect('/sepet');
});

app.post('/sepet/artir/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const item = sepet.find(s => s.type === type && s.item.id == id);
    if (item) {
        if (type === 'urun') {
            const currentProduct = mockProducts.find(p => p.id == id);
            if (currentProduct && currentProduct.stock_status === 'Tükendi') {
                return res.redirect('/sepet');
            }
        }
        item.miktar += 1;
    }
    res.redirect('/sepet');
});

app.post('/sepet/azalt/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const item = sepet.find(s => s.type === type && s.item.id == id);
    if (item) {
        item.miktar -= 1;
        if (item.miktar <= 0) {
            sepet = sepet.filter(s => !(s.type === type && s.item.id == id));
        }
    }
    res.redirect('/sepet');
});

app.get('/sepet', (req, res) => {
    const toplamFiyat = sepet.reduce((acc, curr) => acc + (parseFloat(curr.item.price.replace('.','')) * curr.miktar), 0);
    const formatliFiyat = toplamFiyat.toLocaleString('tr-TR');
    res.render('sepet', { sepet, toplamFiyat: formatliFiyat });
});

app.get('/siparis/tamamla', (req, res) => {
    if (sepet.length === 0) return res.redirect('/sepet');
    const toplamFiyat = sepet.reduce((acc, curr) => acc + (parseFloat(curr.item.price.replace('.','')) * curr.miktar), 0);
    res.render('ayirt', { sepet, toplam: toplamFiyat.toLocaleString('tr-TR'), success: false, trackingCode: null });
});

app.post('/siparis/tamamla', (req, res) => {
    if (sepet.length === 0) return res.redirect('/sepet');

    const { customer_name, phone, email, payment_method } = req.body;
    const toplamFiyat = sepet.reduce((acc, curr) => acc + (parseFloat(curr.item.price.replace('.','')) * curr.miktar), 0);
    
    if (!customer_name || !phone || !payment_method) {
        return res.render('ayirt', { sepet, toplam: toplamFiyat.toLocaleString('tr-TR'), success: false, error: 'Lütfen zorunlu alanları doldurun.', trackingCode: null });
    }
    const phoneDigits = normalizePhone(phone);
    if (phoneDigits && !/^[0-9]{10,11}$/.test(phoneDigits)) {
        return res.render('ayirt', { sepet, toplam: toplamFiyat.toLocaleString('tr-TR'), success: false, error: 'Geçersiz telefon numarası.', trackingCode: null });
    }

    const tarih = new Date();
    const dateStr = `${String(tarih.getDate()).padStart(2, '0')}.${String(tarih.getMonth() + 1).padStart(2, '0')}.${tarih.getFullYear()} ${String(tarih.getHours()).padStart(2, '0')}:${String(tarih.getMinutes()).padStart(2, '0')}`;
    const trackingCode = generateTrackingCode();

    reservations.push({
        id: Date.now(),
        tracking_code: trackingCode,
        customer_name, phone: phoneDigits || phone, email, payment_method,
        items: [...sepet],
        total_price: toplamFiyat.toLocaleString('tr-TR'),
        status: 'Beklemede',
        date: dateStr
    });

    const sonSepet = [...sepet];
    const sonToplam = toplamFiyat.toLocaleString('tr-TR');
    sepet = [];
    
    res.render('ayirt', { sepet: sonSepet, toplam: sonToplam, success: true, trackingCode });
});

app.get('/admin/ayarlar', (req, res) => {
    res.render('admin/ayarlar', { settings: adminSettings, success: null });
});

app.post('/admin/ayarlar', (req, res) => {
    const { 
        whatsapp, whatsappActive, 
        instagram, instagramActive, facebook, facebookActive, 
        twitter, twitterActive, youtube, youtubeActive, maintenanceMode 
    } = req.body;
    
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
    
    res.render('admin/ayarlar', { settings: adminSettings, success: 'Ayarlar başarıyla güncellendi.' });
});

app.get('/siparis/sorgula', (req, res) => {
    res.render('siparis-sorgula', { result: null, error: null, form: {} });
});

app.post('/siparis/sorgula', (req, res) => {
    const { tracking_code, phone } = req.body;
    const code = String(tracking_code || '').trim().toUpperCase();
    const phoneDigits = normalizePhone(phone);

    if (!code || !phoneDigits) {
        return res.render('siparis-sorgula', {
            result: null,
            error: 'Lütfen takip kodu ve telefon numarası girin.',
            form: { tracking_code: tracking_code || '', phone: phone || '' }
        });
    }

    const reservation = reservations.find(r =>
        String(r.tracking_code || '').toUpperCase() === code &&
        normalizePhone(r.phone) === phoneDigits
    );

    if (!reservation) {
        return res.render('siparis-sorgula', {
            result: null,
            error: 'Eşleşen sipariş bulunamadı. Bilgileri kontrol edip tekrar deneyin.',
            form: { tracking_code: code, phone: phone || '' }
        });
    }

    res.render('siparis-sorgula', {
        result: reservation,
        error: null,
        form: { tracking_code: code, phone: phone || '' }
    });
});

app.get('/admin/siparisler', (req, res) => {
    res.render('admin/siparisler', { reservations, stokUyarilari: res.locals.stokUyarilari });
});

app.post('/admin/siparisler/:id/durum', (req, res) => {
    const resv = reservations.find(r => r.id == req.params.id);
    if (resv && req.body.status) {
        const currentStatus = resv.status;
        const nextStatus = req.body.status;

        const allowedTransitions = {
            'Beklemede': ['Beklemede', 'Onaylandı', 'İptal Edildi'],
            'Onaylandı': ['Onaylandı', 'Teslime Hazır'],
            'Teslime Hazır': ['Teslime Hazır', 'Teslim Edildi'],
            'Teslim Edildi': ['Teslim Edildi'],
            'İptal Edildi': ['İptal Edildi']
        };

        const allowedNext = allowedTransitions[currentStatus] || [currentStatus];
        if (allowedNext.includes(nextStatus)) {
            resv.status = nextStatus;
        }
    }
    res.redirect('/admin/siparisler');
});

app.get('/hakkimizda', (req, res) => {
    res.render('hakkimizda', { firma_adi: config.name });
});

app.get('/iletisim', (req, res) => {
    res.render('iletisim', { firma_adi: config.name, success: false });
});

app.post('/iletisim', (req, res) => {
    const { name, phone, email, subject, message } = req.body;
    const phoneDigits = normalizePhone(phone);
    if (phoneDigits && !/^[0-9]{10,11}$/.test(phoneDigits)) {
        return res.render('iletisim', { firma_adi: config.name, success: false, error: 'Geçersiz telefon numarası.' });
    }
    const tarih = new Date();
    const gun = String(tarih.getDate()).padStart(2, '0');
    const ay = String(tarih.getMonth() + 1).padStart(2, '0');
    const saat = String(tarih.getHours()).padStart(2, '0');
    const dakika = String(tarih.getMinutes()).padStart(2, '0');

    mesajlar.push({
        name, phone: phoneDigits || phone, email, subject, message,
        date: `${gun}.${ay}.${tarih.getFullYear()} ${saat}:${dakika}`
    });
    res.render('iletisim', { firma_adi: config.name, success: true });
});

app.get('/aksesuarlar', (req, res) => {
    let filteredAksesuarlar = mockAksesuarlar;
    if (req.query.search) {
        const s = req.query.search.toLowerCase();
        filteredAksesuarlar = filteredAksesuarlar.filter(a => 
            a.name.toLowerCase().includes(s) || 
            a.category.toLowerCase().includes(s)
        );
    }

    // Tüm kategorilerden benzersiz liste oluştur (admin'den eklenenler dahil)
    const uniqueCategoriesMap = new Map();
    mockAksesuarlar.forEach(a => {
        if (!uniqueCategoriesMap.has(a.category_code)) {
            uniqueCategoriesMap.set(a.category_code, a.category);
        }
    });
    const uniqueCategories = Array.from(uniqueCategoriesMap, ([code, name]) => ({ code, name }));

    res.render('aksesuarlar', { firma_adi: config.name, aksesuarlar: filteredAksesuarlar, uniqueCategories, query: req.query });
});

app.get('/aksesuarlar/:id', (req, res) => {
    const aksesuar = mockAksesuarlar.find(a => a.id == req.params.id);
    if (!aksesuar) return res.status(404).render('pages/error', { firma_adi: config.name, message: "Aksesuar bulunamadı." });
    res.render('detay', { firma_adi: config.name, item: aksesuar, type: 'aksesuar' });
});

app.use((req, res) => {
    res.status(404).render('pages/error', {
        firma_adi: config.name,
        message: "Aradığınız sayfa bulunamadı."
    });
});

app.listen(config.port, () => {
    console.log(`Server dinleniyor: http://localhost:${config.port}`);
});
