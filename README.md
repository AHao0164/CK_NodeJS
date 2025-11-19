## Laptop E-commerce (Node.js + React + MySQL, Microservices)

This project is a microservices-based e-commerce system for selling laptops. It includes authentication, catalog/product management, shopping cart, order processing, a mock payment service, an API gateway, and a React frontend. Everything is Dockerized for local development.

### Business Analysis

- **Customer personas**: Retail buyers of laptops and accessories.
- **Core flows**:
  - Browse catalog (filter by brand/spec/price), view product details and stock
  - Add to cart, update quantities, remove
  - Checkout: address, shipping method, payment
  - Order placement and status tracking
  - Authentication: signup, login, JWT-based sessions
  - Admin (future): manage products, inventory, promotions
- **Key entities**:
  - Users, Sessions (JWT), Addresses
  - Products, Categories, Brands, ProductImages, Inventory (per product)
  - Carts, CartItems
  - Orders, OrderItems, Payments (mock), Shipments (future)
- **Non-functional**:
  - Microservice autonomy (each service owns its schema)
  - API gateway centralizes routing and auth
  - MySQL single instance, multiple logical schemas per service
  - Horizontal scalability: stateless services
  - Observability: request logging (future: tracing/metrics)

### Services & Responsibilities

- **Auth Service**: Signup, login, issue/verify JWT; manages `users`.
- **Catalog Service**: Products, categories, brands, inventory, product images.
- **Cart Service**: Per-user carts and line items.
- **Order Service**: Checkout, create order from cart, order status, order items.
- **Payment Service (mock)**: Create payment intent, confirm/cancel; demo only.
- **API Gateway**: Routes requests to services, enforces auth, rate limits (future).
- **Webapp (React)**: Customer-facing UI: browse, cart, checkout, orders.
- **Admin App (React)**: Admin UI: manage products, brands, categories, inventory, orders.

### Tech Stack

- Backend: Node.js, Express, MySQL (`mysql2/promise`), JWT
- Frontend: React + Vite
- Infra: Docker, docker-compose

### Run Locally

1. Install Docker Desktop.
2. In this folder, run:
   ```bash
   docker compose up --build
   ```
3. Services:
   - API Gateway: `http://localhost:8080`
   - Webapp: `http://localhost:5173`
   - Admin App: `http://localhost:5174`
   - MySQL: `localhost:3306` (user: `root`, pass: `rootpw`)

### Environment

Shared defaults are in `docker-compose.yml`. Services accept env vars for DB host, user, password, and schema names.

### Initial API (MVP)

- Auth: `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`
- Catalog: `GET /catalog/products`, `GET /catalog/products/:id`
- Cart: `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:itemId`, `DELETE /cart/items/:itemId`
- Order: `POST /orders/checkout`, `GET /orders/:orderId`
- Payment (mock): `POST /payment/intents`, `POST /payment/intents/:id/confirm`

### Admin APIs

- Auth (admin): `GET /admin/users`
- Catalog (admin):
  - `GET /admin/catalog/products`, `POST /admin/catalog/products`, `PUT /admin/catalog/products/:id`, `DELETE /admin/catalog/products/:id`
  - `GET /admin/catalog/brands`, `POST /admin/catalog/brands`, `DELETE /admin/catalog/brands/:id`
  - `GET /admin/catalog/categories`, `POST /admin/catalog/categories`, `DELETE /admin/catalog/categories/:id`
  - `PATCH /admin/catalog/inventory/:productId`
- Orders (admin):
  - `GET /admin/orders`, `GET /admin/orders/:orderId`, `PATCH /admin/orders/:orderId/status`

All admin routes require a JWT for a user with role `ADMIN` and are enforced by the API Gateway.

### Seeding an Admin User

Set the following environment variables on the Auth Service (already wired via docker-compose support if you add them):

```
ADMIN_SEED_EMAIL=admin@example.com
ADMIN_SEED_PASSWORD=strongpassword
ADMIN_SEED_FULLNAME=Site Admin
```

On startup, the auth service will create the admin if missing or promote an existing user to `ADMIN`.

### Seed Data

- Requirements: Ensure the stack is running and healthy (`docker compose up --build`).
- The seeding script will:
  - Create demo users: `user1@example.com` and `user2@example.com`
  - Populate brands, categories, products, inventory (idempotent)
  - Create demo carts and paid orders for both users
- Run:
  ```bash
  # in a separate terminal, install seeder deps and run
  cd tools/seed
  npm i
  node seed.js
  ```
  - Optional: set API base if different
  ```bash
  API_BASE=http://localhost:8080 node seed.js
  ```

### Notes

- This MVP favors clarity over completeness. Extend with admin endpoints, filters, search, and real payments as needed.


