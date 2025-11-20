import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import mysql from 'mysql2/promise';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 3003;
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpw',
  database: process.env.DB_DATABASE || 'cart_db',
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

// Initialize database connection
async function initializeService() {
  try {
    await waitForDatabase();
  } catch (err) {
    console.error('Failed to initialize service:', err);
    process.exit(1);
  }
}

initializeService();

function getUserId(req) {
  const hdr = req.headers['x-user-id'];
  if (hdr) return parseInt(hdr, 10);
  return null;
}

function getSessionId(req) {
  // For guest users, use session ID from header or generate one
  return req.headers['x-session-id'] || null;
}

app.get('/cart', async (req, res) => {
  const userId = getUserId(req);
  const sessionId = getSessionId(req);
  
  if (!userId && !sessionId) {
    return res.json({ id: null, items: [] }); // Empty cart for guest without session
  }
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let [[cart]] = userId 
      ? await conn.query('SELECT * FROM carts WHERE user_id = ?', [userId])
      : await conn.query('SELECT * FROM carts WHERE session_id = ? AND user_id IS NULL', [sessionId]);
    
    if (!cart) {
      if (userId) {
        const [result] = await conn.query('INSERT INTO carts (user_id) VALUES (?)', [userId]);
        [[cart]] = await conn.query('SELECT * FROM carts WHERE id = ?', [result.insertId]);
      } else if (sessionId) {
        const [result] = await conn.query('INSERT INTO carts (session_id) VALUES (?)', [sessionId]);
        [[cart]] = await conn.query('SELECT * FROM carts WHERE id = ?', [result.insertId]);
      }
    }
    const [items] = cart ? await conn.query('SELECT * FROM cart_items WHERE cart_id = ?', [cart.id]) : [[]];
    await conn.commit();
    return res.json({ id: cart?.id || null, items });
  } catch (e) {
    await conn.rollback();
    return res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

app.post('/cart/items', async (req, res) => {
  const userId = getUserId(req);
  const sessionId = getSessionId(req);
  
  if (!userId && !sessionId) {
    return res.status(400).json({ error: 'Missing user ID or session ID' });
  }
  
  const { productId, quantity, priceCents } = req.body;
  if (!productId || !quantity || !priceCents) return res.status(400).json({ error: 'Missing fields' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let [[cart]] = userId
      ? await conn.query('SELECT * FROM carts WHERE user_id = ?', [userId])
      : await conn.query('SELECT * FROM carts WHERE session_id = ? AND user_id IS NULL', [sessionId]);
    
    if (!cart) {
      if (userId) {
        const [result] = await conn.query('INSERT INTO carts (user_id) VALUES (?)', [userId]);
        [[cart]] = await conn.query('SELECT * FROM carts WHERE id = ?', [result.insertId]);
      } else if (sessionId) {
        const [result] = await conn.query('INSERT INTO carts (session_id) VALUES (?)', [sessionId]);
        [[cart]] = await conn.query('SELECT * FROM carts WHERE id = ?', [result.insertId]);
      }
    }
    await conn.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity, price_cents_snapshot)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), price_cents_snapshot = VALUES(price_cents_snapshot)`,
      [cart.id, productId, quantity, priceCents]
    );
    await conn.commit();
    return res.status(201).json({ ok: true });
  } catch (e) {
    await conn.rollback();
    return res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

app.patch('/cart/items/:itemId', async (req, res) => {
  const userId = getUserId(req);
  const sessionId = getSessionId(req);
  const { itemId } = req.params;
  const { quantity } = req.body;
  if (!quantity || quantity < 1) return res.status(400).json({ error: 'Invalid quantity' });
  try {
    if (userId) {
      await pool.query(
        `UPDATE cart_items ci
         JOIN carts c ON c.id = ci.cart_id
         SET ci.quantity = ?
         WHERE ci.id = ? AND c.user_id = ?`,
        [quantity, itemId, userId]
      );
    } else if (sessionId) {
      await pool.query(
        `UPDATE cart_items ci
         JOIN carts c ON c.id = ci.cart_id
         SET ci.quantity = ?
         WHERE ci.id = ? AND c.session_id = ? AND c.user_id IS NULL`,
        [quantity, itemId, sessionId]
      );
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/cart/items/:itemId', async (req, res) => {
  const userId = getUserId(req);
  const sessionId = getSessionId(req);
  const { itemId } = req.params;
  try {
    if (userId) {
      await pool.query(
        `DELETE ci FROM cart_items ci
         JOIN carts c ON c.id = ci.cart_id
         WHERE ci.id = ? AND c.user_id = ?`,
        [itemId, userId]
      );
    } else if (sessionId) {
      await pool.query(
        `DELETE ci FROM cart_items ci
         JOIN carts c ON c.id = ci.cart_id
         WHERE ci.id = ? AND c.session_id = ? AND c.user_id IS NULL`,
        [itemId, sessionId]
      );
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Cart service listening on ${PORT}`);
});


