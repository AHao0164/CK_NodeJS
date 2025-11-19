import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

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

app.get('/admin/users', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
  const [rows] = await pool.query('SELECT id, email, full_name, role, created_at FROM users ORDER BY id DESC LIMIT ?', [limit]);
  return res.json(rows);
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Auth service listening on ${PORT}`);
});


