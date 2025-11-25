# CI/CD Pipeline với GitHub Actions

Hướng dẫn thiết lập và sử dụng CI/CD pipeline cho dự án Node.js Microservices.

## 📋 Tổng quan

Pipeline này bao gồm 3 workflow chính:

1. **CI/CD Pipeline** (`ci-cd.yml`): Test, build và verify Docker images
2. **Docker Build & Push** (`docker-build.yml`): Build và push images lên GitHub Container Registry
3. **Deploy** (`deploy.yml`): Deploy services lên production

## 🚀 Cách sử dụng

### 1. Setup cơ bản

#### Bước 1: Push code lên GitHub
```bash
git add .
git commit -m "Add CI/CD pipeline"
git push origin main
```

#### Bước 2: Kiểm tra workflows
- Vào GitHub repository
- Click tab **Actions**
- Bạn sẽ thấy các workflows đang chạy

### 2. Cấu hình GitHub Container Registry (Optional)

Nếu muốn push images lên GitHub Container Registry:

1. Vào **Settings** > **Secrets and variables** > **Actions**
2. `GITHUB_TOKEN` đã được tự động tạo sẵn, không cần thêm
3. Workflow sẽ tự động push images lên `ghcr.io/your-username/service-name`

### 3. Deploy lên Server (SSH)

Nếu muốn deploy tự động lên server qua SSH:

1. Tạo SSH key pair:
```bash
ssh-keygen -t rsa -b 4096 -C "github-actions"
```

2. Copy public key lên server:
```bash
ssh-copy-id user@your-server.com
```

3. Thêm secrets vào GitHub:
   - Vào **Settings** > **Secrets and variables** > **Actions**
   - Thêm các secrets:
     - `SSH_HOST`: IP hoặc domain của server
     - `SSH_USERNAME`: Username để SSH
     - `SSH_PRIVATE_KEY`: Private key (nội dung file `~/.ssh/id_rsa`)

4. Sửa file `deploy.yml`:
   - Đổi `if: false` thành `if: true` ở step "Deploy via SSH"
   - Cập nhật path trong script: `cd /path/to/your/project`

### 4. Deploy lên Cloud Providers

#### AWS ECS
1. Cài đặt AWS CLI và cấu hình credentials
2. Thêm secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
3. Sửa `deploy.yml` và bật step "Deploy to AWS ECS"

#### Azure Container Instances
1. Cài đặt Azure CLI
2. Login: `az login`
3. Thêm secrets: `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`
4. Sửa `deploy.yml` và bật step "Deploy to Azure"

#### Google Cloud Run
1. Cài đặt gcloud CLI
2. Login: `gcloud auth login`
3. Thêm secret: `GCP_SA_KEY` (Service Account Key)
4. Sửa `deploy.yml` và bật step "Deploy to GCP"

## 📝 Workflow Details

### CI/CD Pipeline (`ci-cd.yml`)

**Triggers:**
- Push vào `main` hoặc `develop`
- Pull request vào `main` hoặc `develop`

**Jobs:**
1. **Test**: Install dependencies và chạy tests (nếu có)
2. **Build**: Build Docker images cho từng service
3. **Build Compose**: Build tất cả services với docker-compose
4. **Deploy**: Deploy (chỉ chạy khi push vào `main`)

### Docker Build & Push (`docker-build.yml`)

**Triggers:**
- Push vào `main`
- Push tags `v*` (ví dụ: `v1.0.0`)
- Pull request vào `main`

**Chức năng:**
- Build Docker images cho tất cả services
- Push lên GitHub Container Registry
- Tag images theo branch, PR, version, hoặc SHA

**Sử dụng images:**
```bash
# Pull image từ GitHub Container Registry
docker pull ghcr.io/your-username/api-gateway:main

# Hoặc với version tag
docker pull ghcr.io/your-username/api-gateway:v1.0.0
```

### Deploy (`deploy.yml`)

**Triggers:**
- Push vào `main`
- Push tags `v*`
- Manual trigger (workflow_dispatch)

**Chức năng:**
- Deploy services lên production
- Hỗ trợ nhiều phương thức deploy (SSH, AWS, Azure, GCP)

## 🔧 Tùy chỉnh

### Thêm tests

Sửa file `ci-cd.yml`, uncomment phần test:
```yaml
- name: Run linter
  run: npm run lint

- name: Run tests
  run: npm test
```

### Thêm environment variables

Thêm vào workflow file:
```yaml
env:
  NODE_ENV: production
  CUSTOM_VAR: ${{ secrets.CUSTOM_VAR }}
```

### Thay đổi trigger branches

Sửa phần `on:` trong workflow file:
```yaml
on:
  push:
    branches: [ main, develop, staging ]
```

## 📊 Monitoring

- Xem logs: GitHub > Actions > Chọn workflow run
- Xem build status: Badge trong README
- Notifications: GitHub sẽ gửi email khi workflow fail

## 🐛 Troubleshooting

### Workflow không chạy
- Kiểm tra file có đúng path: `.github/workflows/*.yml`
- Kiểm tra syntax YAML
- Kiểm tra permissions trong repository settings

### Build fail
- Kiểm tra Dockerfile có đúng không
- Kiểm tra dependencies có đầy đủ không
- Xem logs trong Actions tab

### Deploy fail
- Kiểm tra secrets đã được thêm chưa
- Kiểm tra SSH key hoặc cloud credentials
- Kiểm tra network connectivity

## 📚 Tài liệu tham khảo

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

