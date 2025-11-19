import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import FormData from 'form-data';
import multer from 'multer';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Multer for handling file uploads
const upload = multer();

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

const services = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  catalog: process.env.CATALOG_SERVICE_URL || 'http://localhost:3002',
  cart: process.env.CART_SERVICE_URL || 'http://localhost:3003',
  order: process.env.ORDER_SERVICE_URL || 'http://localhost:3004',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005',
};

function authMiddleware(req, res, next) {
  const publicPaths = [
    { method: 'POST', path: /^\/auth\/signup$/ },
    { method: 'POST', path: /^\/auth\/login$/ },
    { method: 'POST', path: /^\/auth\/guest$/ },
    { method: 'POST', path: /^\/auth\/forgot-password$/ },
    { method: 'POST', path: /^\/auth\/reset-password$/ },
    { method: 'GET', path: /^\/auth\/verify-reset-token/ },
    { method: 'GET', path: /^\/auth\/google/ },
    { method: 'GET', path: /^\/auth\/facebook/ },
    { method: 'GET', path: /^\/catalog\// },
    { method: 'GET', path: /^\/uploads\// },
  ];
  const isPublic = publicPaths.some(
    (r) => r.method === req.method && r.path.test(req.path)
  );
  if (isPublic) return next();

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, role: payload.role || 'USER' };
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.use(authMiddleware);

// Admin guard
app.use((req, res, next) => {
  if (req.path.startsWith('/admin')) {
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin only' });
    }
  }
  return next();
});

// Proxy helper for multipart/form-data (file uploads)
async function proxyMultipart(req, res, baseUrl) {
  try {
    const url = baseUrl + req.originalUrl;
    const formData = new FormData();
    
    // Add file if present
    if (req.file) {
      formData.append('image', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });
    }
    
    // Add other fields
    Object.keys(req.body || {}).forEach(key => {
      formData.append(key, req.body[key]);
    });
    
    const headers = {
      ...formData.getHeaders(),
      'x-user-id': req.user ? String(req.user.id) : undefined,
      'x-user-role': req.user ? String(req.user.role) : undefined,
    };
    
    const response = await axios({
      url,
      method: req.method,
      headers,
      data: formData,
      validateStatus: () => true,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    
    res.status(response.status).json(response.data);
  } catch (err) {
    console.error('Proxy multipart error:', err);
    res.status(502).json({ error: 'Upload failed' });
  }
}

// Proxy helper
async function proxy(req, res, baseUrl) {
  try {
    const url = baseUrl + req.originalUrl;
    const headers = { ...req.headers };
    delete headers.host;
    // Inject user id for downstream services if authenticated
    if (req.user && req.user.id) {
      headers['x-user-id'] = String(req.user.id);
    }
    if (req.user && req.user.role) {
      headers['x-user-role'] = String(req.user.role);
    }
    const response = await axios({
      url,
      method: req.method,
      headers,
      data: req.body,
      // Use arraybuffer to support both JSON and binary (images) transparently
      responseType: 'arraybuffer',
      validateStatus: () => true,
      maxRedirects: 0, // Don't follow redirects automatically
    });
    
    // Handle redirects manually - pass them through to the client
    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      return res.redirect(response.status, response.headers.location);
    }
    
    res.status(response.status).set(response.headers).send(response.data);
  } catch (err) {
    // Handle redirect errors from axios
    if (err.response && err.response.status >= 300 && err.response.status < 400) {
      return res.redirect(err.response.status, err.response.headers.location);
    }
    res.status(502).json({ error: 'Upstream error' });
  }
}

// File upload endpoint
app.post('/admin/catalog/upload', upload.single('image'), (req, res) => proxyMultipart(req, res, services.catalog));

// Static file serving (for uploaded images)
app.use('/uploads', (req, res) => proxy(req, res, services.catalog));

app.use('/auth', (req, res) => proxy(req, res, services.auth));
app.use('/catalog', (req, res) => proxy(req, res, services.catalog));
app.use('/cart', (req, res) => proxy(req, res, services.cart));
app.use('/orders', (req, res) => proxy(req, res, services.order));
app.use('/payment', (req, res) => proxy(req, res, services.payment));

// Admin routed proxies
app.use('/admin/catalog', (req, res) => proxy(req, res, services.catalog));
app.use('/admin/orders', (req, res) => proxy(req, res, services.order));
app.use('/admin/users', (req, res) => proxy(req, res, services.auth));

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API Gateway listening on ${PORT}`);
});


