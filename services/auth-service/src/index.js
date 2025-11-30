import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import nodemailer from 'nodemailer';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import crypto from 'crypto';
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
app.use(passport.initialize());
app.use(morgan('dev'));

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

// OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8080/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
const FACEBOOK_CALLBACK_URL = process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:8080/auth/facebook/callback';

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

// Wait for database to be ready
async function waitForDatabase(maxRetries = 30, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();
      console.log('Database connection established');
      return true;
    } catch (err) {
      console.log(`Waiting for database... attempt ${i + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Could not connect to database after maximum retries');
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

// Initialize database and admin user
async function initializeService() {
  try {
    await waitForDatabase();
    await ensureInitialAdmin();
  } catch (err) {
    console.error('Failed to initialize service:', err);
    process.exit(1);
  }
}

initializeService();

// Passport Google OAuth Configuration
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
      let [users] = await pool.query(
        'SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?',
        [oauthProvider, oauthId]
      );

      let user;
      if (users.length > 0) {
        // User đã tồn tại
        user = users[0];
      } else {
        // Kiểm tra xem email đã tồn tại chưa (có thể đã đăng ký bằng email/password)
        [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length > 0) {
          // Link OAuth với tài khoản hiện có
          user = users[0];
          await pool.query(
            'UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?',
            [oauthProvider, oauthId, user.id]
          );
        } else {
          // Tạo user mới
          const [result] = await pool.query(
            'INSERT INTO users (email, full_name, oauth_provider, oauth_id, password_hash) VALUES (?, ?, ?, ?, ?)',
            [email, fullName, oauthProvider, oauthId, ''] // password_hash rỗng cho OAuth users
          );
          // Fetch lại user từ database để có đầy đủ thông tin (bao gồm role)
          const [newUsers] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
          user = newUsers[0];
        }
      }

      return done(null, user);
    } catch (error) {
      console.error('Google OAuth error:', error);
      return done(error, null);
    }
  }));
}

// Passport Facebook OAuth Configuration
if (FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: FACEBOOK_APP_ID,
    clientSecret: FACEBOOK_APP_SECRET,
    callbackURL: FACEBOOK_CALLBACK_URL,
    profileFields: ['id', 'emails', 'name', 'displayName']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Email có thể không có nếu user không cấp quyền
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : `fb_${profile.id}@facebook.oauth`;
      const fullName = profile.displayName;
      const oauthProvider = 'facebook';
      const oauthId = profile.id;

      // Tìm user theo oauth_provider và oauth_id
      let [users] = await pool.query(
        'SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?',
        [oauthProvider, oauthId]
      );

      let user;
      if (users.length > 0) {
        user = users[0];
      } else {
        // Kiểm tra email đã tồn tại chưa
        [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length > 0) {
          // Link OAuth với tài khoản hiện có
          user = users[0];
          await pool.query(
            'UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?',
            [oauthProvider, oauthId, user.id]
          );
        } else {
          // Tạo user mới
          const [result] = await pool.query(
            'INSERT INTO users (email, full_name, oauth_provider, oauth_id, password_hash) VALUES (?, ?, ?, ?, ?)',
            [email, fullName, oauthProvider, oauthId, '']
          );
          // Fetch lại user từ database để có đầy đủ thông tin (bao gồm role)
          const [newUsers] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
          user = newUsers[0];
        }
      }

      return done(null, user);
    } catch (error) {
      console.error('Facebook OAuth error:', error);
      return done(error, null);
    }
  }));
}

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

// Ensure a user exists for guest checkout (auto-create account if needed)
app.post('/auth/ensure-guest', async (req, res) => {
  try {
    const { email, fullName, phone, province, ward, addressDetail } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Try to find existing user
    const [rows] = await pool.query(
      'SELECT id, email, full_name, phone, province, ward, address_detail FROM users WHERE email = ?',
      [email]
    );

    if (rows[0]) {
      const existing = rows[0];
      // Optionally enrich missing contact fields
      const needsUpdate =
        (fullName && !existing.full_name) ||
        (phone && !existing.phone) ||
        (province && !existing.province) ||
        (ward && !existing.ward) ||
        (addressDetail && !existing.address_detail);

      if (needsUpdate) {
        await pool.query(
          'UPDATE users SET full_name = COALESCE(full_name, ?), phone = COALESCE(phone, ?), province = COALESCE(province, ?), ward = COALESCE(ward, ?), address_detail = COALESCE(address_detail, ?) WHERE id = ?',
          [fullName || null, phone || null, province || null, ward || null, addressDetail || null, existing.id]
        );
      }

      return res.json({ id: existing.id, email: existing.email, existing: true });
    }

    // Create a new "guest" user with a random password
    const randomPassword = crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, full_name, phone, province, ward, address_detail) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email, passwordHash, fullName || null, phone || null, province || null, ward || null, addressDetail || null]
    );

    return res.status(201).json({ id: result.insertId, email, existing: false });
  } catch (e) {
    console.error('❌ ensure-guest error:', e);
    console.error('   Error message:', e.message);
    console.error('   Error code:', e.code);
    console.error('   Error stack:', e.stack);
    return res.status(500).json({ 
      error: 'Server error',
      message: process.env.NODE_ENV === 'development' ? e.message : 'Failed to create guest account'
    });
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

// ===============================
// Shipping Addresses Management
// ===============================

// Helper to extract user id from Authorization header
async function getUserIdFromRequest(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return null;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload.sub;
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}

// Get all addresses of current user
app.get('/auth/addresses', async (req, res) => {
  try {
    const userId = await getUserIdFromRequest(req, res);
    if (!userId) return;

    const [rows] = await pool.query(
      'SELECT id, full_name, phone, province, district, ward, address_detail, is_default, created_at, updated_at FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [userId]
    );

    return res.json(rows.map(a => ({
      id: a.id,
      fullName: a.full_name,
      phone: a.phone,
      province: a.province,
      district: a.district,
      ward: a.ward,
      addressDetail: a.address_detail,
      isDefault: !!a.is_default,
      createdAt: a.created_at,
      updatedAt: a.updated_at
    })));
  } catch (e) {
    console.error('Get addresses error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Create new address
app.post('/auth/addresses', async (req, res) => {
  try {
    const userId = await getUserIdFromRequest(req, res);
    if (!userId) return;

    const {
      fullName,
      phone,
      province,
      ward,
      addressDetail,
      district,
      isDefault
    } = req.body || {};

    if (!fullName || fullName.trim().length < 2) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    if (!phone || !/^\d{10,11}$/.test(String(phone).replace(/\s/g, ''))) {
      return res.status(400).json({ error: 'Phone must be 10-11 digits' });
    }
    if (!province) {
      return res.status(400).json({ error: 'Province is required' });
    }
    if (!ward) {
      return res.status(400).json({ error: 'Ward is required' });
    }
    if (!addressDetail || addressDetail.trim().length < 3) {
      return res.status(400).json({ error: 'Address detail is required' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Determine if this should be default address
      const [existing] = await conn.query(
        'SELECT id FROM addresses WHERE user_id = ? AND is_default = 1 LIMIT 1',
        [userId]
      );

      const makeDefault = isDefault || !existing[0];

      if (makeDefault) {
        await conn.query(
          'UPDATE addresses SET is_default = 0 WHERE user_id = ?',
          [userId]
        );
      }

      const districtValue = district || province; // fallback while UI chưa có quận/huyện riêng

      const [result] = await conn.query(
        'INSERT INTO addresses (user_id, full_name, phone, province, district, ward, address_detail, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, fullName.trim(), String(phone).replace(/\s/g, ''), province, districtValue, ward, addressDetail.trim(), makeDefault ? 1 : 0]
      );

      const newId = result.insertId;

      // If default, also sync to users table so các chỗ khác (checkout, profile) dùng được ngay
      if (makeDefault) {
        await conn.query(
          'UPDATE users SET full_name = ?, phone = ?, province = ?, ward = ?, address_detail = ? WHERE id = ?',
          [fullName.trim(), String(phone).replace(/\s/g, ''), province, ward, addressDetail.trim(), userId]
        );
      }

      await conn.commit();

      return res.status(201).json({
        id: newId,
        fullName: fullName.trim(),
        phone: String(phone).replace(/\s/g, ''),
        province,
        district: districtValue,
        ward,
        addressDetail: addressDetail.trim(),
        isDefault: makeDefault
      });
    } catch (e) {
      await conn.rollback();
      console.error('Create address error:', e);
      return res.status(500).json({ error: 'Server error' });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('Create address unexpected error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Update an address
app.patch('/auth/addresses/:id', async (req, res) => {
  try {
    const userId = await getUserIdFromRequest(req, res);
    if (!userId) return;

    const addressId = parseInt(req.params.id, 10);
    if (!addressId || Number.isNaN(addressId)) {
      return res.status(400).json({ error: 'Invalid address id' });
    }

    const {
      fullName,
      phone,
      province,
      ward,
      addressDetail,
      district,
      isDefault
    } = req.body || {};

    // Ensure the address belongs to user
    const [[existing]] = await pool.query(
      'SELECT * FROM addresses WHERE id = ? AND user_id = ?',
      [addressId, userId]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Address not found' });
    }

    const updates = [];
    const values = [];

    if (fullName !== undefined) {
      if (!fullName || fullName.trim().length < 2) {
        return res.status(400).json({ error: 'Full name is required' });
      }
      updates.push('full_name = ?');
      values.push(fullName.trim());
    }

    if (phone !== undefined) {
      const cleanPhone = String(phone).replace(/\s/g, '');
      if (!cleanPhone || !/^\d{10,11}$/.test(cleanPhone)) {
        return res.status(400).json({ error: 'Phone must be 10-11 digits' });
      }
      updates.push('phone = ?');
      values.push(cleanPhone);
    }

    if (province !== undefined) {
      if (!province) {
        return res.status(400).json({ error: 'Province is required' });
      }
      updates.push('province = ?');
      values.push(province);
    }

    if (ward !== undefined) {
      if (!ward) {
        return res.status(400).json({ error: 'Ward is required' });
      }
      updates.push('ward = ?');
      values.push(ward);
    }

    if (district !== undefined) {
      updates.push('district = ?');
      values.push(district || province || existing.province);
    }

    if (addressDetail !== undefined) {
      if (!addressDetail || addressDetail.trim().length < 3) {
        return res.status(400).json({ error: 'Address detail is required' });
      }
      updates.push('address_detail = ?');
      values.push(addressDetail.trim());
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (updates.length > 0) {
        values.push(addressId, userId);
        await conn.query(
          `UPDATE addresses SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
          values
        );
      }

      // Handle default flag separately
      if (isDefault === true) {
        await conn.query(
          'UPDATE addresses SET is_default = 0 WHERE user_id = ?',
          [userId]
        );
        await conn.query(
          'UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?',
          [addressId, userId]
        );

        // Sync to users table using latest address data
        const [[addr]] = await conn.query(
          'SELECT full_name, phone, province, ward, address_detail FROM addresses WHERE id = ? AND user_id = ?',
          [addressId, userId]
        );
        if (addr) {
          await conn.query(
            'UPDATE users SET full_name = ?, phone = ?, province = ?, ward = ?, address_detail = ? WHERE id = ?',
            [addr.full_name, addr.phone, addr.province, addr.ward, addr.address_detail, userId]
          );
        }
      }

      await conn.commit();

      return res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      console.error('Update address error:', e);
      return res.status(500).json({ error: 'Server error' });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('Update address unexpected error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Delete an address
app.delete('/auth/addresses/:id', async (req, res) => {
  try {
    const userId = await getUserIdFromRequest(req, res);
    if (!userId) return;

    const addressId = parseInt(req.params.id, 10);
    if (!addressId || Number.isNaN(addressId)) {
      return res.status(400).json({ error: 'Invalid address id' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[addr]] = await conn.query(
        'SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ?',
        [addressId, userId]
      );

      if (!addr) {
        await conn.rollback();
        return res.status(404).json({ error: 'Address not found' });
      }

      await conn.query(
        'DELETE FROM addresses WHERE id = ? AND user_id = ?',
        [addressId, userId]
      );

      // If deleted address was default, pick another one (most recent) as default and sync to users
      if (addr.is_default) {
        const [[fallback]] = await conn.query(
          'SELECT id, full_name, phone, province, ward, address_detail FROM addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
          [userId]
        );

        if (fallback) {
          await conn.query(
            'UPDATE addresses SET is_default = 1 WHERE id = ?',
            [fallback.id]
          );
          await conn.query(
            'UPDATE users SET full_name = ?, phone = ?, province = ?, ward = ?, address_detail = ? WHERE id = ?',
            [fallback.full_name, fallback.phone, fallback.province, fallback.ward, fallback.address_detail, userId]
          );
        } else {
          // No addresses left, do not clear user info but keep existing profile fields
        }
      }

      await conn.commit();

      return res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      console.error('Delete address error:', e);
      return res.status(500).json({ error: 'Server error' });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('Delete address unexpected error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Set an address as default explicitly
app.patch('/auth/addresses/:id/default', async (req, res) => {
  try {
    const userId = await getUserIdFromRequest(req, res);
    if (!userId) return;

    const addressId = parseInt(req.params.id, 10);
    if (!addressId || Number.isNaN(addressId)) {
      return res.status(400).json({ error: 'Invalid address id' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[addr]] = await conn.query(
        'SELECT id, full_name, phone, province, ward, address_detail FROM addresses WHERE id = ? AND user_id = ?',
        [addressId, userId]
      );

      if (!addr) {
        await conn.rollback();
        return res.status(404).json({ error: 'Address not found' });
      }

      await conn.query(
        'UPDATE addresses SET is_default = 0 WHERE user_id = ?',
        [userId]
      );
      await conn.query(
        'UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?',
        [addressId, userId]
      );

      await conn.query(
        'UPDATE users SET full_name = ?, phone = ?, province = ?, ward = ?, address_detail = ? WHERE id = ?',
        [addr.full_name, addr.phone, addr.province, addr.ward, addr.address_detail, userId]
      );

      await conn.commit();

      return res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      console.error('Set default address error:', e);
      return res.status(500).json({ error: 'Server error' });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('Set default address unexpected error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Send COD OTP for checkout (supports both authenticated and guest users)
app.post('/auth/send-cod-otp', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  console.log('📧 Send COD OTP request:', {
    hasToken: !!token,
    email: req.body?.email,
    orderId: req.body?.orderId
  });
  
  const { email, orderTotal, items } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    let userId = null;
    
    // If token provided, verify and get user_id
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        userId = payload.sub;
        console.log('✅ Authenticated user:', userId);
      } catch (jwtError) {
        // Invalid token, but allow guest to continue
        console.warn('⚠️ Invalid token for COD OTP, treating as guest:', jwtError.message);
      }
    } else {
      console.log('👤 Guest user (no token)');
    }
    
    const otp = generateOTP();
    
    // Store OTP in database with 3 minute expiry
    // For guest users, user_id will be NULL and we use email as identifier
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000);
    await pool.execute(
      'INSERT INTO otp_codes (user_id, email, code, type, expires_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE email = ?, code = ?, expires_at = ?',
      [userId, email, otp, 'COD', expiresAt, email, otp, expiresAt]
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

// Verify COD OTP (supports both authenticated and guest users)
app.post('/auth/verify-cod-otp', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const { email, otp, orderId } = req.body;
  console.log('Verify COD OTP request:', { email, otp, orderId, hasToken: !!token });
  
  if (!email || !otp) {
    console.log('Missing email or OTP:', { email: !!email, otp: !!otp });
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  try {
    let userId = null;
    
    // If token provided, verify and get user_id
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        userId = payload.sub;
        console.log('JWT verified, user_id:', userId);
      } catch (jwtError) {
        // Invalid token, but allow guest to continue
        console.warn('Invalid token for COD OTP verification, treating as guest:', jwtError.message);
      }
    }
    
    // For guest users (userId is NULL), find OTP by email only
    // For authenticated users, find by both user_id and email
    let query, params;
    if (userId) {
      query = 'SELECT * FROM otp_codes WHERE user_id = ? AND email = ? AND code = ? AND type = ? AND expires_at > NOW()';
      params = [userId, email, otp, 'COD'];
    } else {
      query = 'SELECT * FROM otp_codes WHERE user_id IS NULL AND email = ? AND code = ? AND type = ? AND expires_at > NOW()';
      params = [email, otp, 'COD'];
    }
    
    const [rows] = await pool.execute(query, params);

    console.log('OTP query result:', { found: rows.length, userId, email, otp });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Delete used OTP
    await pool.execute('DELETE FROM otp_codes WHERE id = ?', [rows[0].id]);
    
    // ✅ Call order-service to confirm order and reserve inventory
    // For guest users, orderId must be provided in request body
    // For authenticated users, we can find order by userId (or use orderId if provided)
    try {
      const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3004';
      
      // Build confirm body: always include email, include orderId if provided (for guest)
      const confirmBody = { email };
      if (orderId) {
        confirmBody.orderId = orderId;
      }
      
      const orderResponse = await fetch(`${ORDER_SERVICE_URL}/orders/confirm-cod`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-user-id': userId.toString() } : {})
        },
        body: JSON.stringify(confirmBody)
      });
      
      if (!orderResponse.ok) {
        const errorText = await orderResponse.text();
        console.error('Failed to confirm COD order:', errorText);
        return res.status(500).json({ 
          error: 'Failed to confirm order',
          message: process.env.NODE_ENV === 'development' ? errorText : 'Server error'
        });
      } else {
        const result = await orderResponse.json();
        console.log('✅ COD order confirmed and stock reserved:', result);
      }
    } catch (orderErr) {
      console.error('Error calling order service:', orderErr.message);
      return res.status(500).json({ 
        error: 'Failed to confirm order',
        message: process.env.NODE_ENV === 'development' ? orderErr.message : 'Server error'
      });
    }

    return res.json({ ok: true, message: 'OTP verified successfully' });
  } catch (e) {
    console.error('Verify COD OTP error:', e);
    return res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// Helper function to send reset password email (token-based)
async function sendResetEmail(email, token) {
  if (!transporter) {
    throw new Error('Email service not configured');
  }

  const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;
  
  const mailOptions = {
    from: `"GearUp Shop" <${process.env.SMTP_USER || 'noreply@gearup.vn'}>`,
    to: email,
    subject: 'Đặt lại mật khẩu - GearUp Shop',
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
          Email này được gửi từ GearUp Shop. Vui lòng không trả lời email này.
        </p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

// POST /auth/forgot-password (Token-based - from services1)
// This endpoint supports both OTP-based (existing) and token-based (new) reset
app.post('/auth/forgot-password-token', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Kiểm tra user tồn tại
    const [users] = await pool.query('SELECT id, email FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      // Không tiết lộ email không tồn tại (security best practice)
      return res.json({ message: 'If email exists, reset link will be sent' });
    }

    const user = users[0];

    // Tạo reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // Lưu token vào database
    await pool.query(
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

// POST /auth/reset-password-token - Đặt lại mật khẩu với token
app.post('/auth/reset-password-token', async (req, res) => {
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
    const [tokens] = await pool.query(
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
    await pool.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [hashedPassword, resetToken.user_id]
    );

    // Đánh dấu token đã sử dụng
    await pool.query(
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

    const [tokens] = await pool.query(
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

// Send reset password OTP (existing - keep for backward compatibility)
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

// Send order confirmation email
app.post('/auth/send-order-confirmation', async (req, res) => {
  try {
    const { orderId, email, orderData } = req.body;
    
    if (!orderId || !email || !orderData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Format order data - All values are in VND (not cents)
    // Note: Database columns are named *_cents but actually store VND values
    // This is a legacy naming issue - the values are already in VND format
    
    const orderTotal = orderData.total_cents || 0; // Already in VND
    const shippingFee = orderData.shipping_fee_cents || 0; // Already in VND
    const discount = orderData.discount_cents || 0; // Already in VND
    
    // Get items and calculate subtotal from items (all in VND)
    const items = orderData.items || [];
    const calculatedSubtotal = items.reduce((sum, item) => {
      return sum + (item.subtotal_cents || 0); // Already in VND
    }, 0);
    
    // Use calculated subtotal from items
    const subtotal = calculatedSubtotal;
    
    // Use orderTotal from database as it's the source of truth
    const finalTotal = orderTotal;
    
    const paymentMethod = orderData.payment_method || 'COD';
    const paymentStatus = orderData.payment_status || 'PENDING';
    const orderStatus = orderData.status || 'PENDING';
    
    // Format payment method name
    const paymentMethodName = paymentMethod === 'VNPAY' ? 'VNPay' : 
                              paymentMethod === 'COD' ? 'Thanh toán khi nhận hàng (COD)' : 
                              paymentMethod;
    
    // Format order status
    const statusMap = {
      'PENDING': 'Đang chờ xử lý',
      'CONFIRMED': 'Đã xác nhận',
      'SHIPPING': 'Đang giao hàng',
      'DELIVERED': 'Đã giao hàng',
      'CANCELLED': 'Đã hủy'
    };
    const statusName = statusMap[orderStatus] || orderStatus;
    
    // Format date
    const orderDate = orderData.created_at ? new Date(orderData.created_at).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }) : new Date().toLocaleString('vi-VN');
    
    // Build items HTML (all values are already in VND)
    const itemsHtml = items.map(item => {
      const itemPrice = (item.price_cents || 0).toLocaleString('vi-VN'); // Already in VND
      const itemSubtotal = (item.subtotal_cents || 0).toLocaleString('vi-VN'); // Already in VND
      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px; text-align: left;">
            <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">${item.product_name || 'Sản phẩm'}</div>
            <div style="font-size: 13px; color: #64748b;">Số lượng: ${item.quantity}</div>
          </td>
          <td style="padding: 12px; text-align: right; color: #475569;">${itemPrice}₫</td>
          <td style="padding: 12px; text-align: right; font-weight: 600; color: #1e293b;">${itemSubtotal}₫</td>
        </tr>
      `;
    }).join('');

    // Send email
    await transporter.sendMail({
      from: `"GearUp - Laptop Store" <${process.env.SMTP_USER || 'noreply@gearup.vn'}>`,
      to: email,
      subject: `✅ Đơn hàng #${orderId} - ${statusName}`,
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
              max-width: 650px; 
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
            .status-badge {
              display: inline-block;
              padding: 8px 16px;
              border-radius: 20px;
              font-size: 14px;
              font-weight: 600;
              margin-bottom: 24px;
              background: ${orderStatus === 'CONFIRMED' ? '#d1fae5' : orderStatus === 'PENDING' ? '#fef3c7' : '#fee2e2'};
              color: ${orderStatus === 'CONFIRMED' ? '#065f46' : orderStatus === 'PENDING' ? '#92400e' : '#991b1b'};
            }
            .order-info {
              background: #f7fafc;
              border-radius: 8px;
              padding: 20px;
              margin: 24px 0;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #e2e8f0;
            }
            .info-row:last-child { border-bottom: none; }
            .info-label { 
              color: #718096; 
              font-size: 14px;
              font-weight: 500;
            }
            .info-value { 
              color: #2d3748; 
              font-size: 14px;
              font-weight: 600;
              text-align: right;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 24px 0;
              background: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            .items-table thead {
              background: #f7fafc;
            }
            .items-table th {
              padding: 12px;
              text-align: left;
              font-weight: 600;
              color: #475569;
              font-size: 13px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .items-table th:last-child {
              text-align: right;
            }
            .total-section {
              background: #f7fafc;
              border-radius: 8px;
              padding: 20px;
              margin: 24px 0;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              font-size: 14px;
            }
            .total-row.final {
              border-top: 2px solid #cbd5e1;
              margin-top: 12px;
              padding-top: 12px;
              font-size: 18px;
              font-weight: 700;
              color: #1e293b;
            }
            .shipping-info {
              background: #f0f9ff;
              border-left: 4px solid #3b82f6;
              border-radius: 6px;
              padding: 18px 20px;
              margin: 24px 0;
            }
            .shipping-info h3 {
              color: #1e40af;
              font-size: 15px;
              font-weight: 600;
              margin-bottom: 12px;
            }
            .shipping-info p {
              color: #1e40af;
              font-size: 14px;
              line-height: 1.8;
              margin: 4px 0;
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
            .cta-button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 14px 28px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 600;
              margin: 24px 0;
            }
            @media only screen and (max-width: 600px) {
              body { padding: 0; }
              .email-wrapper { border-radius: 0; }
              .header { padding: 28px 20px; }
              .content { padding: 28px 20px; }
              .info-row { flex-direction: column; }
              .info-value { text-align: left; margin-top: 4px; }
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="header">
              <h1>🎉 Đơn hàng của bạn</h1>
              <p>Cảm ơn bạn đã đặt hàng tại GearUp</p>
            </div>
            
            <div class="content">
              <div class="greeting">
                Xin chào <strong>${orderData.shipping_name || 'bạn'}</strong>,
              </div>
              
              <div class="status-badge">
                ${statusName}
              </div>
              
              <p style="color: #4a5568; line-height: 1.7; margin-bottom: 24px;">
                Cảm ơn bạn đã đặt hàng tại <strong style="color: #667eea;">GearUp</strong>. 
                Chúng tôi đã nhận được đơn hàng của bạn và đang xử lý. Dưới đây là thông tin chi tiết đơn hàng:
              </p>
              
              <div class="order-info">
                <div class="info-row">
                  <span class="info-label">Mã đơn hàng</span>
                  <span class="info-value">#${orderId}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Ngày đặt hàng</span>
                  <span class="info-value">${orderDate}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Phương thức thanh toán</span>
                  <span class="info-value">${paymentMethodName}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Trạng thái thanh toán</span>
                  <span class="info-value">${paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</span>
                </div>
              </div>

              <h3 style="color: #1e293b; font-size: 16px; margin: 28px 0 16px 0;">📦 Sản phẩm đã đặt:</h3>
              
              <table class="items-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th style="text-align: right;">Đơn giá</th>
                    <th style="text-align: right;">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <div class="total-section">
                <div class="total-row">
                  <span>Tạm tính:</span>
                  <span>${subtotal.toLocaleString('vi-VN')}₫</span>
                </div>
                ${discount > 0 ? `
                <div class="total-row" style="color: #059669;">
                  <span>Giảm giá:</span>
                  <span>-${discount.toLocaleString('vi-VN')}₫</span>
                </div>
                ` : ''}
                ${shippingFee > 0 ? `
                <div class="total-row">
                  <span>Phí vận chuyển:</span>
                  <span>${shippingFee.toLocaleString('vi-VN')}₫</span>
                </div>
                ` : discount > 0 && shippingFee === 0 ? `
                <div class="total-row" style="color: #059669;">
                  <span>Phí vận chuyển:</span>
                  <span>Miễn phí (đã áp dụng mã giảm giá)</span>
                </div>
                ` : ''}
                <div class="total-row final">
                  <span>Tổng cộng:</span>
                  <span>${finalTotal.toLocaleString('vi-VN')}₫</span>
                </div>
              </div>

              <div class="shipping-info">
                <h3>📍 Địa chỉ giao hàng:</h3>
                <p><strong>${orderData.shipping_name || ''}</strong></p>
                <p>📞 ${orderData.shipping_phone || ''}</p>
                <p>✉️ ${orderData.shipping_email || ''}</p>
                <p>${[orderData.shipping_address, orderData.shipping_ward, orderData.shipping_district, orderData.shipping_province].filter(Boolean).join(', ')}</p>
              </div>

              ${orderStatus === 'PENDING' && paymentMethod === 'COD' ? `
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 18px 20px; margin: 24px 0;">
                <p style="color: #92400e; margin: 0; font-size: 14px;">
                  <strong>⚠️ Lưu ý:</strong> Đơn hàng của bạn sẽ được xác nhận sau khi bạn nhập mã OTP. 
                  Vui lòng kiểm tra email để nhận mã OTP xác nhận đơn hàng.
                </p>
              </div>
              ` : ''}

              <div style="text-align: center; margin: 32px 0;">
                <a href="${FRONTEND_URL}/orders/${orderId}" class="cta-button">
                  Xem chi tiết đơn hàng
                </a>
              </div>

              <div style="background: #f7fafc; border-radius: 8px; padding: 18px 20px; margin: 24px 0;">
                <p style="color: #475569; font-size: 13px; line-height: 1.7; margin: 0;">
                  <strong>💡 Mẹo:</strong> Bạn có thể theo dõi trạng thái đơn hàng bất cứ lúc nào bằng cách đăng nhập vào tài khoản của mình hoặc sử dụng mã đơn hàng #${orderId}.
                </p>
              </div>
            </div>
            
            <div class="footer">
              <p><strong>GearUp - Laptop Store</strong></p>
              <p>Email này được gửi tự động, vui lòng không trả lời</p>
              <p style="margin-top: 8px;">© 2025 GearUp. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    return res.json({ ok: true, message: 'Order confirmation email sent' });
  } catch (e) {
    console.error('Send order confirmation email error:', e);
    return res.status(500).json({ error: 'Failed to send email' });
  }
});

// ============================================
// LOYALTY POINTS ENDPOINTS
// ============================================

// Add loyalty points (called by order-service after order confirmation)
app.post('/auth/add-loyalty-points', async (req, res) => {
  try {
    const { userId, orderId, points, description } = req.body;
    
    if (!userId || !points || points <= 0) {
      return res.status(400).json({ error: 'Invalid request: userId and positive points required' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Get current points
      const [[user]] = await conn.query('SELECT loyalty_points FROM users WHERE id = ?', [userId]);
      if (!user) {
        await conn.rollback();
        return res.status(404).json({ error: 'User not found' });
      }

      const newPoints = (user.loyalty_points || 0) + points;

      // Update user points
      await conn.query(
        'UPDATE users SET loyalty_points = ? WHERE id = ?',
        [newPoints, userId]
      );

      // Record in history
      await conn.query(
        'INSERT INTO loyalty_points_history (user_id, order_id, points, type, description) VALUES (?, ?, ?, ?, ?)',
        [userId, orderId || null, points, 'EARNED', description || `Tích lũy từ đơn hàng #${orderId || 'N/A'}`]
      );

      await conn.commit();
      return res.json({ 
        ok: true, 
        points: newPoints,
        pointsAdded: points
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('Add loyalty points error:', e);
    return res.status(500).json({ error: 'Failed to add loyalty points' });
  }
});

// Get user loyalty points
app.get('/auth/loyalty-points', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [[user]] = await pool.query(
      'SELECT loyalty_points FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ 
      points: user.loyalty_points || 0,
      // 1 point = 1,000 VND
      pointsValue: (user.loyalty_points || 0) * 1000
    });
  } catch (e) {
    console.error('Get loyalty points error:', e);
    return res.status(500).json({ error: 'Failed to get loyalty points' });
  }
});

// Use loyalty points (deduct points and return discount amount)
app.post('/auth/use-loyalty-points', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { pointsToUse, orderId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!pointsToUse || pointsToUse <= 0) {
      return res.status(400).json({ error: 'Invalid points amount' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Get current points
      const [[user]] = await conn.query(
        'SELECT loyalty_points FROM users WHERE id = ? FOR UPDATE',
        [userId]
      );

      if (!user) {
        await conn.rollback();
        return res.status(404).json({ error: 'User not found' });
      }

      const currentPoints = user.loyalty_points || 0;

      if (currentPoints < pointsToUse) {
        await conn.rollback();
        return res.status(400).json({ 
          error: 'Insufficient points',
          available: currentPoints,
          requested: pointsToUse
        });
      }

      const newPoints = currentPoints - pointsToUse;
      // 1 point = 1,000 VND discount
      const discountAmount = pointsToUse * 1000;

      // Update user points
      await conn.query(
        'UPDATE users SET loyalty_points = ? WHERE id = ?',
        [newPoints, userId]
      );

      // Record in history
      await conn.query(
        'INSERT INTO loyalty_points_history (user_id, order_id, points, type, description) VALUES (?, ?, ?, ?, ?)',
        [userId, orderId || null, -pointsToUse, 'USED', `Sử dụng ${pointsToUse} điểm cho đơn hàng #${orderId || 'N/A'}`]
      );

      await conn.commit();
      return res.json({ 
        ok: true,
        pointsUsed: pointsToUse,
        remainingPoints: newPoints,
        discountAmount: discountAmount // In VND
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('Use loyalty points error:', e);
    return res.status(500).json({ error: 'Failed to use loyalty points' });
  }
});

// Get loyalty points history
app.get('/auth/loyalty-points/history', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [history] = await pool.query(
      'SELECT * FROM loyalty_points_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );

    return res.json({ history });
  } catch (e) {
    console.error('Get loyalty points history error:', e);
    return res.status(500).json({ error: 'Failed to get history' });
  }
});

// Update orderId in loyalty points history (called by order-service after order creation)
app.post('/auth/update-points-history-order', async (req, res) => {
  try {
    const { userId, orderId } = req.body;
    
    if (!userId || !orderId) {
      return res.status(400).json({ error: 'userId and orderId required' });
    }

    // Update the most recent USED entry for this user that doesn't have an orderId yet
    const [result] = await pool.query(
      `UPDATE loyalty_points_history 
       SET order_id = ? 
       WHERE user_id = ? AND type = 'USED' AND order_id IS NULL 
       ORDER BY created_at DESC LIMIT 1`,
      [orderId, userId]
    );

    return res.json({ ok: true, updated: result.affectedRows > 0 });
  } catch (e) {
    console.error('Update points history orderId error:', e);
    return res.status(500).json({ error: 'Failed to update orderId' });
  }
});

// Google OAuth routes
app.get('/auth/google',
  passport.authenticate('google', { 
    session: false,
    scope: ['profile', 'email'] 
  })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed` 
  }),
  (req, res) => {
    try {
      // Tạo JWT token với format giống login thường
      const token = jwt.sign(
        { sub: req.user.id, email: req.user.email, role: req.user.role || 'USER' },
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

// Facebook OAuth routes
app.get('/auth/facebook',
  passport.authenticate('facebook', { 
    session: false,
    scope: ['public_profile'] 
  })
);

app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { 
    session: false,
    failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed` 
  }),
  (req, res) => {
    try {
      // Tạo JWT token với format giống login thường và Google OAuth
      const token = jwt.sign(
        { sub: req.user.id, email: req.user.email, role: req.user.role || 'USER' },
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