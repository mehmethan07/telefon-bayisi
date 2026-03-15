const express = require('express');
const path = require('path');
const app = express();

const config = {
    name: "BAYİM",
    port: process.env.PORT || 8080
};

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.render('index', { firma_adi: config.name }); 
});

app.get('/admin', (req, res) => {
    res.render('admin/login', { firma_adi: config.name }); 
});

app.post('/admin/login', (req, res) => {
    const { email, password } = req.body;
    // TODO: Veritabanı entegrasyonu gelecek
    res.redirect('/admin/dashboard');
});

// Bilgi Sayfaları (İleride İçerik Eklenebilir)
const infoPages = ['urunler', 'aksesuarlar', 'servis', 'hakkimizda', 'iletisim'];
infoPages.forEach(page => {
    app.get(`/${page}`, (req, res) => {
        res.render('pages/error', { 
            firma_adi: config.name, 
            message: "Bu sayfa şu anda yapım aşamasındadır." 
        });
    });
});

// 404 Error Handling
app.use((req, res) => {
    res.status(404).render('pages/error', { 
        firma_adi: config.name, 
        message: "Aradığınız sayfa bulunamadı." 
    });
});

app.listen(config.port, () => {
    console.log(`Server dinleniyor: http://localhost:${config.port}`);
});