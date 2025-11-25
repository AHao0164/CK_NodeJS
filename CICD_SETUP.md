# 🚀 Hướng dẫn thiết lập CI/CD Pipeline

## Tổng quan

Dự án này đã được cấu hình với **GitHub Actions** để tự động:
- ✅ Test và build code
- ✅ Build Docker images
- ✅ Deploy services

## 📁 Cấu trúc Files

```
.github/
└── workflows/
    ├── ci-cd.yml          # Main CI/CD pipeline
    ├── docker-build.yml   # Build và push Docker images
    ├── deploy.yml         # Deploy to production
    ├── quick-test.yml    # Quick validation
    └── README.md         # Documentation
```

## 🎯 Bước 1: Push code lên GitHub

Nếu chưa có repository trên GitHub:

```bash
# 1. Tạo repository mới trên GitHub (không khởi tạo README)

# 2. Push code lên GitHub
git init
git add .
git commit -m "Initial commit with CI/CD"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## 🎯 Bước 2: Kiểm tra Workflows

1. Vào GitHub repository
2. Click tab **Actions**
3. Bạn sẽ thấy các workflows:
   - ✅ CI/CD Pipeline
   - ✅ Docker Build & Push
   - ✅ Deploy to Production
   - ✅ Quick Test

## 🎯 Bước 3: Xem kết quả

Sau khi push code, workflows sẽ tự động chạy:

1. **Quick Test**: Kiểm tra cấu trúc files (chạy nhanh nhất)
2. **CI/CD Pipeline**: Test, build Docker images
3. **Docker Build & Push**: Build và push images lên GitHub Container Registry (nếu push vào `main`)

## 🔧 Cấu hình nâng cao

### Option 1: Deploy tự động lên Server (SSH)

#### Bước 1: Tạo SSH key

```bash
# Trên máy local
ssh-keygen -t rsa -b 4096 -C "github-actions" -f ~/.ssh/github-actions
```

#### Bước 2: Copy public key lên server

```bash
# Copy public key
cat ~/.ssh/github-actions.pub

# Trên server, thêm vào ~/.ssh/authorized_keys
ssh user@your-server.com
echo "YOUR_PUBLIC_KEY" >> ~/.ssh/authorized_keys
```

#### Bước 3: Thêm secrets vào GitHub

1. Vào repository > **Settings** > **Secrets and variables** > **Actions**
2. Click **New repository secret**
3. Thêm các secrets:
   - **Name**: `SSH_HOST`, **Value**: `your-server.com` hoặc IP
   - **Name**: `SSH_USERNAME`, **Value**: `your-username`
   - **Name**: `SSH_PRIVATE_KEY`, **Value**: Nội dung file `~/.ssh/github-actions` (private key)

#### Bước 4: Cấu hình deploy.yml

Mở file `.github/workflows/deploy.yml` và sửa:

```yaml
- name: Deploy via SSH (Optional)
  if: true  # Đổi từ false thành true
  uses: appleboy/ssh-action@v1.0.0
  with:
    host: ${{ secrets.SSH_HOST }}
    username: ${{ secrets.SSH_USERNAME }}
    key: ${{ secrets.SSH_PRIVATE_KEY }}
    script: |
      cd /path/to/your/project  # Sửa path này
      git pull origin main
      docker compose pull
      docker compose up -d --build
      docker compose ps
```

### Option 2: Deploy lên AWS ECS

#### Bước 1: Cài đặt AWS CLI

```bash
# Trên máy local
aws configure
```

#### Bước 2: Thêm secrets vào GitHub

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (hoặc set trong workflow)

#### Bước 3: Cấu hình deploy.yml

Uncomment và cấu hình phần AWS ECS trong `deploy.yml`.

### Option 3: Deploy lên Azure

#### Bước 1: Login Azure

```bash
az login
az account show
```

#### Bước 2: Thêm secrets

- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID`

#### Bước 3: Cấu hình deploy.yml

Uncomment phần Azure trong `deploy.yml`.

### Option 4: Deploy lên Google Cloud

#### Bước 1: Tạo Service Account

```bash
gcloud iam service-accounts create github-actions
gcloud iam service-accounts keys create key.json --iam-account=github-actions@PROJECT_ID.iam.gserviceaccount.com
```

#### Bước 2: Thêm secret

- `GCP_SA_KEY`: Nội dung file `key.json`

#### Bước 3: Cấu hình deploy.yml

Uncomment phần GCP trong `deploy.yml`.

## 📊 Monitoring Workflows

### Xem logs

1. Vào GitHub > **Actions** tab
2. Click vào workflow run
3. Click vào job để xem logs chi tiết

### Badge status

Thêm vào README.md:

```markdown
![CI/CD](https://github.com/YOUR_USERNAME/YOUR_REPO/workflows/CI/CD%20Pipeline/badge.svg)
```

## 🔍 Troubleshooting

### Workflow không chạy

**Vấn đề**: Workflow không tự động chạy khi push code

**Giải pháp**:
- Kiểm tra file có đúng path: `.github/workflows/*.yml`
- Kiểm tra syntax YAML (có thể dùng YAML validator)
- Kiểm tra branch name có match với trigger không

### Build fail

**Vấn đề**: Docker build fail

**Giải pháp**:
- Kiểm tra Dockerfile có đúng syntax không
- Kiểm tra dependencies trong package.json
- Xem logs chi tiết trong Actions tab

### Permission denied

**Vấn đề**: Không có quyền push images hoặc deploy

**Giải pháp**:
- Kiểm tra GitHub token permissions
- Kiểm tra repository settings > Actions > General
- Đảm bảo "Workflow permissions" được set đúng

## 🎓 Best Practices

1. **Branch Protection**: Bật branch protection cho `main` branch
2. **Required Checks**: Yêu cầu CI pass trước khi merge PR
3. **Secrets Management**: Không commit secrets vào code
4. **Docker Caching**: Sử dụng cache để tăng tốc build
5. **Notifications**: Cấu hình email/Slack notifications khi deploy

## 📚 Tài liệu tham khảo

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [AWS ECS Deployment](https://docs.aws.amazon.com/ecs/)
- [Azure Container Instances](https://docs.microsoft.com/en-us/azure/container-instances/)
- [Google Cloud Run](https://cloud.google.com/run/docs)

## ✅ Checklist

- [ ] Code đã được push lên GitHub
- [ ] Workflows đã chạy thành công
- [ ] Docker images đã được build
- [ ] (Optional) Đã cấu hình deploy tự động
- [ ] (Optional) Đã test deploy trên staging environment

## 🆘 Cần hỗ trợ?

Nếu gặp vấn đề, kiểm tra:
1. Logs trong GitHub Actions
2. File `.github/workflows/*.yml` có đúng syntax không
3. Secrets đã được thêm đầy đủ chưa
4. Permissions của repository

