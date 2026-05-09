## DB'ye geçiş notları (Raporlar)

Bu proje şu an in-memory veri tutuyor (`reservations` dizisi). Finans raporları da bu diziyi filtreleyip metrik üretiyor.
PostgreSQL entegrasyonunda aynı mantık SQL sorgularına taşınacak.

### Önerilen tablo/alanlar

#### orders (sipariş/ayırtma)
- `id` (bigint / uuid)
- `tracking_code` (text, **unique**)
- `customer_name` (text)
- `phone` (text) — **normalize edilmiş** (sadece rakam)
- `email` (text, nullable)
- `payment_method` (text)
- `status` (text veya enum)
- `created_at` (timestamp)
- `total_price` (numeric)

#### order_items
- `id`
- `order_id` (fk -> orders.id)
- `type` (text: urun/aksesuar)
- `item_id` (bigint)
- `item_name` (text) — DB'de ürün tablosu varsa `product_id` ile tutulabilir
- `brand_or_category` (text)
- `unit_price` (numeric)
- `quantity` (int)

### Rapor sorgu karşılıkları (örnek)

- Tarih aralığı ve durum filtresi:
  - `WHERE created_at BETWEEN :start AND :end`
  - `AND status = :status` (status=all değilse)
- Ciro:
  - `SUM(total_price)` (status in 'Onaylandı','Teslime Hazır','Teslim Edildi' [+opsiyonel 'Beklemede'])
- Günlük ciro:
  - `GROUP BY DATE(created_at)`
- Ürün/marka ciro kırılımı:
  - `JOIN order_items` + `GROUP BY item_name` / `brand_or_category`

### Not
- Şu anki formatlarda (`total_price` string, `date` string) geçici parse yapılıyor.
  DB'ye geçince bunlar numeric/timestamp olacağı için raporlar daha sağlam ve hızlı çalışır.

