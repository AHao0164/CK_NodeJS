# 🚀 Hướng dẫn CI/CD đơn giản

Hướng dẫn từng bước để sử dụng CI/CD pipeline cơ bản với GitHub Actions.

## 📋 CI/CD là gì?

**CI/CD** (Continuous Integration / Continuous Deployment) giúp:
- ✅ **Tự động test** code khi bạn push lên GitHub
- ✅ **Tự động build** Docker images
- ✅ **Kiểm tra** code có lỗi không trước khi merge

**Không cần cấu hình phức tạp!** Chỉ cần push code lên GitHub là xong.

---

## 🎯 Bước 1: Kiểm tra files đã có sẵn

Pipeline đã được tạo sẵn trong thư mục `.github/workflows/`:

- ✅ `ci-cd.yml` - Pipeline chính (test + build)
- ✅ `docker-build.yml` - Build và push images (tùy chọn)
- ✅ `deploy.yml` - Deploy (tùy chọn, không cần dùng ngay)

**→ Bạn không cần làm gì ở bước này!**

---

## 🚀 Bước 2: Push code lên GitHub

### Nếu code chưa có trên GitHub:

```bash
# 1. Khởi tạo git (nếu chưa có)
git init

# 2. Thêm remote repository
git remote add origin https://github.com/username/your-repo.git

# 3. Thêm tất cả files
git add .

# 4. Commit
git commit -m "Add CI/CD pipeline"

# 5. Push lên GitHub
git push -u origin main
```

### Nếu code đã có trên GitHub:

```bash
# 1. Thêm files mới
git add .

# 2. Commit
git commit -m "Add CI/CD pipeline"

# 3. Push
git push origin main
```

---

## ✅ Bước 3: Kiểm tra CI/CD đang chạy

1. **Vào GitHub repository** của bạn
2. **Click tab "Actions"** (ở thanh menu trên)
3. **Bạn sẽ thấy:**
   - Workflow "CI/CD Pipeline" đang chạy
   - Các jobs: Test, Build, Build Compose
   - Status: 🟡 (đang chạy) hoặc ✅ (thành công) hoặc ❌ (lỗi)

### Xem chi tiết:

- Click vào workflow run để xem logs
- Xem từng job: Test, Build, Build Compose
- Xem logs của từng step

---

## 📊 CI/CD Pipeline làm gì?

### Job 1: Test ✅
- Install dependencies cho tất cả services
- Kiểm tra code có lỗi cú pháp không
- **Thời gian:** ~2-3 phút

### Job 2: Build Docker Images 🐳
- Build Docker image cho từng service:
  - api-gateway
  - auth-service
  - catalog-service
  - cart-service
  - order-service
  - payment-service
  - adminapp
  - webapp
- **Thời gian:** ~5-10 phút

### Job 3: Build với Docker Compose 🐳
- Build tất cả services cùng lúc với docker-compose
- Verify images đã được tạo
- **Thời gian:** ~5-10 phút

### Job 4: Deploy (Thông báo) 📢
- Chỉ hiển thị thông báo "Services built successfully!"
- **Không deploy thực tế** (cần cấu hình thêm nếu muốn)

---

## 🎉 Kết quả

Sau khi pipeline chạy xong:

- ✅ **Nếu thành công:** Tất cả jobs có dấu ✅ màu xanh
- ❌ **Nếu lỗi:** Job lỗi có dấu ❌ màu đỏ, click vào để xem lỗi

### Ví dụ kết quả thành công:

```
✅ Test & Lint          (2m 15s)
✅ Build Docker Images  (8m 30s)
✅ Build with Docker Compose (7m 45s)
✅ Deploy               (5s)
```

---

## 🔍 Khi nào CI/CD chạy?

Pipeline tự động chạy khi:

1. ✅ **Push code** lên branch `main` hoặc `develop`
2. ✅ **Tạo Pull Request** vào branch `main` hoặc `develop`
3. ✅ **Push tag** (nếu có workflow khác)

**→ Bạn không cần làm gì thêm, tự động chạy!**

---

## ❓ Câu hỏi thường gặp

### Q: Có cần thêm secrets không?
**A:** ❌ **KHÔNG!** Chỉ cần secrets nếu muốn deploy tự động (không bắt buộc).

### Q: Pipeline chạy bao lâu?
**A:** Khoảng **15-20 phút** cho lần đầu, các lần sau nhanh hơn nhờ cache.

### Q: Làm sao biết pipeline đang chạy?
**A:** Vào tab **Actions** trên GitHub, bạn sẽ thấy workflow đang chạy với icon 🟡.

### Q: Pipeline fail thì sao?
**A:** Click vào workflow để xem logs, tìm dòng lỗi (màu đỏ), sửa code và push lại.

### Q: Có thể tắt pipeline không?
**A:** Có, xóa hoặc đổi tên file `.github/workflows/ci-cd.yml` (không khuyến nghị).

---

## 🐛 Xử lý lỗi thường gặp

### Lỗi: "Workflow not found"
- ✅ Kiểm tra file có đúng path: `.github/workflows/ci-cd.yml`
- ✅ Kiểm tra file có commit và push lên GitHub chưa

### Lỗi: "Dockerfile not found"
- ✅ Kiểm tra mỗi service có file `Dockerfile` chưa
- ✅ Kiểm tra path trong workflow có đúng không

### Lỗi: "npm ci failed"
- ✅ Kiểm tra file `package.json` có đúng không
- ✅ Kiểm tra dependencies có lỗi không

### Lỗi: "Build failed"
- ✅ Xem logs chi tiết trong tab Actions
- ✅ Test build local trước: `docker compose build`

---

## 📝 Tóm tắt

1. ✅ **Files đã có sẵn** - Không cần tạo thêm
2. ✅ **Push code lên GitHub** - Pipeline tự động chạy
3. ✅ **Xem kết quả** - Vào tab Actions
4. ✅ **Không cần secrets** - Chỉ cần nếu muốn deploy

**→ Đơn giản vậy thôi! 🎉**

---

## 🔗 Tài liệu tham khảo

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- Xem file `README.md` để biết thêm chi tiết về các workflow khác

