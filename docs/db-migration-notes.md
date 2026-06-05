## Veritabanı Geçiş Notları (Raporlar)

Projenin başında sipariş verilerini js dizisinde tutuyorduk ama sunucu kapanınca veriler sıfırlanıyordu.
PostgreSQL'e geçerken aldığım notlar bunlar, sonra lazım olur diye buraya yazdım.

### Tablolar nasıl olmalı

**orders:**
- id (otomatik)
- tracking_code → UNIQUE, SP- ile başlıyor
- customer_name
- phone → sadece rakam tutuyoruz normalizePhone ile
- email → boş olabilir
- payment_method
- status
- created_at
- total_price (sayısal olmalı, string tutmak hata çıkardı)

**order_items:**
- id
- order_id → orders.id'ye bağlı (FK)
- type → 'urun' veya 'aksesuar'
- item_id
- item_name
- brand_or_category
- unit_price
- quantity

### Rapor sorguları

Tarih filtresi için:
- `WHERE created_at BETWEEN başlangıç AND bitiş`
- durum filtresi: `AND status = 'Onaylandı'` (all seçilmezse)

Ciro hesabı:
- `SUM(total_price)` — sadece teslim edilen/onaylanan siparişler sayılacak

Günlük kırılım:
- `GROUP BY DATE(created_at)` ile çözüldü

Ürün/marka bazlı kırılım:
- order_items ile JOIN yapıp GROUP BY item_name veya brand_or_category

### Dikkat edilecekler

total_price dizi versiyonunda string tutuluyordu, parseFloat ile çeviriyorduk.
DB'ye geçince numeric olduğu için bu sorun kalktı.
Ayrıca tarihler de JS Date yerine timestamp olduğundan karşılaştırma çok daha kolay oldu.
