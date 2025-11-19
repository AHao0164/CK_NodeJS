# HƯỚNG DẪN IMPLEMENT CÁC TÍNH NĂNG BỔ SUNG

## Mục lục
1. [Google OAuth Login](#1-google-oauth-login)
2. [Facebook OAuth Login](#2-facebook-oauth-login)
3. [Password Recovery/Reset qua Email](#3-password-recoveryreset-qua-email)

---

## 1. GOOGLE OAUTH LOGIN

### 1.1. Tạo Google OAuth Credentials

**Bước 1:** Truy cập [Google Cloud Console](https://console.cloud.google.com/)

**Bước 2:** Tạo hoặc chọn project
- Click "Select a project" → "New Project"
- Đặt tên project: `CK-NodeJS-Auth`
- Click "Create"

**Bước 3:** Enable Google+ API
- Vào "APIs & Services" → "Enable APIs and Services"
- Tìm "Google+ API" và click "Enable"

**Bước 4:** Tạo OAuth 2.0 Credentials
- Vào "APIs & Services" → "Credentials"
- Click "Create Credentials" → "OAuth client ID"
- Chọn "Web application"
- Cấu hình:
  - **Name:** `CK-NodeJS-OAuth`
  - **Authorized JavaScript origins:** 
    - `http://localhost:5173`
    - `http://localhost:8080`
  - **Authorized redirect URIs:**
    - `http://localhost:8080/auth/google/callback`
- Click "Create"
- **LƯU LẠI:** `Client ID` và `Client Secret`

### 1.2. Cài đặt Dependencies

```bash
# Trong thư mục services/auth-service/
npm install passport passport-google-oauth20
```

### 1.3. Cập nhật Backend (Auth Service)

**File: `services/auth-service/src/index.js`**

```javascript
// Thêm imports ở đầu file
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Thêm sau phần require các thư viện khác, trước phần waitForDatabase
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8080/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Cấu hình Passport Google Strategy (thêm sau phần waitForDatabase, trước phần khởi tạo app)
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: GOOGLE_CALLBACK_URL,
    scope: ['profile', 'email']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const fullName = profile.displayName;
      const oauthProvider = 'google';
      const oauthId = profile.id;

      // Tìm user theo oauth_provider và oauth_id
      let [users] = await db.promise().query(
        'SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?',
        [oauthProvider, oauthId]
      );

      let user;
      if (users.length > 0) {
        // User đã tồn tại
        user = users[0];
      } else {
        // Kiểm tra xem email đã tồn tại chưa (có thể đã đăng ký bằng email/password)
        [users] = await db.promise().query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length > 0) {
          // Link OAuth với tài khoản hiện có
          user = users[0];
          await db.promise().query(
            'UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?',
            [oauthProvider, oauthId, user.id]
          );
        } else {
          // Tạo user mới
          const [result] = await db.promise().query(
            'INSERT INTO users (email, full_name, oauth_provider, oauth_id, password_hash) VALUES (?, ?, ?, ?, ?)',
            [email, fullName, oauthProvider, oauthId, ''] // password_hash rỗng cho OAuth users
          );
          user = { id: result.insertId, email, full_name: fullName };
        }
      }

      return done(null, user);
    } catch (error) {
      console.error('Google OAuth error:', error);
      return done(error, null);
    }
  }));
}

// Thêm middleware passport (sau phần app.use(express.json()))
app.use(passport.initialize());

// Thêm routes Google OAuth (sau các routes hiện có, trước app.listen)

// Khởi tạo Google OAuth flow
app.get('/auth/google', 
  passport.authenticate('google', { 
    session: false,
    scope: ['profile', 'email'] 
  })
);

// Callback sau khi Google xác thực
app.get('/auth/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed` 
  }),
  (req, res) => {
    try {
      // Tạo JWT token
      const token = jwt.sign(
        { userId: req.user.id, email: req.user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Redirect về frontend với token
      res.redirect(`${FRONTEND_URL}/login?token=${token}&email=${encodeURIComponent(req.user.email)}`);
    } catch (error) {
      console.error('Token generation error:', error);
      res.redirect(`${FRONTEND_URL}/login?error=token_failed`);
    }
  }
);
```

**File: `services/auth-service/Dockerfile`**

Không cần thay đổi, chỉ cần rebuild image.

### 1.4. Cập nhật Environment Variables

**File: `docker-compose.yml`**

Thêm vào phần `environment` của `auth-service`:

```yaml
services:
  auth-service:
    environment:
      - GOOGLE_CLIENT_ID=your_google_client_id_here
      - GOOGLE_CLIENT_SECRET=your_google_client_secret_here
      - GOOGLE_CALLBACK_URL=http://localhost:8080/auth/google/callback
      - FRONTEND_URL=http://localhost:5173
```

**Thay thế:**
- `your_google_client_id_here` → Client ID từ bước 1.1
- `your_google_client_secret_here` → Client Secret từ bước 1.1

### 1.5. Cập nhật Frontend

**File: `frontend/src/pages/LoginPage.jsx` (hoặc `webapp/src/pages/Login.jsx`)**

```javascript
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Xử lý OAuth callback
  useEffect(() => {
    const token = searchParams.get('token');
    const email = searchParams.get('email');
    const error = searchParams.get('error');

    if (error) {
      alert('Đăng nhập Google thất bại. Vui lòng thử lại.');
      return;
    }

    if (token && email) {
      // Lưu token vào localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('userEmail', email);
      
      // Redirect về home
      navigate('/');
    }
  }, [searchParams, navigate]);

  const handleGoogleLogin = () => {
    // Redirect đến Google OAuth endpoint
    window.location.href = 'http://localhost:8080/auth/google';
  };

  return (
    <div className="login-page">
      {/* Form đăng nhập hiện tại của bạn */}
      
      {/* Thêm nút Google Login */}
      <button 
        onClick={handleGoogleLogin}
        className="google-login-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          padding: '12px 24px',
          backgroundColor: '#fff',
          border: '1px solid #ddd',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px',
          marginTop: '16px'
        }}
      >
        <img 
          src="https://www.google.com/favicon.ico" 
          alt="Google" 
          style={{ width: '20px', height: '20px' }}
        />
        <span>Đăng nhập với Google</span>
      </button>
    </div>
  );
}
```

### 1.6. Test Google OAuth

```bash
# Rebuild và restart services
docker-compose down
docker-compose up --build -d

# Kiểm tra logs
docker-compose logs -f auth-service
```

**Test flow:**
1. Mở http://localhost:5173/login
2. Click "Đăng nhập với Google"
3. Chọn tài khoản Google
4. Cho phép truy cập
5. Được redirect về trang chủ với token

---

## 2. FACEBOOK OAUTH LOGIN

### 2.1. Tạo Facebook App

**Bước 1:** Truy cập [Facebook Developers](https://developers.facebook.com/)

**Bước 2:** Tạo App
- Click "My Apps" → "Create App"
- Chọn "Consumer" use case
- Đặt tên app: `CK-NodeJS-Auth`
- Email liên hệ
- Click "Create App"

**Bước 3:** Cấu hình Facebook Login
- Trong dashboard, click "Add Product"
- Chọn "Facebook Login" → "Set Up"
- Chọn "Web"
- **Site URL:** `http://localhost:5173`
- **Valid OAuth Redirect URIs:** `http://localhost:8080/auth/facebook/callback`

**Bước 4:** Lấy credentials
- Vào "Settings" → "Basic"
- **LƯU LẠI:** `App ID` và `App Secret`

### 2.2. Cài đặt Dependencies

```bash
# Trong thư mục services/auth-service/
npm install passport-facebook
```

### 2.3. Cập nhật Backend (Auth Service)

**File: `services/auth-service/src/index.js`**

```javascript
// Thêm import
const FacebookStrategy = require('passport-facebook').Strategy;

// Thêm constants (sau phần Google constants)
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
const FACEBOOK_CALLBACK_URL = process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:8080/auth/facebook/callback';

// Cấu hình Passport Facebook Strategy (sau phần Google Strategy)
if (FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: FACEBOOK_APP_ID,
    clientSecret: FACEBOOK_APP_SECRET,
    callbackURL: FACEBOOK_CALLBACK_URL,
    profileFields: ['id', 'emails', 'name', 'displayName']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      
      if (!email) {
        return done(new Error('Email not provided by Facebook'), null);
      }

      const fullName = profile.displayName;
      const oauthProvider = 'facebook';
      const oauthId = profile.id;

      // Tìm user theo oauth_provider và oauth_id
      let [users] = await db.promise().query(
        'SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?',
        [oauthProvider, oauthId]
      );

      let user;
      if (users.length > 0) {
        user = users[0];
      } else {
        // Kiểm tra email đã tồn tại chưa
        [users] = await db.promise().query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length > 0) {
          // Link OAuth với tài khoản hiện có
          user = users[0];
          await db.promise().query(
            'UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?',
            [oauthProvider, oauthId, user.id]
          );
        } else {
          // Tạo user mới
          const [result] = await db.promise().query(
            'INSERT INTO users (email, full_name, oauth_provider, oauth_id, password_hash) VALUES (?, ?, ?, ?, ?)',
            [email, fullName, oauthProvider, oauthId, '']
          );
          user = { id: result.insertId, email, full_name: fullName };
        }
      }

      return done(null, user);
    } catch (error) {
      console.error('Facebook OAuth error:', error);
      return done(error, null);
    }
  }));
}

// Thêm routes Facebook OAuth (sau Google routes)

// Khởi tạo Facebook OAuth flow
app.get('/auth/facebook',
  passport.authenticate('facebook', { 
    session: false,
    scope: ['email'] 
  })
);

// Callback sau khi Facebook xác thực
app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { 
    session: false,
    failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed` 
  }),
  (req, res) => {
    try {
      const token = jwt.sign(
        { userId: req.user.id, email: req.user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.redirect(`${FRONTEND_URL}/login?token=${token}&email=${encodeURIComponent(req.user.email)}`);
    } catch (error) {
      console.error('Token generation error:', error);
      res.redirect(`${FRONTEND_URL}/login?error=token_failed`);
    }
  }
);
```

### 2.4. Cập nhật Environment Variables

**File: `docker-compose.yml`**

Thêm vào phần `environment` của `auth-service`:

```yaml
  auth-service:
    environment:
      - FACEBOOK_APP_ID=your_facebook_app_id_here
      - FACEBOOK_APP_SECRET=your_facebook_app_secret_here
      - FACEBOOK_CALLBACK_URL=http://localhost:8080/auth/facebook/callback
```

### 2.5. Cập nhật Frontend

**File: `frontend/src/pages/LoginPage.jsx`**

```javascript
const handleFacebookLogin = () => {
  window.location.href = 'http://localhost:8080/auth/facebook';
};

// Trong JSX, thêm nút Facebook Login
<button 
  onClick={handleFacebookLogin}
  className="facebook-login-btn"
  style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '12px 24px',
    backgroundColor: '#1877f2',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    marginTop: '8px'
  }}
>
  <span>Đăng nhập với Facebook</span>
</button>
```

---

## 3. PASSWORD RECOVERY/RESET QUA EMAIL

### 3.1. Cài đặt Dependencies

```bash
# Trong thư mục services/auth-service/
npm install nodemailer
```

### 3.2. Tạo bảng lưu reset tokens

**File: `db/init.sql`**

Thêm vào cuối file, trước dòng `-- ===== CATALOG_DB =====`:

```sql
-- Bảng lưu password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
);
```

### 3.3. Cấu hình Email Service

**Lựa chọn 1: Gmail (Development/Testing)**

1. Bật 2-factor authentication cho Gmail
2. Tạo App Password:
   - Vào Google Account → Security
   - Tìm "App passwords"
   - Chọn "Mail" và "Other"
   - Tạo password và lưu lại //udbs twah ppyw frit

**Lựa chọn 2: SendGrid (Production)**

1. Đăng ký tài khoản tại [SendGrid](https://sendgrid.com/)
2. Tạo API Key
3. Verify sender identity

**Lựa chọn 3: MailGun, AWS SES, etc.**

### 3.4. Cập nhật Backend (Auth Service)

**File: `services/auth-service/src/index.js`**

```javascript
// Thêm import
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Cấu hình email (thêm sau phần constants khác)
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587');
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER;

// Tạo transporter
let transporter = null;
if (EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });

  // Test email configuration
  transporter.verify((error, success) => {
    if (error) {
      console.error('Email configuration error:', error);
    } else {
      console.log('Email server ready');
    }
  });
}

// Hàm gửi email
async function sendResetEmail(email, token) {
  if (!transporter) {
    throw new Error('Email service not configured');
  }

  const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;
  
  const mailOptions = {
    from: `"CK-NodeJS Shop" <${EMAIL_FROM}>`,
    to: email,
    subject: 'Đặt lại mật khẩu - CK-NodeJS Shop',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Yêu cầu đặt lại mật khẩu</h2>
        <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản của mình.</p>
        <p>Click vào nút bên dưới để đặt lại mật khẩu:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #4CAF50; 
                    color: white; 
                    padding: 12px 30px; 
                    text-decoration: none; 
                    border-radius: 4px;
                    display: inline-block;">
            Đặt lại mật khẩu
          </a>
        </div>
        <p>Hoặc copy link sau vào trình duyệt:</p>
        <p style="word-break: break-all; color: #666;">${resetLink}</p>
        <p><strong>Lưu ý:</strong></p>
        <ul>
          <li>Link này chỉ có hiệu lực trong 1 giờ</li>
          <li>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này</li>
        </ul>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px;">
          Email này được gửi từ CK-NodeJS Shop. Vui lòng không trả lời email này.
        </p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

// Thêm routes (sau các routes hiện có)

// POST /auth/forgot-password - Gửi email reset password
app.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Kiểm tra user tồn tại
    const [users] = await db.promise().query('SELECT id, email FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      // Không tiết lộ email không tồn tại (security best practice)
      return res.json({ message: 'If email exists, reset link will be sent' });
    }

    const user = users[0];

    // Tạo reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // Lưu token vào database
    await db.promise().query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiresAt]
    );

    // Gửi email
    try {
      await sendResetEmail(email, token);
      res.json({ message: 'Reset password email sent' });
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      res.status(500).json({ error: 'Failed to send email' });
    }

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/reset-password - Đặt lại mật khẩu với token
app.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Tìm token trong database
    const [tokens] = await db.promise().query(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > NOW()',
      [token]
    );

    if (tokens.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const resetToken = tokens[0];

    // Hash password mới
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Cập nhật password
    await db.promise().query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [hashedPassword, resetToken.user_id]
    );

    // Đánh dấu token đã sử dụng
    await db.promise().query(
      'UPDATE password_reset_tokens SET used = 1 WHERE id = ?',
      [resetToken.id]
    );

    res.json({ message: 'Password reset successfully' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /auth/verify-reset-token - Kiểm tra token còn hợp lệ không
app.get('/auth/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ valid: false, error: 'Token is required' });
    }

    const [tokens] = await db.promise().query(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > NOW()',
      [token]
    );

    if (tokens.length === 0) {
      return res.json({ valid: false });
    }

    res.json({ valid: true });

  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ valid: false, error: 'Server error' });
  }
});
```

### 3.5. Cập nhật Environment Variables

**File: `docker-compose.yml`**

Thêm vào `auth-service`:

```yaml
  auth-service:
    environment:
      # Cấu hình email (Gmail example)
      - EMAIL_HOST=smtp.gmail.com
      - EMAIL_PORT=587
      - EMAIL_USER=your_gmail@gmail.com
      - EMAIL_PASS=your_app_password_here
      - EMAIL_FROM=your_gmail@gmail.com
```

**Lưu ý:** Nếu dùng Gmail, phải dùng App Password, không phải password thật.

### 3.6. Tạo Frontend Components

**File: `frontend/src/pages/ForgotPassword.jsx`** (Tạo mới)

```javascript
import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await axios.post(`${API_BASE}/auth/forgot-password`, { email });
      setMessage('Email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư của bạn.');
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.error || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h2>Quên mật khẩu</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Nhập email của bạn và chúng tôi sẽ gửi link đặt lại mật khẩu.
      </p>

      {message && (
        <div style={{ 
          padding: '12px', 
          backgroundColor: '#d4edda', 
          color: '#155724', 
          borderRadius: '4px',
          marginBottom: '16px'
        }}>
          {message}
        </div>
      )}

      {error && (
        <div style={{ 
          padding: '12px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          borderRadius: '4px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
            placeholder="your@email.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: loading ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Đang gửi...' : 'Gửi link đặt lại mật khẩu'}
        </button>
      </form>

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <Link to="/login" style={{ color: '#4CAF50', textDecoration: 'none' }}>
          ← Quay lại đăng nhập
        </Link>
      </div>
    </div>
  );
}

export default ForgotPassword;
```

**File: `frontend/src/pages/ResetPassword.jsx`** (Tạo mới)

```javascript
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [validToken, setValidToken] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Verify token khi component mount
  useEffect(() => {
    if (!token) {
      setError('Token không hợp lệ');
      setVerifying(false);
      return;
    }

    axios.get(`${API_BASE}/auth/verify-reset-token?token=${token}`)
      .then(response => {
        setValidToken(response.data.valid);
        if (!response.data.valid) {
          setError('Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
        }
      })
      .catch(() => {
        setError('Không thể xác minh token');
      })
      .finally(() => {
        setVerifying(false);
      });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    // Validation
    if (newPassword.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API_BASE}/auth/reset-password`, {
        token,
        newPassword
      });

      setMessage('Đặt lại mật khẩu thành công! Đang chuyển đến trang đăng nhập...');
      
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (err) {
      setError(err.response?.data?.error || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', textAlign: 'center' }}>
        <p>Đang xác minh...</p>
      </div>
    );
  }

  if (!validToken) {
    return (
      <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
        <h2>Link không hợp lệ</h2>
        <div style={{ 
          padding: '12px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          borderRadius: '4px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
        <p>Link đặt lại mật khẩu có thể đã hết hạn hoặc đã được sử dụng.</p>
        <Link to="/forgot-password" style={{ color: '#4CAF50' }}>
          Gửi lại link đặt lại mật khẩu
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h2>Đặt lại mật khẩu</h2>

      {message && (
        <div style={{ 
          padding: '12px', 
          backgroundColor: '#d4edda', 
          color: '#155724', 
          borderRadius: '4px',
          marginBottom: '16px'
        }}>
          {message}
        </div>
      )}

      {error && (
        <div style={{ 
          padding: '12px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          borderRadius: '4px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Mật khẩu mới
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
            placeholder="Tối thiểu 8 ký tự"
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Xác nhận mật khẩu
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
            placeholder="Nhập lại mật khẩu mới"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: loading ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
        </button>
      </form>
    </div>
  );
}

export default ResetPassword;
```

### 3.7. Cập nhật Routes

**File: `frontend/src/App.jsx`** (hoặc router config)

```javascript
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// Thêm routes
<Route path="/forgot-password" element={<ForgotPassword />} />
<Route path="/reset-password" element={<ResetPassword />} />
```

### 3.8. Thêm link "Quên mật khẩu" vào Login Page

**File: `frontend/src/pages/LoginPage.jsx`**

```javascript
// Thêm link dưới form đăng nhập
<div style={{ marginTop: '12px', textAlign: 'center' }}>
  <Link to="/forgot-password" style={{ color: '#4CAF50', fontSize: '14px' }}>
    Quên mật khẩu?
  </Link>
</div>
```

### 3.9. Rebuild và Test

```bash
# Stop containers
docker-compose down

# Rebuild services
docker-compose up --build -d

# Check logs
docker-compose logs -f auth-service

# Test email configuration
# Sẽ thấy log "Email server ready" nếu config đúng
```

**Test flow:**
1. Vào http://localhost:5173/login
2. Click "Quên mật khẩu?"
3. Nhập email đã đăng ký
4. Kiểm tra hộp thư email
5. Click link trong email
6. Nhập mật khẩu mới
7. Đăng nhập với mật khẩu mới

---

## 4. TROUBLESHOOTING

### 4.1. Google OAuth Issues

**Lỗi: redirect_uri_mismatch**
- Kiểm tra lại Authorized redirect URIs trong Google Console
- Đảm bảo chính xác: `http://localhost:8080/auth/google/callback`

**Lỗi: access_denied**
- User từ chối quyền truy cập
- Kiểm tra scope yêu cầu không quá nhiều

### 4.2. Facebook OAuth Issues

**Lỗi: Can't Load URL**
- Kiểm tra Valid OAuth Redirect URIs trong Facebook App Settings
- Đảm bảo domain được whitelist

**Lỗi: Email not provided**
- User Facebook không public email
- Cần xử lý fallback (yêu cầu nhập email)

### 4.3. Email Service Issues

**Gmail: "Less secure app access"**
- Phải dùng App Password, không dùng password thường
- Bật 2FA trước khi tạo App Password

**Email không gửi được**
```bash
# Check logs
docker-compose logs auth-service | grep -i email

# Verify SMTP connection
# Thêm vào code test:
transporter.verify((error, success) => {
  console.log('SMTP verify:', error ? error : 'OK');
});
```

**Token expired**
- Default: 1 hour
- Có thể tăng lên trong code: `Date.now() + 3600000 * 24` (24 hours)

### 4.4. Database Issues

**Bảng password_reset_tokens không tồn tại**
```bash
# Recreate database
docker-compose down -v
docker-compose up -d mysql
# Wait for MySQL healthy
docker-compose up -d
```

---

## 5. PRODUCTION CONSIDERATIONS

### 5.1. Security Best Practices

**OAuth:**
- Dùng HTTPS trong production
- Validate state parameter để chống CSRF
- Store OAuth tokens securely
- Implement token refresh mechanism

**Password Reset:**
- Rate limit forgot-password endpoint
- Log all password reset attempts
- Expire tokens after use
- Use secure random token generation
- Send notification email khi password thay đổi

### 5.2. Email Service

**Production Email Provider:**
- **SendGrid:** 100 emails/day free, easy setup
- **AWS SES:** Very cheap, reliable
- **MailGun:** Good deliverability
- **Postmark:** Best for transactional emails

**Email Best Practices:**
- Verify sender domain (SPF, DKIM, DMARC)
- Use email templates
- Track email delivery status
- Handle bounces and complaints

### 5.3. Environment Variables

Tạo file `.env` riêng cho production:

```bash
# .env.production
GOOGLE_CLIENT_ID=production_client_id
GOOGLE_CLIENT_SECRET=production_secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback

FACEBOOK_APP_ID=production_app_id
FACEBOOK_APP_SECRET=production_secret
FACEBOOK_CALLBACK_URL=https://yourdomain.com/auth/facebook/callback

EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=your_sendgrid_api_key
EMAIL_FROM=noreply@yourdomain.com

FRONTEND_URL=https://yourdomain.com
```

### 5.4. Testing

**Unit Tests:**
```javascript
// test/auth.test.js
describe('Password Reset', () => {
  it('should send reset email', async () => {
    // Test forgot-password endpoint
  });

  it('should validate token', async () => {
    // Test verify-reset-token endpoint
  });

  it('should reset password with valid token', async () => {
    // Test reset-password endpoint
  });
});
```

**Manual Testing Checklist:**
- [ ] Google OAuth sign in
- [ ] Google OAuth sign up (new user)
- [ ] Google OAuth link existing account
- [ ] Facebook OAuth sign in
- [ ] Facebook OAuth sign up
- [ ] Forgot password email sent
- [ ] Reset password with valid token
- [ ] Reset password with expired token
- [ ] Reset password with used token
- [ ] Login with new password

---

## 6. DEPLOYMENT CHECKLIST

```bash
# 1. Cập nhật dependencies
cd services/auth-service
npm install

# 2. Update docker-compose.yml với environment variables production

# 3. Rebuild images
docker-compose build auth-service

# 4. Recreate database with new schema
docker-compose down -v
docker-compose up -d mysql
# Wait for healthy
docker-compose up -d

# 5. Verify services
docker-compose ps
docker-compose logs -f auth-service

# 6. Test các flows
# - Google OAuth
# - Facebook OAuth  
# - Password reset

# 7. Monitor logs
docker-compose logs -f
```

---

## KẾT LUẬN

Bạn đã có đầy đủ hướng dẫn implement 3 tính năng:

1. **Google OAuth Login** - Cho phép đăng nhập bằng tài khoản Google
2. **Facebook OAuth Login** - Cho phép đăng nhập bằng tài khoản Facebook
3. **Password Recovery** - Cho phép đặt lại mật khẩu qua email

**Next Steps:**
1. Tạo Google OAuth credentials
2. Tạo Facebook App credentials
3. Cấu hình email service (Gmail/SendGrid)
4. Cập nhật code theo hướng dẫn
5. Update environment variables
6. Rebuild và test

**Thời gian ước tính:**
- Google OAuth: 1-2 hours
- Facebook OAuth: 1-2 hours
- Password Reset: 2-3 hours
- Testing & Debugging: 1-2 hours
- **Tổng: 5-9 hours**

Nếu cần hỗ trợ thêm về bất kỳ phần nào, hãy cho tôi biết!
