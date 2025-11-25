# 🐛 Hướng dẫn xử lý lỗi CI/CD

## ❓ Lỗi có phải là vấn đề nghiêm trọng không?

**Không nhất thiết!** Một số lỗi có thể do:
- ✅ Thiếu `package-lock.json` (đã được sửa tự động)
- ✅ Build Docker image lâu (bình thường)
- ✅ Network timeout (tạm thời)
- ✅ Cache issues (có thể clear cache)

## 🔍 Cách kiểm tra lỗi

### Bước 1: Vào tab Actions trên GitHub
1. Click vào workflow run bị lỗi (có dấu ❌)
2. Xem job nào bị lỗi (Test, Build, Build Compose, Deploy)
3. Click vào job bị lỗi để xem chi tiết

### Bước 2: Xem logs
1. Click vào step bị lỗi (màu đỏ)
2. Xem dòng lỗi cuối cùng (thường có màu đỏ)
3. Copy thông báo lỗi

## 🔧 Các lỗi thường gặp và cách sửa

### Lỗi 1: "npm ci failed" hoặc "package-lock.json not found"

**Nguyên nhân:** Service không có `package-lock.json`

**Cách sửa:**
- ✅ **Đã được sửa tự động** - Workflow sẽ dùng `npm install` nếu không có `package-lock.json`
- Nếu vẫn lỗi, tạo `package-lock.json`:
  ```bash
  cd services/auth-service  # hoặc service bị lỗi
  npm install
  git add package-lock.json
  git commit -m "Add package-lock.json"
  git push
  ```

### Lỗi 2: "Dockerfile not found"

**Nguyên nhân:** Service không có Dockerfile

**Cách sửa:**
- Kiểm tra service có Dockerfile chưa:
  ```bash
  ls gateway/api-gateway/Dockerfile
  ls services/auth-service/Dockerfile
  # ... kiểm tra tất cả services
  ```
- Nếu thiếu, tạo Dockerfile cho service đó

### Lỗi 3: "docker compose build failed"

**Nguyên nhân:** 
- Dockerfile có lỗi
- Thiếu dependencies
- Network timeout

**Cách sửa:**
1. Test build local trước:
   ```bash
   docker compose build api-gateway
   ```
2. Xem lỗi cụ thể trong logs
3. Sửa Dockerfile hoặc dependencies

### Lỗi 4: "Build Docker image failed"

**Nguyên nhân:**
- Dockerfile syntax error
- Base image không tồn tại
- Dependencies không tải được

**Cách sửa:**
1. Kiểm tra Dockerfile có đúng syntax không
2. Test build local:
   ```bash
   cd services/auth-service
   docker build -t test-image .
   ```
3. Xem lỗi và sửa

### Lỗi 5: "Permission denied" khi push images

**Nguyên nhân:** Không có quyền push lên GitHub Container Registry

**Cách sửa:**
- Workflow `docker-build.yml` cần permissions
- Kiểm tra repository settings:
  - Settings > Actions > General
  - "Workflow permissions" > Chọn "Read and write permissions"

### Lỗi 6: "Job timed out"

**Nguyên nhân:** Build quá lâu (thường > 6 giờ)

**Cách sửa:**
- Đây là lỗi hiếm, thường do:
  - Network chậm
  - Build quá phức tạp
- Có thể bỏ qua nếu chỉ xảy ra 1 lần

## ✅ Kiểm tra workflow đã được cải thiện

Workflow đã được cải thiện để:
- ✅ Tự động dùng `npm install` nếu không có `package-lock.json`
- ✅ Không fail toàn bộ workflow nếu một service build fail
- ✅ Hiển thị thông báo rõ ràng hơn khi lỗi

## 🚀 Cách test workflow

### Test local trước khi push:

```bash
# 1. Test install dependencies
cd services/auth-service
npm install

# 2. Test build Docker image
docker build -t test-auth .

# 3. Test docker-compose
docker compose build
```

### Nếu test local thành công nhưng GitHub Actions fail:
- Kiểm tra logs trên GitHub
- Có thể do môi trường khác nhau
- Thử push lại (có thể là lỗi tạm thời)

## 📊 Xem workflow status

### Trên GitHub:
1. Vào tab **Actions**
2. Xem workflow runs:
   - ✅ Xanh = Thành công
   - ❌ Đỏ = Lỗi
   - 🟡 Vàng = Đang chạy
   - ⚪ Xám = Đã hủy

### Workflow badges (thêm vào README):

```markdown
![CI/CD Pipeline](https://github.com/username/repo/actions/workflows/ci-cd.yml/badge.svg)
```

## 🆘 Vẫn không sửa được?

1. **Xem logs chi tiết** trên GitHub Actions
2. **Copy lỗi** và tìm trên Google
3. **Kiểm tra** các issues tương tự trên GitHub
4. **Test local** để reproduce lỗi

## 💡 Tips

- ✅ **Không cần lo lắng** nếu một vài lần fail - có thể do network
- ✅ **Xem logs** để biết lỗi cụ thể
- ✅ **Test local** trước khi push
- ✅ **Commit và push** lại nếu lỗi do code

## 📝 Checklist khi workflow fail

- [ ] Đã xem logs trên GitHub Actions?
- [ ] Đã test build local?
- [ ] Đã kiểm tra Dockerfile có đúng không?
- [ ] Đã kiểm tra package.json có đúng không?
- [ ] Đã thử push lại?
- [ ] Lỗi có phải do network timeout không?

---

**Lưu ý:** Một số lỗi là bình thường và không ảnh hưởng đến chức năng chính. Chỉ cần quan tâm nếu tất cả jobs đều fail liên tục.


