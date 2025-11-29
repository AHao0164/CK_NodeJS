import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import FormData from 'form-data';
import multer from 'multer';

const app = express();
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: true
}));
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
    { method: 'POST', path: /^\/auth\/ensure-guest$/ },
    { method: 'POST', path: /^\/auth\/send-otp$/ },
    { method: 'POST', path: /^\/auth\/verify-otp$/ },
    { method: 'POST', path: /^\/auth\/resend-otp$/ },
    { method: 'POST', path: /^\/auth\/forgot-password$/ },
    { method: 'POST', path: /^\/auth\/reset-password$/ },
    { method: 'POST', path: /^\/auth\/verify-reset-otp$/ },
    { method: 'GET', path: /^\/auth\/verify-reset-token/ },
    { method: 'GET', path: /^\/auth\/google/ },
    { method: 'GET', path: /^\/auth\/facebook/ },
    { method: 'GET', path: /^\/auth\/terms-conditions$/ },
    { method: 'GET', path: /^\/auth\/privacy-policy$/ },
    { method: 'GET', path: /^\/health$/ },
    { method: 'GET', path: /^\/catalog\// },
    { method: 'GET', path: /^\/uploads\// },
    // Guest cart operations - không yêu cầu đăng nhập
    { method: 'POST', path: /^\/catalog\/guest-cart$/ },
    // Guest checkout - không yêu cầu đăng nhập
    { method: 'POST', path: /^\/auth\/guest-signup-and-checkout$/ },
    // VNPay callback không gửi JWT, cần cho phép public
    { method: 'GET', path: /^\/payment\/vnpay\/return/ },
    // Guest checkout + VNPay creation không yêu cầu đăng nhập
    { method: 'POST', path: /^\/orders\/checkout$/ },
    { method: 'POST', path: /^\/payment\/vnpay\/create$/ },
  ];
  
  // Protected paths that require authentication (but not admin)
  const protectedPaths = [
    { method: 'POST', path: /^\/catalog\/products\/\d+\/reviews$/ },
    { method: 'POST', path: /^\/catalog\/reviews\/\d+\/comments$/ },
    { method: 'GET', path: /^\/catalog\/products\/reviews\/user\/\d+$/ }
  ];
  
  // Known API paths that should be handled by services
  const knownApiPaths = [
    /^\/auth\//,
    /^\/catalog\//,
    /^\/cart(\/|$)/,  // Match /cart or /cart/
    /^\/orders(\/|$)/, // Match /orders or /orders/...
    /^\/payment\//,
    /^\/admin\//,
    /^\/uploads\//,
    /^\/health$/
  ];
  
  // Facebook SDK paths - ignore these requests (return 200 to avoid console errors)
  const facebookSdkPaths = [
    /^\/data\/manifest/,
    /^\/ajax\/bz/,
    /^\/ajax\/webstorage/,
    /^\/\.well-known\//
  ];
  
  // Check if this is a Facebook SDK request
  const isFacebookSdkRequest = facebookSdkPaths.some(pattern => pattern.test(req.path));
  if (isFacebookSdkRequest) {
    // Return 200 OK to avoid console errors, but don't process
    return res.status(200).json({});
  }
  
  const isPublic = publicPaths.some(
    (r) => r.method === req.method && r.path.test(req.path)
  );
  if (isPublic) return next();
  
  const isProtected = protectedPaths.some(
    (r) => r.method === req.method && r.path.test(req.path)
  );
  
  // Check if this is a known API path
  const isKnownApiPath = knownApiPaths.some(pattern => pattern.test(req.path));
  
  // For protected or other authenticated paths (cart requires auth but is handled by cart-service)
  if (isProtected || (isKnownApiPath && !isPublic)) {
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
  
  // For unknown paths (like Facebook SDK requests), return 404 instead of 401
  if (!isKnownApiPath) {
    return res.status(404).json({ error: 'Not Found', message: 'Endpoint không tồn tại' });
  }
  
  return next();
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
      timeout: 60000, // 60 seconds timeout for uploads
    });
    
    res.status(response.status).json(response.data);
  } catch (err) {
    console.error('Proxy multipart error:', err);
    res.status(502).json({ 
      error: 'UPLOAD_FAILED',
      message: 'Tải lên hình ảnh thất bại. Vui lòng thử lại.'
    });
  }
}

// Get user-friendly service name
function getServiceName(baseUrl) {
  if (baseUrl.includes(':3001')) return 'Xác thực';
  if (baseUrl.includes(':3002')) return 'Sản phẩm';
  if (baseUrl.includes(':3003')) return 'Giỏ hàng';
  if (baseUrl.includes(':3004')) return 'Đơn hàng';
  if (baseUrl.includes(':3005')) return 'Thanh toán';
  return 'Hệ thống';
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
    
    // Use axios with maxRedirects: 0 to handle redirects manually (like gateway1)
    const axiosConfig = {
      url,
      method: req.method,
      headers,
      data: req.body,
      // Use arraybuffer to support both JSON and binary (images) transparently
      responseType: 'arraybuffer',
      validateStatus: () => true,
      maxRedirects: 0, // Don't follow redirects automatically
    };
    
    try {
      const response = await axios(axiosConfig);
      
      // Handle redirects manually - pass them through to the client (like gateway1)
      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        return res.redirect(response.status, response.headers.location);
      }
      
      res.status(response.status).set(response.headers).send(response.data);
    } catch (err) {
      // Handle redirect errors from axios (like gateway1)
      if (err.response && err.response.status >= 300 && err.response.status < 400) {
        return res.redirect(err.response.status, err.response.headers.location);
      }
      throw err; // Re-throw to be handled by outer catch
    }
  } catch (err) {
    console.error(`Gateway proxy error [${baseUrl}]:`, err.message);
    const serviceName = getServiceName(baseUrl);
    
    // Return user-friendly Vietnamese error messages
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        error: 'SERVICE_UNAVAILABLE',
        message: `Dịch vụ ${serviceName} tạm thời không khả dụng. Vui lòng thử lại sau.`,
        serviceName
      });
    }
    
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
      return res.status(504).json({ 
        error: 'GATEWAY_TIMEOUT',
        message: `Dịch vụ ${serviceName} không phản hồi. Vui lòng thử lại sau.`,
        serviceName
      });
    }
    
    // Generic error
    res.status(502).json({ 
      error: 'BAD_GATEWAY',
      message: `Không thể kết nối đến dịch vụ ${serviceName}. Vui lòng thử lại sau.`,
      serviceName
    });
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
app.use('/admin/banners', (req, res) => proxy(req, res, services.catalog));
app.use('/admin/reviews', (req, res) => proxy(req, res, services.catalog));
app.use('/admin/orders', (req, res) => proxy(req, res, services.order));
app.use('/admin/coupons', (req, res) => proxy(req, res, services.order));
app.use('/admin/users', (req, res) => proxy(req, res, services.auth));

app.get('/health', async (req, res) => {
  try {
    // Check all services health
    const healthChecks = await Promise.allSettled([
      axios.get(`${services.auth}/health`, { timeout: 3000 }),
      axios.get(`${services.catalog}/health`, { timeout: 3000 }),
      axios.get(`${services.cart}/health`, { timeout: 3000 }),
      axios.get(`${services.order}/health`, { timeout: 3000 }),
      axios.get(`${services.payment}/health`, { timeout: 3000 }),
    ]);

    const results = {
      gateway: 'healthy',
      services: {
        auth: healthChecks[0].status === 'fulfilled' ? healthChecks[0].value.data : { status: 'unhealthy', error: healthChecks[0].reason?.message },
        catalog: healthChecks[1].status === 'fulfilled' ? healthChecks[1].value.data : { status: 'unhealthy', error: healthChecks[1].reason?.message },
        cart: healthChecks[2].status === 'fulfilled' ? healthChecks[2].value.data : { status: 'unhealthy', error: healthChecks[2].reason?.message },
        order: healthChecks[3].status === 'fulfilled' ? healthChecks[3].value.data : { status: 'unhealthy', error: healthChecks[3].reason?.message },
        payment: healthChecks[4].status === 'fulfilled' ? healthChecks[4].value.data : { status: 'unhealthy', error: healthChecks[4].reason?.message },
      },
      timestamp: new Date().toISOString()
    };

    const allHealthy = healthChecks.every(check => check.status === 'fulfilled');
    res.status(allHealthy ? 200 : 503).json(results);
  } catch (error) {
    res.status(503).json({ 
      gateway: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API Gateway listening on ${PORT}`);
});


