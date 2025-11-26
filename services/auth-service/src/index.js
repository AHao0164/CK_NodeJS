import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import nodemailer from 'nodemailer';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import session from 'express-session';
import RedisLockManager from '../shared/RedisLockManager.js';

const app = express();
app.disable('etag'); // Disable ETag to prevent 304 responses

// Initialize Redis Lock Manager
const lockManager = new RedisLockManager();
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:80'],
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'session-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));
app.use(passport.initialize());
app.use(passport.session());

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpw',
  database: process.env.DB_DATABASE || 'auth_db',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  connectTimeout: 10000
});

// Execute SET NAMES utf8mb4 on each connection
pool.on('connection', (connection) => {
  connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
});

// Email transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'your-email@gmail.com',
    pass: process.env.SMTP_PASS || 'your-app-password'
  }
});

// Helper to generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper to format Vietnamese datetime
function formatVietnameseDate() {
  const now = new Date();
  const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const day = vnTime.getDate().toString().padStart(2, '0');
  const month = (vnTime.getMonth() + 1).toString().padStart(2, '0');
  const year = vnTime.getFullYear();
  const hours = vnTime.getHours().toString().padStart(2, '0');
  const minutes = vnTime.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} lúc ${hours}:${minutes}`;
}

// Ensure initial admin user if env provided
async function ensureInitialAdmin() {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  const fullName = process.env.ADMIN_SEED_FULLNAME || 'Administrator';
  if (!email || !password) return;
  const conn = await pool.getConnection();
  try {
    // Try ensure column; ignore if fails (older MySQL may already have it or syntax differs)
    try {
      await conn.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER'");
    } catch (_) {}
    await conn.beginTransaction();
    let [rows] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows[0]) {
      // Try promote if role column exists
      try { await conn.query('UPDATE users SET role = \"ADMIN\" WHERE id = ?', [rows[0].id]); } catch (_) {}
    } else {
      const hash = await bcrypt.hash(password, 10);
      try {
        await conn.query('INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, \"ADMIN\")', [email, hash, fullName]);
      } catch (eIns) {
        // Fallback for DBs without role column
        await conn.query('INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)', [email, hash, fullName]);
      }
    }
    await conn.commit();
    // eslint-disable-next-line no-console
    console.log('Initial admin ensured');
  } catch (e) {
    try {
      await conn.rollback();
    } catch (_) {}
    // Handle missing column by adding then retry once
    if (e && e.code === 'ER_BAD_FIELD_ERROR') {
      try {
        await conn.query("ALTER TABLE users ADD COLUMN role ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER'");
        // Retry once
        await ensureInitialAdmin();
        return;
      } catch (e2) {
        // eslint-disable-next-line no-console
        console.error('Failed to add role column', e2);
      }
    }
    // eslint-disable-next-line no-console
    console.error('Failed to ensure admin', e);
  } finally {
    conn.release();
  }
}

ensureInitialAdmin();

// Passport Google OAuth Configuration
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8080/auth/google/callback'
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    const fullName = profile.displayName;
    const googleId = profile.id;

    // Check if user exists
    let [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (rows.length > 0) {
      // User exists, update google_id if not set
      const user = rows[0];
      if (!user.google_id) {
        await pool.query('UPDATE users SET google_id = ? WHERE id = ?', [googleId, user.id]);
      }
      return done(null, user);
    } else {
      // Create new user
      const [result] = await pool.execute(
        'INSERT INTO users (email, full_name, google_id) VALUES (?, ?, ?)',
        [email, fullName, googleId]
      );
      const newUser = {
        id: result.insertId,
        email,
        full_name: fullName,
        google_id: googleId
      };
      return done(null, newUser);
    }
  } catch (error) {
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    done(null, rows[0]);
  } catch (error) {
    done(error, null);
  }
});

app.post('/auth/signup', async (req, res) => {
  const { email, password, fullName } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)',
      [email, passwordHash, fullName]
    );
    const userId = result.insertId;
    const token = jwt.sign({ sub: userId, email, role: 'USER' }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({ token });
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  
  // 🔒 CRITICAL: Rate limit login attempts to prevent brute force attacks
  const rateLimitKey = `login:${email}`;
  const rateLimit = await lockManager.rateLimit(rateLimitKey, 5, 300); // 5 attempts per 5 minutes
  
  if (!rateLimit.allowed) {
    const resetInSeconds = rateLimit.resetAt - Math.floor(Date.now() / 1000);
    return res.status(429).json({ 
      error: 'TOO_MANY_ATTEMPTS',
      message: `Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau ${Math.ceil(resetInSeconds / 60)} phút.`,
      retryAfter: resetInSeconds
    });
  }
  
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user) {
      // Increment failed attempt counter
      await lockManager.incrementCounter(`login:failed:${email}`, 3600); // Track for 1 hour
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      // Increment failed attempt counter
      await lockManager.incrementCounter(`login:failed:${email}`, 3600);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const adminEmail = process.env.ADMIN_SEED_EMAIL;
    const roleClaim = user.role || (adminEmail && user.email === adminEmail ? 'ADMIN' : 'USER');
    const token = jwt.sign({ sub: user.id, email: user.email, role: roleClaim }, JWT_SECRET, { expiresIn: '7d' });
    
    console.log(`✅ Login successful for ${email}, remaining attempts: ${rateLimit.remaining}`);
    return res.json({ token });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const [rows] = await pool.execute('SELECT id, email, full_name, phone, province, ward, address_detail FROM users WHERE id = ?', [payload.sub]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'Not found' });
    const adminEmail = process.env.ADMIN_SEED_EMAIL;
    const role = payload.role || (adminEmail && user.email === adminEmail ? 'ADMIN' : 'USER');
    
    // Disable cache to always return fresh data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    return res.json({ 
      id: user.id, 
      email: user.email, 
      fullname: user.full_name,
      phone: user.phone,
      city: user.province,
      ward: user.ward,
      address: user.address_detail,
      role 
    });
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Update profile (full name)
app.patch('/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  const { fullName } = req.body || {};
  if (!fullName || fullName.length < 2) return res.status(400).json({ error: 'Invalid fullName' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    await pool.query('UPDATE users SET full_name = ? WHERE id = ?', [fullName, payload.sub]);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Change password
app.post('/auth/change-password', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const { currentPassword, newPassword } = req.body || {};
  if (!token) return res.status(401).json({ error: 'Missing token' });
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const [[user]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [payload.sub]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password incorrect' });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, payload.sub]);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Admin-only endpoints (guard by x-user-role header from gateway)
function requireAdmin(req, res, next) {
  if (req.path.startsWith('/admin')) {
    const role = req.headers['x-user-role'];
    if (role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
  }
  return next();
}
app.use(requireAdmin);

app.get('/admin/users', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
  const [rows] = await pool.query('SELECT id, email, full_name, phone, role, is_verified, created_at FROM users ORDER BY id DESC LIMIT ?', [limit]);
  return res.json(rows);
});

// Send OTP email
app.post('/auth/send-otp', async (req, res) => {
  const { email, fullName, phone, province, ward, addressDetail } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate phone if provided
  if (phone && !/^\d{10}$/.test(phone.replace(/\s/g, ''))) {
    return res.status(400).json({ error: 'Phone must be 10 digits' });
  }

  try {
    // Check if email already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing[0]) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Generate OTP
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    // Store OTP in database using otp_verifications table
    await pool.query(
      'INSERT INTO otp_verifications (email, otp, purpose, expires_at) VALUES (?, ?, ?, ?)',
      [email, code, 'signup', expiresAt]
    );

    // Send email
    const verifyLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-otp?email=${encodeURIComponent(email)}`;
    const dateTime = formatVietnameseDate();
    
    await transporter.sendMail({
      from: `"GearUp - Laptop Store" <${process.env.SMTP_USER || 'noreply@gearup.vn'}>`,
      to: email,
      subject: 'Mã xác thực tài khoản GearUp',
      html: `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.65; 
              color: #2d3748;
              background: #f7fafc;
              padding: 24px 12px;
            }
            .email-wrapper { 
              max-width: 580px; 
              margin: 0 auto; 
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              padding: 36px 28px;
              text-align: center;
            }
            .header h1 { 
              color: white; 
              font-size: 24px; 
              font-weight: 600;
              margin-bottom: 6px;
              letter-spacing: -0.3px;
            }
            .header p { 
              color: rgba(255, 255, 255, 0.95); 
              font-size: 14px;
              margin: 0;
            }
            .content { 
              padding: 36px 28px;
            }
            .greeting { 
              font-size: 15px; 
              color: #2d3748;
              margin-bottom: 20px;
              line-height: 1.6;
            }
            .intro-text {
              font-size: 14px;
              color: #4a5568;
              line-height: 1.7;
              margin-bottom: 28px;
            }
            .otp-section {
              background: #f7fafc;
              border-radius: 10px;
              padding: 28px 24px;
              text-align: center;
              margin: 28px 0;
              border: 1px solid #e2e8f0;
            }
            .otp-label { 
              font-size: 13px; 
              color: #718096;
              font-weight: 500;
              margin-bottom: 14px;
              text-transform: uppercase;
              letter-spacing: 0.8px;
            }
            .otp-code { 
              font-size: 42px; 
              font-weight: 700; 
              color: #667eea;
              letter-spacing: 10px;
              margin: 14px 0;
              font-family: 'Courier New', Courier, monospace;
            }
            .otp-timer {
              display: inline-block;
              background: white;
              padding: 6px 14px;
              border-radius: 16px;
              font-size: 13px;
              color: #718096;
              margin-top: 14px;
              border: 1px solid #e2e8f0;
            }
            .otp-timer strong {
              color: #e53e3e;
              font-weight: 600;
            }
            .info-card {
              background: #f7fafc;
              border-radius: 8px;
              padding: 18px 20px;
              margin: 26px 0;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #e2e8f0;
              align-items: center;
            }
            .info-row:last-child { border-bottom: none; }
            .info-label { 
              color: #718096; 
              font-size: 13px;
              font-weight: 500;
            }
            .info-value { 
              color: #2d3748; 
              font-size: 13px;
              font-weight: 600;
              text-align: right;
            }
            .security-alert {
              background: #fffbeb;
              border-left: 3px solid #f59e0b;
              border-radius: 6px;
              padding: 18px 20px;
              margin: 26px 0;
            }
            .security-alert h3 {
              color: #92400e;
              font-size: 14px;
              font-weight: 600;
              margin-bottom: 10px;
            }
            .security-alert ul {
              list-style: none;
              margin: 0;
              padding: 0;
            }
            .security-alert li {
              color: #78350f;
              font-size: 13px;
              padding: 5px 0 5px 18px;
              position: relative;
              line-height: 1.6;
            }
            .security-alert li::before {
              content: '•';
              position: absolute;
              left: 0;
              color: #f59e0b;
              font-weight: bold;
              font-size: 16px;
            }
            .support-section {
              background: #f0f9ff;
              border-radius: 6px;
              padding: 18px 20px;
              margin: 26px 0;
              text-align: center;
            }
            .support-section h3 {
              color: #1e40af;
              font-size: 14px;
              font-weight: 600;
              margin-bottom: 10px;
            }
            .contact-info {
              color: #1e40af;
              font-size: 13px;
              line-height: 1.8;
            }
            .contact-info a {
              color: #2563eb;
              text-decoration: none;
            }
            .footer {
              background: #f7fafc;
              padding: 20px 28px;
              text-align: center;
              border-top: 1px solid #e2e8f0;
            }
            .footer p {
              color: #718096;
              font-size: 12px;
              margin: 4px 0;
              line-height: 1.5;
            }
            .footer-links {
              margin-top: 10px;
            }
            .footer-link {
              color: #667eea;
              text-decoration: none;
              font-size: 12px;
              margin: 0 8px;
            }
            .footer-link:hover {
              text-decoration: underline;
            }
            @media only screen and (max-width: 600px) {
              body { padding: 0; }
              .email-wrapper { border-radius: 0; }
              .header { padding: 28px 20px; }
              .content { padding: 28px 20px; }
              .otp-code { font-size: 36px; letter-spacing: 8px; }
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="header">
              <h1>Xác thực tài khoản</h1>
              <p>Chào mừng bạn đến với GearUp</p>
            </div>
            
            <div class="content">
              <div class="greeting">
                Xin chào <strong>${fullName || 'bạn'}</strong>,
              </div>
              
              <p class="intro-text">
                Cảm ơn bạn đã đăng ký tài khoản tại <strong style="color: #667eea;">GearUp</strong>. 
                Để hoàn tất quá trình đăng ký và bảo mật tài khoản, vui lòng sử dụng mã xác thực bên dưới.
              </p>
              
              <div class="otp-section">
                <div class="otp-label">Mã xác thực của bạn</div>
                <div class="otp-code">${code}</div>
                <div class="otp-timer">
                  Hiệu lực <strong>2 phút</strong>
                </div>
              </div>

              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">Email đăng ký</span>
                  <span class="info-value">${email}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Thời gian gửi</span>
                  <span class="info-value">${dateTime}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Múi giờ</span>
                  <span class="info-value">GMT+7 (Việt Nam)</span>
                </div>
              </div>

              <div class="security-alert">
                <h3>Lưu ý bảo mật quan trọng</h3>
                <ul>
                  <li>Không chia sẻ mã OTP này với bất kỳ ai, kể cả nhân viên GearUp</li>
                  <li>GearUp không bao giờ yêu cầu mã OTP qua điện thoại hoặc tin nhắn</li>
                  <li>Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email hoặc liên hệ hỗ trợ</li>
                </ul>
              </div>

              <div class="support-section">
                <h3>Cần hỗ trợ?</h3>
                <div class="contact-info">
                  Email: <a href="mailto:support@gearup.vn">support@gearup.vn</a><br>
                  Hotline: 1900-xxxx<br>
                  Website: <a href="https://gearup.vn">gearup.vn</a>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <p><strong>GearUp - Laptop Store</strong></p>
              <p>Email này được gửi tự động, vui lòng không trả lời</p>
              <p style="margin-top: 8px;">© 2025 GearUp. All rights reserved.</p>
              <div class="footer-links">
                <a href="https://gearup.vn/terms" class="footer-link">Điều khoản</a>
                <a href="https://gearup.vn/privacy" class="footer-link">Bảo mật</a>
                <a href="https://gearup.vn/contact" class="footer-link">Liên hệ</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    });

    return res.json({ ok: true, message: 'OTP sent successfully' });
  } catch (e) {
    console.error('Send OTP error:', e);
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP and complete registration
app.post('/auth/verify-otp', async (req, res) => {
  const { email, code, password, fullName, phone, province, ward, addressDetail } = req.body;
  
  if (!email || !code || !password || !fullName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check OTP using otp_verifications table
    const [otpRows] = await pool.query(
      'SELECT * FROM otp_verifications WHERE email = ? AND otp = ? AND purpose = ? AND used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email, code, 'signup']
    );

    if (!otpRows[0]) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Mark OTP as used
    await pool.query('UPDATE otp_verifications SET used = 1 WHERE id = ?', [otpRows[0].id]);

    // Create user
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (email, password_hash, full_name, phone, province, ward, address_detail, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
      [email, passwordHash, fullName, phone || null, province || null, ward || null, addressDetail || null]
    );

    const userId = result.insertId;
    const token = jwt.sign({ sub: userId, email, role: 'USER' }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({ token, user: { id: userId, email, fullName } });
  } catch (e) {
    console.error('Verify OTP error:', e);
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
});

// Resend OTP
app.post('/auth/resend-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    // Check if user already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing[0]) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Generate new OTP
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    await pool.query(
      'INSERT INTO otp_verifications (email, otp, purpose, expires_at) VALUES (?, ?, ?, ?)',
      [email, code, 'signup', expiresAt]
    );

    const verifyLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-otp?email=${encodeURIComponent(email)}`;
    const dateTime = formatVietnameseDate();

    await transporter.sendMail({
      from: `"GearUp - Laptop Store" <${process.env.SMTP_USER || 'noreply@gearup.vn'}>`,
      to: email,
      subject: 'Mã OTP mới - GearUp',
      html: `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              line-height: 1.65; 
              color: #2d3748;
              background: #f7fafc;
              padding: 24px 12px;
            }
            .email-wrapper { 
              max-width: 580px; 
              margin: 0 auto; 
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              padding: 36px 28px;
              text-align: center;
            }
            .header h1 { 
              color: white; 
              font-size: 24px; 
              font-weight: 600;
              margin: 0;
            }
            .content { 
              padding: 36px 28px;
            }
            .message { 
              font-size: 14px; 
              color: #4a5568;
              line-height: 1.7;
              margin-bottom: 28px;
            }
            .otp-box {
              background: #f7fafc;
              border-radius: 10px;
              padding: 28px 24px;
              text-align: center;
              margin: 28px 0;
              border: 1px solid #e2e8f0;
            }
            .otp-label { 
              font-size: 13px; 
              color: #718096;
              font-weight: 500;
              margin-bottom: 14px;
              text-transform: uppercase;
              letter-spacing: 0.8px;
            }
            .otp-code { 
              font-size: 42px; 
              font-weight: 700; 
              color: #667eea;
              letter-spacing: 10px;
              margin: 14px 0;
              font-family: 'Courier New', Courier, monospace;
            }
            .info-text {
              font-size: 13px;
              color: #718096;
              margin-top: 14px;
            }
            .info-text strong {
              color: #e53e3e;
              font-weight: 600;
            }
            .footer {
              background: #f7fafc;
              padding: 20px 28px;
              text-align: center;
              border-top: 1px solid #e2e8f0;
            }
            .footer p {
              color: #718096;
              font-size: 12px;
              margin: 4px 0;
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="header">
              <h1>Mã OTP mới</h1>
            </div>
            
            <div class="content">
              <p class="message">
                Bạn vừa yêu cầu gửi lại mã xác thực. Vui lòng sử dụng mã OTP bên dưới để hoàn tất đăng ký.
              </p>
              
              <div class="otp-box">
                <div class="otp-label">Mã xác thực của bạn</div>
                <div class="otp-code">${code}</div>
                <div class="info-text">Hiệu lực <strong>2 phút</strong> • ${dateTime}</div>
              </div>

              <p style="font-size: 13px; color: #4a5568; line-height: 1.6; margin-top: 24px;">
                Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email hoặc liên hệ hỗ trợ tại 
                <a href="mailto:support@gearup.vn" style="color: #667eea; text-decoration: none;">support@gearup.vn</a>
              </p>
            </div>
            
            <div class="footer">
              <p><strong>GearUp - Laptop Store</strong></p>
              <p>© 2025 GearUp. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error('Resend OTP error:', e);
    return res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

// Get Terms & Conditions
app.get('/auth/terms-conditions', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT title, content, version, created_at FROM terms_conditions WHERE active = 1 ORDER BY created_at DESC LIMIT 1'
    );
    
    if (!rows[0]) {
      return res.status(404).json({ error: 'Terms not found' });
    }
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.json(rows[0]);
  } catch (e) {
    console.error('Terms fetch error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get Privacy Policy
app.get('/auth/privacy-policy', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT title, content, version, created_at FROM privacy_policy WHERE active = 1 ORDER BY created_at DESC LIMIT 1'
    );
    
    if (!rows[0]) {
      return res.status(404).json({ error: 'Privacy policy not found' });
    }
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.json(rows[0]);
  } catch (e) {
    console.error('Privacy fetch error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile (extended)
app.patch('/auth/profile', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { fullName, phone, province, ward, addressDetail } = req.body || {};

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const updates = [];
    const values = [];

    if (fullName !== undefined) {
      updates.push('full_name = ?');
      values.push(fullName || null);
    }
    if (phone !== undefined) {
      const cleanPhone = phone ? phone.replace(/\s/g, '') : '';
      if (cleanPhone && !/^\d{10,11}$/.test(cleanPhone)) {
        return res.status(400).json({ error: 'Phone must be 10-11 digits' });
      }
      updates.push('phone = ?');
      values.push(cleanPhone || null);
    }
    if (province !== undefined) {
      updates.push('province = ?');
      values.push(province || null);
    }
    if (ward !== undefined) {
      updates.push('ward = ?');
      values.push(ward || null);
    }
    if (addressDetail !== undefined) {
      updates.push('address_detail = ?');
      values.push(addressDetail || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(payload.sub);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    return res.json({ ok: true });
  } catch (e) {
    console.error('Update profile error:', e);
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Get user profile (extended)
app.get('/auth/profile', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const [rows] = await pool.execute(
      'SELECT id, email, full_name, phone, province, ward, address_detail, is_verified, role, created_at FROM users WHERE id = ?',
      [payload.sub]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'Not found' });

    return res.json({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      province: user.province,
      ward: user.ward,
      addressDetail: user.address_detail,
      verifiedEmail: user.is_verified,
      role: user.role,
      createdAt: user.created_at
    });
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Send COD OTP for checkout
app.post('/auth/send-cod-otp', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { email, orderTotal, items } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const otp = generateOTP();
    
    // Store OTP in database with 3 minute expiry
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000);
    await pool.execute(
      'INSERT INTO otp_codes (user_id, email, code, type, expires_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE email = ?, code = ?, expires_at = ?',
      [payload.sub, email, otp, 'COD', expiresAt, email, otp, expiresAt]
    );

    // Send email
    const itemsList = items?.map(it => `- ${it.name} x${it.quantity}: ${((it.price || 0) / 100).toLocaleString()}₫`).join('\n') || '';
    const sentTime = new Date();
    const expiryTime = new Date(sentTime.getTime() + 3 * 60 * 1000);
    const formatTime = (date) => date.toLocaleString('vi-VN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
    
    console.log('Sending COD OTP email to:', email);
    const mailResult = await transporter.sendMail({
      from: process.env.SMTP_USER || 'GearUp <noreply@gearup.vn>',
      to: email,
      subject: '🛒 Mã OTP xác nhận đơn hàng GearUp',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0; font-size: 28px;">GearUp</h1>
              <p style="color: #64748b; margin: 5px 0 0 0;">Công nghệ - Đam mê - Chất lượng</p>
            </div>
            
            <h2 style="color: #1e293b; margin-bottom: 20px;">Xác nhận đơn hàng COD</h2>
            
            <p style="color: #475569; line-height: 1.6;">Chào bạn,</p>
            <p style="color: #475569; line-height: 1.6;">Cảm ơn bạn đã đặt hàng tại GearUp. Để hoàn tất đơn hàng thanh toán khi nhận hàng (COD), vui lòng nhập mã OTP bên dưới:</p>
            
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px; padding: 25px; text-align: center; margin: 30px 0;">
              <p style="color: white; margin: 0 0 10px 0; font-size: 14px;">MÃ OTP CỦA BẠN</p>
              <p style="color: white; font-size: 42px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${otp}</p>
              <p style="color: #dbeafe; margin: 10px 0 0 0; font-size: 12px;">Có hiệu lực trong 3 phút</p>
            </div>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="color: #92400e; margin: 0 0 8px 0; font-size: 14px;"><strong>⏰ Thời gian gửi mã:</strong></p>
              <p style="color: #92400e; margin: 0; font-size: 13px;">📅 ${formatTime(sentTime)}</p>
              <p style="color: #92400e; margin: 8px 0 0 0; font-size: 14px;"><strong>⌛ Mã hết hạn lúc:</strong></p>
              <p style="color: #92400e; margin: 0; font-size: 13px;">📅 ${formatTime(expiryTime)}</p>
            </div>
            
            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 16px;">📦 Chi tiết đơn hàng:</h3>
              <pre style="color: #475569; margin: 0; white-space: pre-wrap; font-family: inherit; line-height: 1.8;">${itemsList}</pre>
              <div style="border-top: 2px solid #cbd5e1; margin-top: 15px; padding-top: 15px;">
                <p style="color: #1e293b; font-size: 18px; font-weight: bold; margin: 0;">Tổng thanh toán: ${((orderTotal || 0) / 100).toLocaleString()}₫</p>
              </div>
            </div>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="color: #92400e; margin: 0; font-size: 14px;"><strong>⚠️ Lưu ý bảo mật:</strong> Không chia sẻ mã OTP này với bất kỳ ai, kể cả nhân viên GearUp.</p>
            </div>
            
            <p style="color: #64748b; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              Email này được gửi tự động. Vui lòng không trả lời.<br>
              Nếu bạn không thực hiện đơn hàng này, vui lòng liên hệ: support@gearup.vn
            </p>
          </div>
        </div>
      `
    });
    console.log('COD OTP email sent successfully:', mailResult.messageId);

    return res.json({ ok: true, message: 'OTP sent successfully' });
  } catch (e) {
    console.error('Send COD OTP error:', e);
    return res.status(500).json({ error: 'Failed to send OTP', details: e.message });
  }
});

// Verify COD OTP
app.post('/auth/verify-cod-otp', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { email, otp } = req.body;
  console.log('Verify COD OTP request:', { email, otp, bodyKeys: Object.keys(req.body) });
  
  if (!email || !otp) {
    console.log('Missing email or OTP:', { email: !!email, otp: !!otp });
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    console.log('JWT verified, user_id:', payload.sub);
    
    const [rows] = await pool.execute(
      'SELECT * FROM otp_codes WHERE user_id = ? AND email = ? AND code = ? AND type = ? AND expires_at > NOW()',
      [payload.sub, email, otp, 'COD']
    );

    console.log('OTP query result:', { found: rows.length, userId: payload.sub, email, otp });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Delete used OTP
    await pool.execute('DELETE FROM otp_codes WHERE id = ?', [rows[0].id]);
    
    // ✅ NEW: Call order-service to confirm order and reserve inventory
    // This is where stock should be deducted for COD orders
    try {
      const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3004';
      const orderResponse = await fetch(`${ORDER_SERVICE_URL}/orders/confirm-cod`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': payload.sub.toString()
        },
        body: JSON.stringify({ userId: payload.sub, email })
      });
      
      if (!orderResponse.ok) {
        console.error('Failed to confirm COD order:', await orderResponse.text());
      } else {
        console.log('✅ COD order confirmed and stock reserved');
      }
    } catch (orderErr) {
      console.error('Error calling order service:', orderErr.message);
      // Continue even if order confirmation fails - user already verified OTP
    }

    return res.json({ ok: true, message: 'OTP verified successfully' });
  } catch (e) {
    console.error('Verify COD OTP error:', e);
    return res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// Send reset password OTP
app.post('/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    // Check if user exists
    const [users] = await pool.execute('SELECT id, full_name FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Email không tồn tại trong hệ thống' });
    }

    const user = users[0];
    const otp = generateOTP();
    
    // Store OTP with 2 minute expiry using otp_verifications table
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
    await pool.execute(
      'INSERT INTO otp_verifications (email, otp, purpose, expires_at) VALUES (?, ?, ?, ?)',
      [email, otp, 'reset_password', expiresAt]
    );

    const sentTime = new Date();
    const expiryTime = new Date(sentTime.getTime() + 2 * 60 * 1000);
    const formatTime = (date) => date.toLocaleString('vi-VN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_USER || 'GearUp <noreply@gearup.vn>',
      to: email,
      subject: '🔐 Mã OTP đặt lại mật khẩu - GearUp',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0; font-size: 28px;">🔐 GearUp</h1>
              <p style="color: #64748b; margin: 5px 0 0 0;">Đặt lại mật khẩu</p>
            </div>
            
            <h2 style="color: #1e293b; margin-bottom: 20px;">Xin chào ${user.full_name || 'bạn'},</h2>
            
            <p style="color: #475569; line-height: 1.6;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng sử dụng mã OTP bên dưới để xác nhận:</p>
            
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 12px; padding: 25px; text-align: center; margin: 30px 0;">
              <p style="color: white; margin: 0 0 10px 0; font-size: 14px;">MÃ OTP XÁC NHẬN</p>
              <p style="color: white; font-size: 42px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${otp}</p>
              <p style="color: #fecaca; margin: 10px 0 0 0; font-size: 12px;">Có hiệu lực trong 2 phút</p>
            </div>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="color: #92400e; margin: 0 0 8px 0; font-size: 14px;"><strong>⏰ Thời gian gửi:</strong></p>
              <p style="color: #92400e; margin: 0; font-size: 13px;">📅 ${formatTime(sentTime)}</p>
              <p style="color: #92400e; margin: 8px 0 0 0; font-size: 14px;"><strong>⌛ Mã hết hạn:</strong></p>
              <p style="color: #92400e; margin: 0; font-size: 13px;">📅 ${formatTime(expiryTime)}</p>
            </div>
            
            <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="color: #991b1b; margin: 0; font-size: 14px;"><strong>⚠️ Lưu ý:</strong></p>
              <p style="color: #991b1b; margin: 8px 0 0 0; font-size: 13px;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này và liên hệ với chúng tôi ngay.</p>
            </div>
            
            <div style="border-top: 1px solid #e2e8f0; margin-top: 30px; padding-top: 20px; text-align: center;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">© 2024 GearUp - Hệ thống bán laptop và linh kiện</p>
              <p style="color: #94a3b8; font-size: 12px; margin: 5px 0 0 0;">Đây là email tự động, vui lòng không trả lời</p>
            </div>
          </div>
        </div>
      `
    });

    return res.json({ ok: true, message: 'OTP đã được gửi đến email của bạn' });
  } catch (e) {
    console.error('Forgot password error:', e);
    return res.status(500).json({ error: 'Không thể gửi OTP' });
  }
});

// Verify reset password OTP (check OTP before allowing password change)
app.post('/auth/verify-reset-otp', async (req, res) => {
  const { email, otp } = req.body;
  
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email và OTP là bắt buộc' });
  }

  try {
    // Check if OTP is valid and not expired
    const [otpRows] = await pool.execute(
      'SELECT * FROM otp_verifications WHERE email = ? AND otp = ? AND purpose = ? AND used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email, otp, 'reset_password']
    );

    if (otpRows.length === 0) {
      return res.status(400).json({ error: 'Mã OTP không hợp lệ hoặc đã hết hạn' });
    }

    return res.json({ ok: true, message: 'Mã OTP hợp lệ' });
  } catch (e) {
    console.error('Verify reset OTP error:', e);
    return res.status(500).json({ error: 'Không thể xác thực OTP' });
  }
});

// Verify reset password OTP and update password
app.post('/auth/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP và mật khẩu mới là bắt buộc' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
  }

  try {
    // Verify OTP using otp_verifications table
    const [otpRows] = await pool.execute(
      'SELECT * FROM otp_verifications WHERE email = ? AND otp = ? AND purpose = ? AND used = 0 AND expires_at > NOW()',
      [email, otp, 'reset_password']
    );

    if (otpRows.length === 0) {
      return res.status(400).json({ error: 'Mã OTP không hợp lệ hoặc đã hết hạn' });
    }

    const otpRecord = otpRows[0];

    // Hash new password
    const hash = await bcrypt.hash(newPassword, 10);

    // Update password for user with this email
    await pool.execute(
      'UPDATE users SET password_hash = ? WHERE email = ?',
      [hash, email]
    );

    // Mark OTP as used
    await pool.execute('UPDATE otp_verifications SET used = 1 WHERE id = ?', [otpRecord.id]);

    return res.json({ ok: true, message: 'Mật khẩu đã được đặt lại thành công' });
  } catch (e) {
    console.error('Reset password error:', e);
    return res.status(500).json({ error: 'Không thể đặt lại mật khẩu' });
  }
});

// Google OAuth routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: process.env.FRONTEND_URL || 'http://localhost:5175/login' }),
  async (req, res) => {
    try {
      // Generate JWT token for the authenticated user
      const user = req.user;
      const token = jwt.sign({ 
        sub: user.id, 
        email: user.email, 
        role: user.role || 'USER' 
      }, JWT_SECRET, { expiresIn: '7d' });
      
      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    } catch (error) {
      console.error('Google callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
      res.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  }
);

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy', 
      service: 'auth-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      service: 'auth-service',
      error: error.message 
    });
  }
});

// Connect to Redis on startup
lockManager.connect().then(() => {
  console.log('✅ Auth service Redis lock manager ready');
}).catch(err => {
  console.error('❌ Redis connection failed:', err);
  console.warn('⚠️ Service will run WITHOUT rate limiting');
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Auth service listening on ${PORT}`);
});


