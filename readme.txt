Tên dự án: GK - Microservices (Node.js + Express + MySQL + Docker)

1) Cấu trúc thư mục chính
- backend/
  - database/
    - database            (script SQL tạo schema, tách database theo service và seed dữ liệu mẫu)
  - services/
    - auth/               (Auth Service - đăng ký/đăng nhập, JWT)
      - Dockerfile
      - package.json
      - src/index.js
    - catalog/            (Catalog Service - sản phẩm, brand, category, hình ảnh, tồn kho)
      - Dockerfile
      - package.json
      - src/index.js
    - cart/               (Cart Service - giỏ hàng theo user)
      - Dockerfile
      - package.json
      - src/index.js
    - order/              (Order Service - tạo đơn hàng, coupon, order items)
      - Dockerfile
      - package.json
      - src/index.js
- frontend/
  - Dockerfile           (build Vite, serve bằng Nginx)
  - package.json
  - src/
    - api/               (lớp gọi API: client, auth, catalog, cart)
    - context/           (AuthContext: login/register/logout, lưu token)
    - components/        (UI components)
    - App.jsx, main.jsx
- gateway/
  - nginx.conf           (API gateway reverse proxy: /api/* tới các services, đồng thời serve FE)
- docker-compose.yml     (khởi chạy MySQL, các service, gateway, frontend)
- readme.txt             (tệp này)

2) Yêu cầu môi trường
- Docker và Docker Compose

3) Chạy dự án (khuyến nghị)
- Lần đầu hoặc muốn làm mới dữ liệu:
  1. docker compose down -v
  2. docker compose up -d --build
- Nếu chỉ cập nhật frontend:
  1. docker compose build frontend
  2. docker compose up -d

4) Dịch vụ và cổng
- Gateway (Nginx + FE): http://localhost:8080
- MySQL: 3306 (container mysql, user root/password root)
- Các service chạy trong mạng nội bộ Docker (được proxy qua gateway):
  - Auth Service: http://auth-service:4001 (qua gateway: /api/auth/*)
  - Catalog Service: http://catalog-service:4002 (qua gateway: /api/catalog/*)
  - Cart Service: http://cart-service:4003 (qua gateway: /api/cart/*)
  - Order Service: http://order-service:4004 (qua gateway: /api/orders/*)

5) API chính qua gateway
- Auth
  - POST /api/auth/register     body: { email, password, fullName }
  - POST /api/auth/login        body: { email, password }
  - GET  /api/auth/health
- Catalog
  - GET  /api/catalog/products
  - GET  /api/catalog/products/:id
  - GET  /api/catalog/categories
  - GET  /api/catalog/brands
- Cart (yêu cầu header x-user-id)
  - GET    /api/cart/
  - POST   /api/cart/items      body: { productId, quantity, priceCents }
  - DELETE /api/cart/items/:productId
- Orders
  - POST /api/orders/checkout   body: { userId, items[{productId, quantity, priceCents}], shipping?, coupon? }
  - GET  /api/orders/:id

6) Dữ liệu mẫu (seed)
- Database được tách theo service:
  - auth_db: bảng users (seed user mặc định khi auth-service khởi động)
  - catalog_db: brands, categories, products, product_images, inventory (seed mẫu)
  - cart_db: carts, cart_items (khởi tạo khi người dùng thêm vào giỏ)
  - order_db: orders, order_items, coupons (seed coupon mẫu)
- Tài khoản mẫu:
  - User:  user@example.com / 123456

7) Frontend tích hợp
- FE gọi API qua cùng domain: base URL /api (tránh CORS)
- Lớp API FE: src/api/
  - client.js (apiRequest)
  - auth.js (register, login)
  - catalog.js (getProducts, getProductById, getCategories, getBrands)
  - cart.js (getCart, addToCart, removeFromCart)
- AuthContext: src/context/AuthContext.jsx
  - Cung cấp login/register/logout, lưu user/token vào localStorage
- ProductDetail.jsx
  - Tải sản phẩm thật nếu URL /product/:id
  - Nút Add to Cart: nếu chưa đăng nhập chuyển /login; đã đăng nhập thì gọi /api/cart/items
- FloatingMenuButton.jsx
  - Nếu chưa đăng nhập, nút Profile dẫn tới /login
  - Nếu đã đăng nhập, hiển thị thông tin người dùng và Logout
  - Nút Cart mở SideCart; nếu chưa đăng nhập sẽ chuyển /login
- SideCart.jsx
  - Khi mở và đã đăng nhập: gọi /api/cart/ để hiển thị các item, có thể xóa item

8) Cấu hình gateway (nginx)
- Proxy prefix:
  - /api/auth/     -> auth-service:4001
  - /api/catalog/  -> catalog-service:4002
  - /api/cart/     -> cart-service:4003
  - /api/orders/   -> order-service:4004
- Static FE: /usr/share/nginx/html

9) Healthcheck và chờ MySQL
- docker-compose.yml có healthcheck cho mysql, các service phụ thuộc chỉ khởi động khi mysql healthy
- auth-service có cơ chế chờ MySQL (retry) và seed user mặc định sau khi DB sẵn sàng

10) Khắc phục sự cố
- Lỗi 502 khi gọi /api/auth/login:
  - Nguyên nhân thường: MySQL chưa init xong hoặc script init lỗi
  - Cách xử lý nhanh:
    1) docker compose down -v
    2) docker compose up -d --build
    3) Kiểm tra: curl http://localhost:8080/api/auth/health (phải 200)
- FE không build do lockfile: Dockerfile FE đã dùng "npm install --legacy-peer-deps"
- Kiểm tra log:
  - docker compose logs --tail=200 mysql auth-service gateway frontend

11) Ghi chú phát triển
- Khi sửa code service, có thể rebuild service đó:
  - docker compose build auth-service && docker compose up -d
- Khi thay đổi script SQL init, cần xóa volume DB để init lại:
  - docker compose down -v && docker compose up -d --build
