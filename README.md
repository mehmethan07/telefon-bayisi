# Telefon Bayisi - Satış & Teknik Servis Platformu

Bu proje, bir telefon bayisinin cihaz ve aksesuar satışlarını, mağazadan ürün ayırtma süreçlerini ve teknik servis takip operasyonlarını profesyonelce yönetebileceği, modern ve duyarlı (responsive) bir web uygulamasıdır.

## 🚀 Öne Çıkan Özellikler

* **Kargo Yerine Mağazadan Ayırtma (Click & Collect):** Kargo süreçlerinden tamamen bağımsız, mağaza odaklı "Sepete Ekle -> Mağazada Ayırt -> Elden Teslim Al" iş akışı.
* **Gelişmiş Servis & Sipariş Takip Sistemi:** Kullanıcıların kendilerine özel `SRV-123456` (Servis) ve `SP-123456` (Sipariş) formatındaki kodlar ile anlık olarak durumlarını sorgulayabilmesi.
* **Modern ve Duyarlı (Responsive) Tasarım:** Masaüstü, tablet ve mobil cihazlar için CSS Grid ve Flexbox ile tamamen uyarlanmış, yüksek kaliteli bir arayüz.
* **Dinamik Yönetim Paneli (Admin):**
  * Ürün ve Aksesuar yönetimi
  * Sipariş (Ayırtma) ve Teknik Servis durum güncellemeleri (Sıkı durum kontrol mekanizmaları ile)
  * Genel Site Ayarları (Aktif/Pasif ayarlanabilir, link eklenebilir sosyal medya modülleri, WhatsApp iletişim entegrasyonu)
* **Premium Footer & Arayüz Detayları:** Hover animasyonları, kurumsal linkler ve ödeme seçenekleri rozetleriyle donatılmış dinamik alt bilgi alanı.

## 🛠️ Teknolojiler

* **Backend:** Node.js, Express.js
* **Frontend:** EJS (Şablon Motoru), Modern Vanilla CSS
* **Veritabanı:** In-memory (Veritabanı entegrasyonu hazırlık aşamasında)
* **İkonlar ve Fontlar:** FontAwesome 6, Google Fonts (Space Grotesk, Inter)

## 📦 Kurulum

1. Depoyu klonlayın:  
```bash
git clone https://github.com/mehmethan07/telefon-bayisi.git
```

2. Proje dizinine gidin:  
```bash
cd telefon-bayisi
```

3. Bağımlılıkları yükleyin:  
```bash
npm install
```

4. Uygulamayı başlatın:  
```bash
npm start
```
*Uygulama varsayılan olarak `http://localhost:8080` adresinde çalışacaktır.*

## 📌 Geliştirme Notları

* Proje tamamen kargo bağımlılıklarından arındırılmış, yerel mağaza müşterilerine yönelik tasarlanmıştır.
* Mevcut sürümde tüm kayıtlar, ayarlar ve oturumlar geçici olarak bellek (in-memory) üzerinde tutulmaktadır. Üretim ortamına geçişte bir SQL/NoSQL veritabanı (örn. MongoDB, PostgreSQL) entegrasyonu yapılması hedeflenmektedir.
* EJS ve Express.js yapısı sayesinde sayfa içi hata yönetimleri (not defined sorunlarına karşı güvenlik önlemleri) alınmıştır.

## 📝 Lisans

Bu proje ISC lisansı altındadır.