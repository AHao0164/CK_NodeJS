import axios from 'axios';

const API_BASE = process.env.API_BASE || 'http://localhost:8080';

function client(token) {
  const inst = axios.create({ baseURL: API_BASE, validateStatus: () => true });
  if (token) inst.interceptors.request.use(cfg => { cfg.headers.Authorization = `Bearer ${token}`; return cfg; });
  return inst;
}

async function login(email, password) {
  const { data, status } = await axios.post(`${API_BASE}/auth/login`, { email, password });
  if (status >= 400) throw new Error('Admin login failed');
  return data.token;
}

async function signupUser(email, password, fullName) {
  try {
    const { status } = await axios.post(`${API_BASE}/auth/signup`, { email, password, fullName });
    if (status !== 201 && status !== 409) {
      console.warn(`Signup returned ${status} for ${email}, continuing...`);
    }
  } catch (e) {
    console.warn(`Signup error for ${email}, continuing...`);
  }
}

async function seedCatalog(admin) {
  const brands = ['Apple', 'Dell', 'Lenovo', 'HP', 'Asus'];
  const categories = ['Ultrabook', 'Gaming', 'Business', 'Student', 'Workstation'];
  const bRes = await admin.get('/admin/catalog/brands');
  const cRes = await admin.get('/admin/catalog/categories');
  const haveBrands = new Set((bRes.data.items || bRes.data || []).map(b => b.name));
  const haveCats = new Set((cRes.data.items || cRes.data || []).map(c => c.name));
  for (const name of brands) if (!haveBrands.has(name)) await admin.post('/admin/catalog/brands', { name });
  for (const name of categories) if (!haveCats.has(name)) await admin.post('/admin/catalog/categories', { name });

  const { data: allBrands } = await admin.get('/admin/catalog/brands');
  const { data: allCats } = await admin.get('/admin/catalog/categories');
  const brandByName = Object.fromEntries((allBrands.items || allBrands || []).map(b => [b.name, b.id]));
  const catByName = Object.fromEntries((allCats.items || allCats || []).map(c => [c.name, c.id]));

  const products = [
    // Apple Products
    { name: 'MacBook Air M2 13"', brand: 'Apple', cat: 'Ultrabook', priceCents: 24990000, stock: 30, description: 'Chip M2, 8GB RAM, 256GB SSD. Lightweight and powerful for everyday tasks.' },
    { name: 'MacBook Pro 14" M3', brand: 'Apple', cat: 'Workstation', priceCents: 48990000, stock: 15, description: 'M3 Pro chip, 16GB RAM, 512GB SSD. Professional-grade performance.' },
    { name: 'MacBook Air M3 15"', brand: 'Apple', cat: 'Ultrabook', priceCents: 32990000, stock: 20, description: 'M3 chip, 8GB RAM, 512GB SSD. Large display for productivity.' },
    
    // Dell Products
    { name: 'Dell XPS 13', brand: 'Dell', cat: 'Ultrabook', priceCents: 32990000, stock: 25, description: 'Intel i7-1355U, 16GB RAM, 512GB SSD. Premium ultrabook with InfinityEdge display.' },
    { name: 'Dell XPS 15', brand: 'Dell', cat: 'Workstation', priceCents: 42990000, stock: 18, description: 'Intel i7-13700H, 32GB RAM, 1TB SSD, RTX 4050. Content creator powerhouse.' },
    { name: 'Dell G15 Gaming', brand: 'Dell', cat: 'Gaming', priceCents: 28990000, stock: 22, description: 'Intel i7-13650HX, 16GB RAM, RTX 4060. Affordable gaming performance.' },
    { name: 'Dell Latitude 5430', brand: 'Dell', cat: 'Business', priceCents: 21990000, stock: 35, description: 'Intel i5-1245U, 16GB RAM, 512GB SSD. Reliable business laptop.' },
    
    // Lenovo Products
    { name: 'Lenovo Legion 5', brand: 'Lenovo', cat: 'Gaming', priceCents: 35990000, stock: 20, description: 'Ryzen 7 7735HS, 16GB RAM, RTX 4060. High-performance gaming laptop.' },
    { name: 'Lenovo Legion 7i', brand: 'Lenovo', cat: 'Gaming', priceCents: 52990000, stock: 12, description: 'Intel i9-13900HX, 32GB RAM, RTX 4070. Premium gaming experience.' },
    { name: 'Lenovo ThinkPad X1 Carbon', brand: 'Lenovo', cat: 'Business', priceCents: 38990000, stock: 15, description: 'Intel i7-1355U, 16GB RAM, 512GB SSD. Ultra-portable business laptop.' },
    { name: 'Lenovo IdeaPad Slim 5', brand: 'Lenovo', cat: 'Student', priceCents: 15990000, stock: 40, description: 'Ryzen 5 7530U, 8GB RAM, 512GB SSD. Budget-friendly for students.' },
    
    // HP Products
    { name: 'HP ProBook 440', brand: 'HP', cat: 'Business', priceCents: 18990000, stock: 40, description: 'Intel i5-1235U, 8GB RAM, 256GB SSD. Essential business laptop.' },
    { name: 'HP Envy x360', brand: 'HP', cat: 'Ultrabook', priceCents: 26990000, stock: 25, description: 'Ryzen 7 7730U, 16GB RAM, 512GB SSD. Convertible 2-in-1 design.' },
    { name: 'HP Omen 16', brand: 'HP', cat: 'Gaming', priceCents: 39990000, stock: 18, description: 'Intel i7-13700HX, 16GB RAM, RTX 4060. Gaming powerhouse.' },
    { name: 'HP Pavilion 15', brand: 'HP', cat: 'Student', priceCents: 13990000, stock: 45, description: 'Intel i5-1235U, 8GB RAM, 512GB SSD. Perfect for students.' },
    
    // Asus Products
    { name: 'Asus TUF A15', brand: 'Asus', cat: 'Gaming', priceCents: 24990000, stock: 22, description: 'Ryzen 5 7535HS, 8GB RAM, RTX 3050. Entry-level gaming laptop.' },
    { name: 'Asus ROG Zephyrus G14', brand: 'Asus', cat: 'Gaming', priceCents: 46990000, stock: 14, description: 'Ryzen 9 7940HS, 16GB RAM, RTX 4060. Compact gaming beast.' },
    { name: 'Asus Zenbook 14', brand: 'Asus', cat: 'Ultrabook', priceCents: 22990000, stock: 28, description: 'Intel i5-1340P, 16GB RAM, 512GB SSD. Elegant ultrabook design.' },
    { name: 'Asus VivoBook 15', brand: 'Asus', cat: 'Student', priceCents: 11990000, stock: 50, description: 'Intel i3-1215U, 8GB RAM, 256GB SSD. Budget-friendly option.' }
  ];

  const { data: current } = await admin.get('/admin/catalog/products');
  const exists = new Set((current.items || current || []).map(p => p.name));
  for (const p of products) {
    if (exists.has(p.name)) continue;
    await admin.post('/admin/catalog/products', {
      name: p.name,
      brandId: brandByName[p.brand] || null,
      categoryId: catByName[p.cat] || null,
      priceCents: p.priceCents,
      stock: p.stock,
      description: p.description,
    });
  }
}

async function seedDemoOrders(userEmail, password) {
  // login user
  const token = await login(userEmail, password);
  const cli = client(token);
  // fetch product list from public API
  const { data: prods } = await axios.get(`${API_BASE}/catalog/products`);
  const prodList = prods.items || prods || [];
  const pick = prodList.slice(0, 3).map((p, i) => ({ productId: p.id, quantity: i + 1, priceCents: p.price_cents }));
  // add to cart
  for (const it of pick) {
    await cli.post('/cart/items', { productId: it.productId, quantity: it.quantity, priceCents: it.priceCents });
  }
  // checkout
  const { data: order } = await cli.post('/orders/checkout', { items: pick });
  // mock confirm payment via order service; order service calls payment-service
  await cli.post(`/orders/${order.orderId}/pay`, { intentId: order.paymentIntentId });
}

async function main() {
  console.log('Seeding start...');
  // ensure two demo users
  await signupUser('user1@example.com', 'User1!23456', 'User One');
  await signupUser('user2@example.com', 'User2!23456', 'User Two');

  // admin login using compose env
  const adminToken = await login('admin@example.com', 'Admin!23456');
  const admin = client(adminToken);

  // seed catalog data
  await seedCatalog(admin);

  // create demo orders for users
  await seedDemoOrders('user1@example.com', 'User1!23456');
  await seedDemoOrders('user2@example.com', 'User2!23456');

  console.log('Seeding completed.');
}

main().catch((e) => {
  console.error('Seeding failed', e);
  process.exit(1);
});


