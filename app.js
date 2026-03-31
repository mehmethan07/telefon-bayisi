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
let sepet = [];

app.use((req, res, next) => {
    res.locals.firma_adi = config.name;
    res.locals.sepet_sayisi = sepet.reduce((toplam, urun) => toplam + urun.miktar, 0);
    res.locals.currentPath = req.path;
    next();
});

let mockProducts = [
    { id: 1, name: "iPhone 15 Pro", brand: "APPLE", price: "74.999", stock_status: "Stokta", image_url: "/images/telefon.webp" },
    { id: 2, name: "Galaxy S24 Ultra", brand: "SAMSUNG", price: "69.999", stock_status: "Stokta", image_url: "/images/telefon.webp" },
    { id: 3, name: "Redmi Note 13 Pro", brand: "XIAOMI", price: "18.499", stock_status: "Azalıyor", image_url: "/images/telefon.webp" }
];

let mockAksesuarlar = [
    { id: 201, name: "Apple Silikon Kılıf", category: "Kılıf & Koruma", category_code: "kilif", price: "899", icon: "fas fa-mobile-screen" },
    { id: 202, name: "20W USB-C Güç Adaptörü", category: "Şarj & Kablo", category_code: "sarj", price: "549", icon: "fas fa-plug" },
    { id: 203, name: "AirPods Pro 2", category: "Ses & Kulaklık", category_code: "kulaklik", price: "7.499", icon: "fas fa-headphones" },
    { id: 204, name: "Samsung 45W Şarj Aleti", category: "Şarj & Kablo", category_code: "sarj", price: "699", icon: "fas fa-bolt" },
    { id: 205, name: "Spigen Zırhlı Kılıf", category: "Kılıf & Koruma", category_code: "kilif", price: "449", icon: "fas fa-shield-halved" },
    { id: 206, name: "Type-C Örgü Kablo", category: "Şarj & Kablo", category_code: "sarj", price: "199", icon: "fas fa-usb" }
];


app.get('/', (req, res) => {
    const data = { 
        products: mockProducts, 
        featuredProducts: mockProducts, 
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
    res.render('products', { catalogProducts: filteredProducts, query: req.query });
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
    res.render('servis-kayit', { success: false });
});

app.post('/servis/kayit', (req, res) => {
    const { customer_name, phone, email, brand, device_model, issue_type, description } = req.body;
    if (!customer_name || !phone || !brand || !device_model || !issue_type) {
        return res.render('servis-kayit', { success: false, error: 'Lütfen zorunlu alanları doldurun.' });
    }
    if (phone && !/^[0-9]{10,11}$/.test(phone)) {
        return res.render('servis-kayit', { success: false, error: 'Geçersiz telefon numarası.' });
    }
    res.render('servis-kayit', { success: true });
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
    let { name, brand, new_brand, price, stock_status, image_url } = req.body;
    const finalBrand = (brand === 'yeni' && new_brand) ? new_brand.toUpperCase() : brand;
    
    const newId = mockProducts.length ? Math.max(...mockProducts.map(p => p.id)) + 1 : 1;
    mockProducts.push({ id: newId, name, brand: finalBrand, price, stock_status, image_url: image_url || '/images/telefon.webp' });
    res.redirect('/admin/urunler');
});

app.post('/admin/urunler/:id/duzenle', (req, res) => {
    let { name, brand, new_brand, price, stock_status, image_url } = req.body;
    const finalBrand = (brand === 'yeni' && new_brand) ? new_brand.toUpperCase() : brand;

    const product = mockProducts.find(p => p.id == req.params.id);
    if(product) {
        product.name = name;
        product.brand = finalBrand;
        product.price = price;
        product.stock_status = stock_status;
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
    let { name, category, price, icon } = req.body;
    let finalCategoryCode = slugify(category);

    const existing = mockAksesuarlar.find(a => a.category === category);
    if(existing) finalCategoryCode = existing.category_code;

    const newId = mockAksesuarlar.length ? Math.max(...mockAksesuarlar.map(a => a.id)) + 1 : 201;
    mockAksesuarlar.push({ id: newId, name, category, category_code: finalCategoryCode || 'diger', price, icon: icon || 'fas fa-plug' });
    res.redirect('/admin/aksesuarlar');
});

app.post('/admin/aksesuarlar/:id/duzenle', (req, res) => {
    let { name, category, price, icon } = req.body;
    let finalCategoryCode = slugify(category);

    const existing = mockAksesuarlar.find(a => a.category === category);
    if(existing) finalCategoryCode = existing.category_code;

    const aksesuar = mockAksesuarlar.find(a => a.id == req.params.id);
    if(aksesuar) {
        aksesuar.name = name;
        aksesuar.category = category;
        aksesuar.category_code = finalCategoryCode;
        aksesuar.price = price;
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
    
    if (item) {
        const mevcut = sepet.find(s => s.item.id === item.id && s.type === type);
        if (mevcut) {
            mevcut.miktar += 1;
        } else {
            sepet.push({ item, type, miktar: 1 });
        }
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
    if (item) item.miktar += 1;
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
    res.render('ayirt', { sepet, toplam: toplamFiyat.toLocaleString('tr-TR'), success: false });
});

app.post('/siparis/tamamla', (req, res) => {
    if (sepet.length === 0) return res.redirect('/sepet');

    const { customer_name, phone, email, payment_method } = req.body;
    const toplamFiyat = sepet.reduce((acc, curr) => acc + (parseFloat(curr.item.price.replace('.','')) * curr.miktar), 0);
    
    if (!customer_name || !phone || !payment_method) {
        return res.render('ayirt', { sepet, toplam: toplamFiyat.toLocaleString('tr-TR'), success: false, error: 'Lütfen zorunlu alanları doldurun.' });
    }
    if (phone && !/^[0-9]{10,11}$/.test(phone)) {
        return res.render('ayirt', { sepet, toplam: toplamFiyat.toLocaleString('tr-TR'), success: false, error: 'Geçersiz telefon numarası.' });
    }

    const tarih = new Date();
    const dateStr = `${String(tarih.getDate()).padStart(2, '0')}.${String(tarih.getMonth() + 1).padStart(2, '0')}.${tarih.getFullYear()} ${String(tarih.getHours()).padStart(2, '0')}:${String(tarih.getMinutes()).padStart(2, '0')}`;

    reservations.push({
        id: Date.now(),
        customer_name, phone, email, payment_method,
        items: [...sepet],
        total_price: toplamFiyat.toLocaleString('tr-TR'),
        status: 'Beklemede',
        date: dateStr
    });

    const sonSepet = [...sepet];
    const sonToplam = toplamFiyat.toLocaleString('tr-TR');
    sepet = [];
    
    res.render('ayirt', { sepet: sonSepet, toplam: sonToplam, success: true });
});

app.get('/admin/siparisler', (req, res) => {
    res.render('admin/siparisler', { reservations, stokUyarilari: res.locals.stokUyarilari });
});

app.post('/admin/siparisler/:id/durum', (req, res) => {
    const resv = reservations.find(r => r.id == req.params.id);
    if(resv && req.body.status) {
        resv.status = req.body.status;
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
    if (phone && !/^[0-9]{10,11}$/.test(phone)) {
        return res.render('iletisim', { firma_adi: config.name, success: false, error: 'Geçersiz telefon numarası.' });
    }
    const tarih = new Date();
    const gun = String(tarih.getDate()).padStart(2, '0');
    const ay = String(tarih.getMonth() + 1).padStart(2, '0');
    const saat = String(tarih.getHours()).padStart(2, '0');
    const dakika = String(tarih.getMinutes()).padStart(2, '0');

    mesajlar.push({
        name, phone, email, subject, message,
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
    res.render('aksesuarlar', { firma_adi: config.name, aksesuarlar: filteredAksesuarlar, query: req.query });
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
