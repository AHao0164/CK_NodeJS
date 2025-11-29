# Hướng dẫn Test ElasticSearch Integration

## 1. Kiểm tra ElasticSearch đang chạy

```bash
# Kiểm tra health của ElasticSearch
curl http://localhost:9200/_cluster/health

# Kiểm tra index đã được tạo
curl http://localhost:9200/products

# Xem số lượng documents trong index
curl http://localhost:9200/products/_count
```

## 2. Sync toàn bộ products vào ElasticSearch

### Cách 1: Dùng curl
```bash
curl -X POST http://localhost:8080/admin/catalog/sync-elasticsearch \
  -H "x-user-role: ADMIN" \
  -H "x-user-id: 1"
```

### Cách 2: Dùng Postman/Thunder Client
- Method: POST
- URL: `http://localhost:8080/admin/catalog/sync-elasticsearch`
- Headers:
  - `x-user-role: ADMIN`
  - `x-user-id: 1`

### Cách 3: Từ Frontend (nếu có admin panel)
Gọi API endpoint sync từ admin dashboard

## 3. Test Search với ElasticSearch

### Test 1: Search cơ bản
```bash
# Search "laptop"
curl "http://localhost:8080/catalog/products?q=laptop&page=1&pageSize=10"
```

### Test 2: Search với filters
```bash
# Search với category filter
curl "http://localhost:8080/catalog/products?q=laptop&categoryId=1&page=1&pageSize=10"

# Search với price range
curl "http://localhost:8080/catalog/products?q=laptop&minPrice=1000000&maxPrice=5000000&page=1&pageSize=10"

# Search với rating filter
curl "http://localhost:8080/catalog/products?q=laptop&minRating=4&page=1&pageSize=10"
```

### Test 3: Search với sort
```bash
# Sort by price ascending
curl "http://localhost:8080/catalog/products?q=laptop&sort=price_asc&page=1&pageSize=10"

# Sort by price descending
curl "http://localhost:8080/catalog/products?q=laptop&sort=price_desc&page=1&pageSize=10"
```

### Test 4: Fuzzy search (tìm với lỗi chính tả)
```bash
# Tìm "lapto" thay vì "laptop"
curl "http://localhost:8080/catalog/products?q=lapto&page=1&pageSize=10"
```

## 4. Test CRUD Operations và Auto-Sync

### Test Create Product
```bash
curl -X POST http://localhost:8080/admin/catalog/products \
  -H "Content-Type: application/json" \
  -H "x-user-role: ADMIN" \
  -H "x-user-id: 1" \
  -d '{
    "name": "Test Product ElasticSearch",
    "description": "Sản phẩm test cho ElasticSearch",
    "priceCents": 2000000,
    "categoryId": 1,
    "brandId": 1,
    "stock": 100
  }'
```

Sau đó kiểm tra trong ElasticSearch:
```bash
curl "http://localhost:9200/products/_search?q=name:Test+Product+ElasticSearch"
```

### Test Update Product
```bash
# Lấy product ID từ response trên
curl -X PUT http://localhost:8080/admin/catalog/products/{PRODUCT_ID} \
  -H "Content-Type: application/json" \
  -H "x-user-role: ADMIN" \
  -H "x-user-id: 1" \
  -d '{
    "name": "Test Product ElasticSearch Updated",
    "priceCents": 2500000
  }'
```

Kiểm tra update trong ElasticSearch:
```bash
curl "http://localhost:9200/products/_doc/{PRODUCT_ID}"
```

### Test Delete Product
```bash
curl -X DELETE http://localhost:8080/admin/catalog/products/{PRODUCT_ID} \
  -H "x-user-role: ADMIN" \
  -H "x-user-id: 1"
```

Kiểm tra đã xóa khỏi ElasticSearch:
```bash
curl "http://localhost:9200/products/_doc/{PRODUCT_ID}"
# Sẽ trả về 404 nếu đã xóa
```

## 5. Kiểm tra Logs

### Xem logs của catalog-service
```bash
docker-compose logs catalog-service --tail 50
```

Tìm các log:
- `✅ ElasticSearch index created successfully`
- `✅ Synced X products to ElasticSearch`
- `⚠️ Falling back to MySQL search` (nếu có lỗi)

### Xem logs của ElasticSearch
```bash
docker-compose logs elasticsearch --tail 50
```

## 6. So sánh Performance

### Test với ElasticSearch (mặc định)
```bash
time curl "http://localhost:8080/catalog/products?q=laptop&page=1&pageSize=20"
```

### Test fallback về MySQL (tạm thời stop ElasticSearch)
```bash
docker-compose stop elasticsearch
time curl "http://localhost:8080/catalog/products?q=laptop&page=1&pageSize=20"
docker-compose start elasticsearch
```

## 7. Kiểm tra Index Mapping

```bash
curl http://localhost:9200/products/_mapping
```

## 8. Test với nhiều từ khóa

```bash
# Multi-word search
curl "http://localhost:8080/catalog/products?q=laptop+gaming+asus&page=1&pageSize=10"
```

## 9. Kiểm tra Relevance Scoring

ElasticSearch sẽ tự động rank kết quả theo relevance. Sản phẩm có:
- Tên match chính xác sẽ có điểm cao hơn
- Match nhiều fields sẽ có điểm cao hơn
- Match ở brand/category sẽ có điểm cao hơn

## 10. Test Edge Cases

### Test với query rỗng
```bash
curl "http://localhost:8080/catalog/products?page=1&pageSize=10"
```

### Test với query rất dài
```bash
curl "http://localhost:8080/catalog/products?q=laptop+gaming+asus+rog+strix+intel+core+i7+rtx+4090&page=1&pageSize=10"
```

### Test với special characters
```bash
curl "http://localhost:8080/catalog/products?q=laptop%20%26%20gaming&page=1&pageSize=10"
```

## Troubleshooting

### Nếu ElasticSearch không kết nối được:
1. Kiểm tra ElasticSearch đang chạy: `docker-compose ps elasticsearch`
2. Kiểm tra health: `curl http://localhost:9200/_cluster/health`
3. Xem logs: `docker-compose logs elasticsearch`

### Nếu search không hoạt động:
1. Kiểm tra đã sync products chưa
2. Xem logs catalog-service để biết có fallback về MySQL không
3. Kiểm tra index có tồn tại: `curl http://localhost:9200/products`

### Nếu sync không hoạt động:
1. Kiểm tra admin authentication
2. Xem logs catalog-service
3. Kiểm tra MySQL connection

