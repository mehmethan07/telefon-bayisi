# Telefon Bayisi Projesi

Bu proje, bir telefon bayisinin günlük işlerini (sipariş alma, teknik servis takibi, stok yönetimi ve iletişim) web üzerinden yürütebilmesi için geliştirilmiştir. **TBL331: Veritabanı Yönetim Sistemleri** dersi dönem projesi olarak hazırlanmıştır ve arka planda **PostgreSQL** veritabanı kullanmaktadır.

## 1. Problem Tanımı

Küçük telefon bayilerinde stok takibi, müşteri siparişleri ve teknik servis süreçleri çoğunlukla kâğıt üzerinde veya excel tablolarıyla yürütülüyor. Bu da ciddi sorunlara yol açıyor: hangi ürünün ne kadar kaldığını anlık göremiyorsunuz, müşteri cihazının servis durumunu takip etmek zorlaşıyor, ciro hesabı yapmak için saatler harcıyorsunuz.

Bu projeyle yukarıdaki sorunları çözmeye çalıştık. Müşteriler ürünleri listeleyip sipariş verebiliyor, teknik servis talebi açabiliyor ve takip kodu ile servis durumunu sorgulayabiliyor. Yönetici tarafında ise tüm süreçler tek panel üzerinden yönetilabiliyor.

## 2. Yapılan Araştırmalar

Proje boyunca birkaç teknik konuda araştırma yapmamız gerekti:

* **Normalizasyon ve tablo tasarımı:** Hangi verilerin hangi tabloda tutulacağına karar verirken hayli araştırma yaptık. PK, FK, UNIQUE ve CHECK kısıtlarını eklerken PostgreSQL dökümantasyonundan çok faydalandık.

* **Stored Procedure (PL/pgSQL):** Müşteri kaydı, sipariş oluşturma ve stok güncellemenin aynı anda gerçekleşmesini istiyorduk; bunun için `create_order_proc` ve `create_service_proc` prosedürlerini yazdık. `CALL` komutuyla nasıl çağrılacağını anlamak biraz zaman aldı.

* **Trigger:** Sipariş kalemleri eklenince `orders.total_price` alanının otomatik güncellenmesini sağlayan `trg_update_order_total` tetikleyicisini ekledik. Bir de servis durumu değişince log oluşturan `trg_service_status_log` var.

* **Oturum ve şifre güvenliği:** Admin paneli için `express-session` ile oturum yönetimi kuruldu. Şifreler `bcryptjs` ile hashlenip veritabanına kaydediliyor.

* **Raporlama:** orders ve order_items tablolarını JOIN ile birleştirip GROUP BY ile günlük/dönemsel ciro hesapladık. Sonuçları **Chart.js** ile grafik olarak gösterdik.

## 3. Akış Şeması

### 3.1 Müşteri Akış Şeması

```mermaid
flowchart TD
    A([Kullanıcı Siteye Girer]) --> B[Ana Sayfa]
    B --> C{Ne yapmak istiyor?}

    C -->|Ürün / Aksesuar İncele| D[Ürün Listesi]
    D --> E{Filtre / Arama?}
    E -->|Evet| F[Marka veya İsme Göre Filtrele]
    F --> G[Ürün Detay]
    E -->|Hayır| G
    G --> H[Sepete Ekle]
    H --> I[Sepet Sayfası]
    I --> J[Ad, Soyad, Telefon, Ödeme Yöntemi Gir]
    J --> K{Bilgiler Geçerli mi?}
    K -->|Hayır| L[Hata Mesajı]
    L --> J
    K -->|Evet| M[create_order_proc Çalışır]
    M --> N{Müşteri Kayıtlı mı?}
    N -->|Hayır| O[customers Tablosuna Yeni Kayıt]
    N -->|Evet| P[Mevcut Müşteri Kullanılır]
    O --> Q[orders Tablosuna Sipariş Eklenir]
    P --> Q
    Q --> R[SP-XXXXXX Takip Kodu Üretilir]
    R --> S[trg_update_order_total Tetiklenir]
    S --> T([Sipariş Alındı Sayfası])

    C -->|Servis Kaydı Aç| U[Servis Formu]
    U --> V{Form Eksiksiz mi?}
    V -->|Hayır| W[Hata Mesajı]
    W --> U
    V -->|Evet| X[create_service_proc Çalışır]
    X --> Y{Müşteri Kayıtlı mı?}
    Y -->|Hayır| Z[customers Tablosuna Yeni Kayıt]
    Y -->|Evet| AA[Mevcut Müşteri Kullanılır]
    Z --> AB[service_requests Tablosuna Kayıt]
    AA --> AB
    AB --> AC([SRV-XXXXXX Takip Kodu ile Onay])

    C -->|Takip Sorgula| AD[Takip Kodu Gir]
    AD --> AE{SP- mi, SRV- mi?}
    AE -->|SP-| AF[orders Tablosunda Ara]
    AE -->|SRV-| AG[service_requests Tablosunda Ara]
    AF --> AH{Kayıt Var mı?}
    AG --> AH
    AH -->|Evet| AI([Durum ve Detaylar Gösterilir])
    AH -->|Hayır| AJ([Kayıt Bulunamadı])
```

### 3.2 Yönetici (Admin) Akış Şeması

```mermaid
flowchart TD
    A([Admin Giriş Sayfası]) --> B[Kullanıcı Adı ve Şifre Gir]
    B --> C{bcryptjs ile Doğrulama}
    C -->|Başarısız| D[Hatalı Giriş Mesajı]
    D --> B
    C -->|Başarılı| E[Admin Dashboard]

    E --> F{Hangi Modül?}

    F -->|Ürün Yönetimi| G[Ürün / Aksesuar Listesi]
    G --> H{İşlem Seç}
    H -->|Yeni Ekle| I[Form Doldur]
    I --> J[devices veya accessories Tablosuna Ekle]
    H -->|Düzenle| K[Fiyat / Stok Durumu Güncelle]
    K --> J
    H -->|Sil| L[Kayıt Silinir]

    F -->|Sipariş Yönetimi| M[Siparişler Listesi]
    M --> N[Durum Güncelle: Onaylandı / Teslim Edildi / İptal]
    N --> O[orders.status Güncellenir]

    F -->|Teknik Servis| P[Servis Talepleri Listesi]
    P --> Q[Durum Güncelle: Onarımda / Tamamlandı]
    Q --> R[trg_service_status_log Tetiklenir]

    F -->|Raporlar| S[Tarih Aralığı Seç]
    S --> T[orders + order_items JOIN ile Ciro Hesabı]
    T --> U[Chart.js ile Günlük Ciro Grafiği]
    T --> V[En Çok Ciro Ürün ve Marka Listesi]
    S --> W[CSV Olarak İndir]

    F -->|Ayarlar| X[Sistem Ayarları Formu]
    X --> Y[site_settings Tablosuna UPSERT]
```

## 4. Yazılım Mimarisi

Projeyi MVC (Model-View-Controller) yapısına göre kurguladık.

* **View (Görünüm):** `views/` klasöründeki EJS şablonları. Kullanıcı arayüzü özel CSS ile yapıldı, karanlık tema ağırlıklı bir tasarım benimsedik. Sepet localStorage'da tutuluyor, grafikler Chart.js ile çiziliyor.

* **Controller (Denetleyici):** `app.js` dosyasındaki Express route'ları. HTTP isteklerini karşılar, iş mantığını çalıştırır, veritabanıyla konuşur. Admin oturumları express-session, şifreler bcryptjs ile yönetiliyor.

* **Model (Veritabanı):** PostgreSQL tarafında 10 tablo, 2 stored procedure ve 2 trigger. Node.js ile bağlantı `pg` (node-postgres) kütüphanesi üzerinden `db.js` dosyası aracılığıyla sağlanıyor.

## 5. Veri Tabanı Diyagramı (ER Diyagramı)

```mermaid
erDiagram
    categories {
        serial id PK
        varchar name
        varchar code UK
        text description
        varchar icon
        timestamp created_at
    }

    devices {
        serial id PK
        int category_id FK
        varchar name
        varchar brand
        numeric price
        varchar stock_status
        text image_url
        boolean is_featured
        timestamp created_at
    }

    accessories {
        serial id PK
        int category_id FK
        varchar name
        varchar brand
        numeric price
        varchar stock_status
        text image_url
        boolean is_featured
        timestamp created_at
    }

    customers {
        serial id PK
        varchar first_name
        varchar last_name
        varchar phone UK
        varchar email
        timestamp created_at
    }

    orders {
        serial id PK
        int customer_id FK
        varchar tracking_code UK
        varchar payment_method
        varchar status
        numeric total_price
        timestamp order_date
    }

    order_items {
        serial id PK
        int order_id FK
        int device_id FK
        int accessory_id FK
        int quantity
        numeric unit_price
    }

    service_requests {
        serial id PK
        int customer_id FK
        varchar tracking_code UK
        varchar brand
        varchar device_model
        varchar issue_type
        text description
        varchar status
        timestamp request_date
    }

    admins {
        serial id PK
        varchar username UK
        varchar password
        timestamp created_at
    }

    messages {
        serial id PK
        varchar name
        varchar phone
        varchar email
        varchar subject
        text message
        timestamp sent_date
    }

    site_settings {
        serial id PK
        jsonb config
    }

    categories ||--o{ devices : "1 kategori, çok ürün"
    categories ||--o{ accessories : "1 kategori, çok aksesuar"
    customers ||--o{ orders : "1 müşteri, çok sipariş"
    customers ||--o{ service_requests : "1 müşteri, çok servis talebi"
    orders ||--|{ order_items : "1 sipariş, çok ürün kalemi"
    devices |o--o{ order_items : "cihaz sipariş kalemine eklenebilir"
    accessories |o--o{ order_items : "aksesuar sipariş kalemine eklenebilir"
```

## 6. Genel Yapı

1. **Admin Girişi:** `/admin/login` üzerinden bcryptjs ile şifre doğrulaması yapılıyor. Başarılı girişte express-session ile oturum açılıyor. Admin sayfaları oturum kontrolü middleware'i ile korunuyor.

2. **Ürün Kataloğu ve Sepet:** Müşteriler telefon ve aksesuar listelerini görebiliyor, localStorage tabanlı sepete ürün ekleyebilip sipariş formuyla tamamlayabiliyor.

3. **Sipariş Yönetimi:** `create_order_proc` stored procedure'ü üzerinden yeni müşteri + sipariş + SP-XXXXXX takip kodu tek seferde oluşturuluyor. `trg_update_order_total` tetikleyicisi sipariş toplamını otomatik hesaplıyor.

4. **Teknik Servis:** `create_service_proc` prosedürüyle SRV-XXXXXX takip kodlu servis talepleri açılıyor. Müşteri `/sorgula` sayfasından güncel durumu takip edebiliyor.

5. **Raporlama:** Admin panelinde orders + order_items JOIN'i ile günlük/dönemsel ciro hesaplanıyor, Chart.js ile grafiğe dökülüyor, CSV olarak indirilebiliyor.

6. **İletişim Mesajları:** Müşterilerden gelen mesajlar `messages` tablosuna kaydediliyor ve admin panelinden okunabiliyor.

## 7. Kurulum

1. **Gereksinimler:** Node.js (v18+) ve PostgreSQL (v14+) kurulu olmalı.

2. **Paket kurulumu:**
   ```bash
   npm install
   ```

3. **Çevre değişkenleri:** Kök dizine `.env` dosyası oluşturun:
   ```env
   DB_USER=postgres
   DB_PASSWORD=veritabani_sifreniz
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=telefon_bayisi
   SESSION_SECRET=oturum_gizli_anahtari
   ```

4. **Veritabanı:** PostgreSQL'de `telefon_bayisi` adında veritabanı oluşturun ve `database.sql` dosyasını çalıştırın.

5. **Uygulamayı başlatma:**
   ```bash
   npm run dev
   ```

6. **Erişim:** `http://localhost:8080` — Admin girişi: kullanıcı adı `admin`, şifre `admin`

## 8. Referanslar

1. Node.js dökümantasyonu: https://nodejs.org
2. Express.js: https://expressjs.com
3. PostgreSQL PL/pgSQL: https://www.postgresql.org/docs/current/plpgsql.html
4. MDN Web Docs: https://developer.mozilla.org
5. Chart.js: https://www.chartjs.org
6. bcryptjs: https://github.com/dcodeIO/bcrypt.js
7. node-postgres: https://node-postgres.com