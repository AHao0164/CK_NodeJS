# 🛒 PCShop - E-Commerce Platform

> Hệ thống thương mại điện tử với kiến trúc Microservices hiện đại

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## 📋 Mô Tả Dự Án

PCShop là một nền tảng thương mại điện tử được xây dựng với kiến trúc **Microservices**, sử dụng các công nghệ hiện đại như Node.js, Redis, MySQL, Docker và CI/CD. Dự án thể hiện khả năng thiết kế và triển khai hệ thống phân tán quy mô lớn.

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                 │
├─────────────────────┬───────────────────────────────────────────┤
│   Frontend (React)   │        Admin App (React)                  │
│   - Customer UI      │        - Dashboard                        │
│   - Product Catalog   │        - Order Management                 │
│   - Shopping Cart     │        - Product Management               │
└─────────┬───────────┴──────────────┬────────────────────────────┘
          │                          │
          ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway (Express)                        │
│                  - Rate Limiting & Auth                          │
│                  - Request Routing                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Auth Service  │  │ Catalog Service │  │  Cart Service   │
│ - JWT/OAuth   │  │ - Products      │  │  - Redis Store  │
│ - Sessions    │  │ - Categories    │  │  - Guest/User   │
│ - Redis Cache │  │ - Search (ES)   │  │                 │
└───────────────┘  │ - AI Chatbot    │  └─────────────────┘
                   └─────────────────┘
        ┌────────────────────┐        ┌─────────────────┐
        ▼                    ▼        ▼                 ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Order Service   │  │ Payment Service│  │   MySQL DB      │
│ - Order Mgmt    │  │ - Payment Proc │  │   - Primary     │
│ - Shipping      │  │ - Transaction   │  │   - Replica     │
│ - Points System │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## 🛠️ Công Nghệ Sử Dụng

### Backend
| Công nghệ | Mục đích |
|-----------|----------|
| **Node.js/Express** | Runtime & REST API |
| **MySQL** | Primary Database |
| **Redis** | Caching & Session Store |
| **Elasticsearch** | Full-text Search |
| **Socket.IO** | Real-time Communication |

### Frontend
| Công nghệ | Mục đích |
|-----------|----------|
| **React.js** | UI Framework |
| **Vite** | Build Tool |
| **Tailwind CSS** | Styling |
| **React Router** | Navigation |

### Infrastructure
| Công nghệ | Mục đích |
|-----------|----------|
| **Docker** | Containerization |
| **GitHub Actions** | CI/CD Pipeline |
| **Google OAuth** | Social Authentication |

## 📁 Cấu Trúc Dự Án

```
CK_NodeJS/
├── 📂 services/                    # Microservices
│   ├── auth-service/               # Authentication & Authorization
│   │   ├── src/
│   │   │   ├── controllers/        # Request handlers
│   │   │   ├── models/             # Database models
│   │   │   ├── routes/             # API routes
│   │   │   ├── middleware/         # Auth middleware
│   │   │   └── eventHandlers.js    # Event-driven handlers
│   │   └── db/                     # Database migrations
│   │
│   ├── catalog-service/            # Product & Category Management
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── models/
│   │   │   ├── routes/
│   │   │   ├── ai/                 # AI features
│   │   │   │   ├── chatbot.js      # AI Chatbot
│   │   │   │   ├── sentiment-analysis.js
│   │   │   │   └── gemini-client.js
│   │   │   └── index.js
│   │   └── db/
│   │
│   ├── cart-service/               # Shopping Cart (Redis-based)
│   │   ├── src/
│   │   ├── shared/                 # Shared utilities
│   │   └── db/
│   │
│   ├── order-service/              # Order Processing
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── models/
│   │   │   └── routes/
│   │   └── db/
│   │
│   ├── payment-service/            # Payment Processing
│   │   ├── src/
│   │   └── shared/
│   │
│   └── shared/                     # Shared code across services
│       └── RedisLockManager.js
│
├── 📂 gateway/                     # API Gateway
│   └── api-gateway/
│       └── src/
│
├── 📂 frontend/                    # Customer Frontend
│   ├── src/
│   │   ├── components/            # React components
│   │   │   ├── Auth/              # Login, Register, OAuth
│   │   │   ├── Cart/
│   │   │   ├── Category/
│   │   │   ├── Filter/
│   │   │   ├── Footer/
│   │   │   ├── Header/
│   │   │   ├── Hero/
│   │   │   ├── Navbar/
│   │   │   └── ui/                # Reusable UI components
│   │   ├── pages/                 # Page components
│   │   ├── services/              # API clients
│   │   ├── context/               # React Context
│   │   ├── constants/             # App constants
│   │   └── api/                   # Axios configuration
│   └── public/
│
├── 📂 adminapp/                    # Admin Dashboard
│   ├── src/
│   │   ├── components/
│   │   └── pages/
│   │       ├── DashboardPage.jsx
│   │       ├── OrdersPage.jsx
│   │       ├── CategoriesPage.jsx
│   │       ├── BrandsPage.jsx
│   │       ├── ProductsPage.jsx
│   │       └── BannersPage.jsx
│   └── Dockerfile
│
├── 📂 db/                          # Database Scripts
│   ├── init-unified.sql
│   └── migrations/
│
├── 📂 tools/                       # Development Tools
│   └── seed/
│       └── seed.js
│
├── 📂 .github/workflows/           # CI/CD Pipelines
│   ├── ci-cd.yml
│   ├── docker-build.yml
│   └── deploy.yml
│
└── docker-compose.yml              # Container orchestration
```

## ✨ Tính Năng Nổi Bật

### 🤖 AI Integration
- **AI Chatbot**: Hỗ trợ khách hàng 24/7
- **Sentiment Analysis**: Phân tích đánh giá sản phẩm
- **Smart Search**: Tìm kiếm sản phẩm thông minh với Elasticsearch

### 🔐 Authentication & Security
- **JWT Token** authentication
- **OAuth 2.0** (Google, Facebook)
- **OTP Verification** qua email
- **Redis Session** management
- **Rate Limiting** qua API Gateway

### 🛒 E-Commerce Core
- Quản lý sản phẩm & danh mục đa cấp
- Giỏ hàng (hỗ trợ guest & authenticated users)
- Xử lý đơn hàng & theo dõi
- Hệ thống điểm thưởng (Loyalty Points)
- Mã giảm giá & khuyến mãi
- Thanh toán đa kênh

### 📊 Admin Dashboard
- Dashboard thống kê
- Quản lý sản phẩm, danh mục, thương hiệu
- Quản lý đơn hàng
- Banner management
- Export Excel reports

### 🚀 DevOps
- **Docker** containerization cho từng service
- **CI/CD** với GitHub Actions
- **Auto-deployment** pipeline
- Database migrations & seeding

## 📊 Services Breakdown

| Service | Port | Database | Description |
|---------|------|----------|-------------|
| API Gateway | 3000 | - | Entry point, routing |
| Auth Service | 3001 | MySQL + Redis | Authentication |
| Catalog Service | 3002 | MySQL + ES | Products/Search |
| Cart Service | 3003 | Redis | Shopping cart |
| Order Service | 3004 | MySQL | Order processing |
| Payment Service | 3005 | MySQL | Payments |
| Frontend | 5173 | - | Customer UI |
| Admin App | 5174 | - | Admin Dashboard |

## 🔧 Cài Đặt & Chạy

### Yêu Cầu
- Node.js 18+
- Docker & Docker Compose
- MySQL 8.0
- Redis 7.0
- Elasticsearch 8.x

### Khởi Động Nhanh (Docker)

```bash
# Build và chạy tất cả services
docker-compose up -d

# Hoặc chạy từng service
docker-compose up --build [service-name]
```

### Development Mode

```bash
# Cài đặt dependencies cho tất cả services
npm run install:all

# Khởi động một service cụ thể
cd services/auth-service
npm start

# Khởi động frontend
cd frontend
npm run dev
```

### Database Setup

```bash
# Chạy migrations
cd db
mysql -u root -p < init-unified.sql

# Seed data
node tools/seed/seed.js
```

## 📈 Kinh Nghiệm Thể Hiện Qua Dự Án

### Technical Skills
- ✅ **System Design**: Thiết kế kiến trúc Microservices từ đầu
- ✅ **Distributed Systems**: Event-driven communication, Redis pub/sub
- ✅ **Database Design**: Schema optimization, indexing, replication
- ✅ **API Design**: RESTful APIs, authentication patterns
- ✅ **DevOps**: Docker, CI/CD, infrastructure as code
- ✅ **Security**: JWT, OAuth 2.0, bcrypt, input validation
- ✅ **Performance**: Redis caching, Elasticsearch, query optimization

### Soft Skills
- ✅ Project architecture & planning
- ✅ Code organization & maintainability
- ✅ Problem solving & debugging
- ✅ Documentation writing
- ✅ Version control (Git)

## 📝 License

MIT License - Tự do sử dụng cho mục đích học tập và phát triển.

---

**Author**: [Your Name]  
**Project Duration**: [Start Date] - [End Date]  
**Role**: Full-Stack Developer / System Architect
