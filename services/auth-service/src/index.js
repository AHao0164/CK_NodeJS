import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());
app.use(passport.initialize());
app.use(morgan('dev'));

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8080/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
const FACEBOOK_CALLBACK_URL = process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:8080/auth/facebook/callback';

const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587');
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER;

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

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpw',
  database: process.env.DB_DATABASE || 'auth_db',
  waitForConnections: true,
  connectionLimit: 10,
});

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
    await ensureBannedColumn();
  } catch (err) {
    console.error('Failed to initialize service:', err);
    process.exit(1);
  }
}

initializeService();

app.post('/auth/signup', async (req, res) => {
  const { email, password, fullName, defaultAddress, defaultCity, defaultDistrict, defaultWard, defaultPhone } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Missing required fields: email, password, fullName' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      `INSERT INTO users (email, password_hash, full_name, default_address, default_city, default_district, default_ward, default_phone) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, passwordHash, fullName, defaultAddress || null, defaultCity || null, defaultDistrict || null, defaultWard || null, defaultPhone || null]
    );
    const userId = result.insertId;
    const token = jwt.sign({ sub: userId, email, role: 'USER' }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({ token });
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email đã tồn tại' });
    }
    return res.status(500).json({ error: 'Lỗi server' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const adminEmail = process.env.ADMIN_SEED_EMAIL;
    const roleClaim = user.role || (adminEmail && user.email === adminEmail ? 'ADMIN' : 'USER');
    const token = jwt.sign({ sub: user.id, email: user.email, role: roleClaim }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Guest user creation/retrieval for checkout
app.post('/auth/guest', async (req, res) => {
  const { email, fullName } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  
  try {
    // Check if user already exists
    const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (rows[0]) {
      // User exists, return their ID
      return res.json({ userId: rows[0].id, existing: true });
    }
    
    // Create new guest user with a random password (they can reset it later)
    const randomPassword = Math.random().toString(36).slice(-12);
    const passwordHash = await bcrypt.hash(randomPassword, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)',
      [email, passwordHash, fullName || 'Guest User']
    );
    return res.status(201).json({ userId: result.insertId, existing: false });
  } catch (e) {
    console.error('Guest user creation error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Check if email exists (for guest checkout)
app.get('/auth/check-email', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  
  try {
    const [rows] = await pool.execute('SELECT id, email, full_name FROM users WHERE email = ?', [email]);
    if (rows[0]) {
      return res.json({ exists: true, userId: rows[0].id, email: rows[0].email, fullName: rows[0].full_name });
    }
    return res.json({ exists: false });
  } catch (e) {
    console.error('Check email error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const [rows] = await pool.execute(
      'SELECT id, email, full_name, default_address, default_city, default_district, default_ward, default_phone FROM users WHERE id = ?', 
      [payload.sub]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'Not found' });
    const adminEmail = process.env.ADMIN_SEED_EMAIL;
    const role = payload.role || (adminEmail && user.email === adminEmail ? 'ADMIN' : 'USER');
    return res.json({ 
      id: user.id, 
      email: user.email, 
      fullName: user.full_name, 
      role,
      defaultAddress: user.default_address,
      defaultCity: user.default_city,
      defaultDistrict: user.default_district,
      defaultWard: user.default_ward,
      defaultPhone: user.default_phone
    });
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Update profile (full name and default address)
app.patch('/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  const { fullName, defaultAddress, defaultCity, defaultDistrict, defaultWard, defaultPhone } = req.body || {};
  
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    
    // Build update query dynamically based on provided fields
    const updates = [];
    const params = [];
    
    if (fullName) {
      updates.push('full_name = ?');
      params.push(fullName);
    }
    if (defaultAddress !== undefined) {
      updates.push('default_address = ?');
      params.push(defaultAddress);
    }
    if (defaultCity !== undefined) {
      updates.push('default_city = ?');
      params.push(defaultCity);
    }
    if (defaultDistrict !== undefined) {
      updates.push('default_district = ?');
      params.push(defaultDistrict);
    }
    if (defaultWard !== undefined) {
      updates.push('default_ward = ?');
      params.push(defaultWard);
    }
    if (defaultPhone !== undefined) {
      updates.push('default_phone = ?');
      params.push(defaultPhone);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    params.push(payload.sub);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Get all user addresses
app.get('/auth/addresses', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const [rows] = await pool.query(
      'SELECT id, label, recipient_name, phone, address, city, district, ward, is_default, created_at FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [payload.sub]
    );
    return res.json({ addresses: rows });
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Add new address
app.post('/auth/addresses', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  
  const { label, recipientName, phone, address, city, district, ward, isDefault } = req.body;
  if (!recipientName || !phone || !address || !city) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
  }
  
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const conn = await pool.getConnection();
    
    try {
      await conn.beginTransaction();
      
      // If setting as default, unset other defaults
      if (isDefault) {
        await conn.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [payload.sub]);
      }
      
      const [result] = await conn.query(
        'INSERT INTO user_addresses (user_id, label, recipient_name, phone, address, city, district, ward, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [payload.sub, label || null, recipientName, phone, address, city, district || null, ward || null, isDefault ? 1 : 0]
      );
      
      await conn.commit();
      return res.status(201).json({ id: result.insertId, ok: true });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Update address
app.patch('/auth/addresses/:id', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  
  const { id } = req.params;
  const { label, recipientName, phone, address, city, district, ward, isDefault } = req.body;
  
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const conn = await pool.getConnection();
    
    try {
      await conn.beginTransaction();
      
      // Verify address belongs to user
      const [[existing]] = await conn.query('SELECT id FROM user_addresses WHERE id = ? AND user_id = ?', [id, payload.sub]);
      if (!existing) {
        await conn.rollback();
        return res.status(404).json({ error: 'Không tìm thấy địa chỉ' });
      }
      
      // If setting as default, unset other defaults
      if (isDefault) {
        await conn.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [payload.sub]);
      }
      
      const updates = [];
      const params = [];
      
      if (label !== undefined) { updates.push('label = ?'); params.push(label); }
      if (recipientName) { updates.push('recipient_name = ?'); params.push(recipientName); }
      if (phone) { updates.push('phone = ?'); params.push(phone); }
      if (address) { updates.push('address = ?'); params.push(address); }
      if (city) { updates.push('city = ?'); params.push(city); }
      if (district !== undefined) { updates.push('district = ?'); params.push(district); }
      if (ward !== undefined) { updates.push('ward = ?'); params.push(ward); }
      if (isDefault !== undefined) { updates.push('is_default = ?'); params.push(isDefault ? 1 : 0); }
      
      if (updates.length > 0) {
        params.push(id, payload.sub);
        await conn.query(`UPDATE user_addresses SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);
      }
      
      await conn.commit();
      return res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Delete address
app.delete('/auth/addresses/:id', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  
  const { id } = req.params;
  
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    await pool.query('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [id, payload.sub]);
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

// Ensure banned column exists
async function ensureBannedColumn() {
  const conn = await pool.getConnection();
  try {
    // Check if column exists
    const [[row]] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'banned'`
    );
    if (!row || row.cnt === 0) {
      await conn.query('ALTER TABLE users ADD COLUMN banned TINYINT(1) NOT NULL DEFAULT 0');
    }
  } catch (e) {
    console.error('ensureBannedColumn error:', e);
    // Column might already exist or other error
  } finally {
    conn.release();
  }
}

app.get('/admin/users', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    // Try to select banned column, if it doesn't exist, use COALESCE to default to 0
    try {
      const [rows] = await pool.query('SELECT id, email, full_name, role, COALESCE(banned, 0) as banned, created_at FROM users ORDER BY id DESC LIMIT ?', [limit]);
      return res.json(rows);
    } catch (e) {
      // If banned column doesn't exist, select without it
      if (e.code === 'ER_BAD_FIELD_ERROR') {
        await ensureBannedColumn();
        const [rows] = await pool.query('SELECT id, email, full_name, role, COALESCE(banned, 0) as banned, created_at FROM users ORDER BY id DESC LIMIT ?', [limit]);
        return res.json(rows);
      }
      throw e;
    }
  } catch (e) {
    console.error('Get users error:', e);
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Admin: Update user (ban/unban, update info)
app.patch('/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { banned, full_name, email } = req.body;
    
    const updates = [];
    const params = [];
    
    if (banned !== undefined) {
      // Ensure column exists before updating
      try {
        await ensureBannedColumn();
      } catch (e) {
        console.error('Failed to ensure banned column:', e);
      }
      updates.push('banned = ?');
      params.push(banned ? 1 : 0);
    }
    if (full_name) {
      updates.push('full_name = ?');
      params.push(full_name);
    }
    if (email) {
      updates.push('email = ?');
      params.push(email);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    params.push(id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    return res.json({ ok: true });
  } catch (e) {
    console.error('Update user error:', e);
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Admin: Get user statistics for dashboard
app.get('/admin/dashboard/users', async (req, res) => {
  try {
    const [totalUsers] = await pool.query('SELECT COUNT(*) as count FROM users');
    const [newUsers] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) 
      AND YEAR(created_at) = YEAR(CURRENT_DATE())
    `);
    
    // Try to get banned users count, default to 0 if column doesn't exist
    let bannedUsersCount = 0;
    try {
      const [bannedUsers] = await pool.query('SELECT COUNT(*) as count FROM users WHERE banned = 1');
      bannedUsersCount = bannedUsers[0]?.count || 0;
    } catch (e) {
      if (e.code === 'ER_BAD_FIELD_ERROR') {
        await ensureBannedColumn();
        const [bannedUsers] = await pool.query('SELECT COUNT(*) as count FROM users WHERE banned = 1');
        bannedUsersCount = bannedUsers[0]?.count || 0;
      } else {
        throw e;
      }
    }
    
    return res.json({
      totalUsers: totalUsers[0]?.count || 0,
      newUsers: newUsers[0]?.count || 0,
      bannedUsers: bannedUsersCount
    });
  } catch (e) {
    console.error('Get user stats error:', e);
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

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

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Auth service listening on ${PORT}`);
});


