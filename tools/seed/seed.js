import axios from 'axios';

const API_BASE = process.env.API_BASE || 'http://localhost:8080';

function client(token, isAdmin = false) {
  const inst = axios.create({ 
    baseURL: API_BASE, 
    validateStatus: () => true,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': 'application/json; charset=utf-8'
    }
  });
  if (token) {
    inst.interceptors.request.use(cfg => { 
      cfg.headers.Authorization = `Bearer ${token}`;
      if (isAdmin) {
        cfg.headers['x-user-role'] = 'ADMIN';
      }
      return cfg; 
    });
  }
  return inst;
}

async function login(email, password) {
  const { data, status } = await axios.post(`${API_BASE}/auth/login`, { email, password });
  if (status >= 400) {
    const errorMsg = data?.error || `Login failed with status ${status}`;
    throw new Error(`Login failed: ${errorMsg}`);
  }
  if (!data?.token) {
    throw new Error('Login succeeded but no token received');
  }
  const payload = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64').toString());
  return { token: data.token, userId: payload.sub };
}

async function createAdminUser() {
  // Sử dụng env variable hoặc default email
  let adminEmail = process.env.ADMIN_EMAIL || 'tenho051512@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
  const adminFullName = process.env.ADMIN_FULLNAME || 'System Administrator';
  
  console.log('\n📋 Creating admin account...');
  console.log(`  → Using admin email: ${adminEmail}`);
  
  // Step 1: Try to signup (will return 409 if user exists)
  const signupResult = await signupUser(adminEmail, adminPassword, adminFullName);
  
  // Step 2: Try to login
  let token;
  try {
    const loginResult = await login(adminEmail, adminPassword);
    token = loginResult.token;
    console.log(`Login successful`);
  } catch (loginError) {
    // If login fails, user might exist with different password (from guest checkout)
    if (signupResult.exists) {
      console.warn(`\nUser ${adminEmail} already exists but password is incorrect.`);
      console.warn(`This usually happens when the user was created via guest checkout with a random password.`);
      
      // Try to use a different email if ADMIN_EMAIL is not explicitly set
      if (!process.env.ADMIN_EMAIL) {
        const timestamp = Date.now();
        const newEmail = `admin-${timestamp}@seed.local`;
        console.log(`Trying alternative email: ${newEmail}`);
        
        try {
          const altSignupResult = await signupUser(newEmail, adminPassword, adminFullName);
          if (altSignupResult.created) {
            const loginResult = await login(newEmail, adminPassword);
            token = loginResult.token;
            adminEmail = newEmail;
            console.log(`Created and logged in with alternative email: ${newEmail}`);
          } else {
            throw new Error(`Alternative email also exists`);
          }
        } catch (altError) {
          console.error(`\nFailed to create alternative admin account: ${altError.message}`);
          console.error(`\nSolutions:`);
          console.error(`1. Delete the user from database:`);
          console.error(`DELETE FROM users WHERE email = '${adminEmail}';`);
          console.error(`2. Or reset password manually via /forgot-password endpoint`);
          console.error(`3. Or set ADMIN_EMAIL and ADMIN_PASSWORD env vars to use a different account\n`);
          throw new Error(`Cannot login to existing user ${adminEmail}. Please delete user or use different email.`);
        }
      } else {
        // ADMIN_EMAIL is explicitly set, don't try alternative
        console.error(`\nCannot use alternative email because ADMIN_EMAIL is explicitly set.`);
        console.error(`\nSolutions:`);
        console.error(`1. Delete the user from database:`);
        console.error(`DELETE FROM users WHERE email = '${adminEmail}';`);
        console.error(`2. Or reset password manually via /forgot-password endpoint`);
        console.error(`3. Or unset ADMIN_EMAIL env var to allow automatic alternative email\n`);
        throw new Error(`Cannot login to existing user ${adminEmail}. Please delete user or use different email.`);
      }
    } else {
      throw new Error(`Login failed for ${adminEmail}: ${loginError.message}`);
    }
  }
  
  // Step 3: Promote user to ADMIN role
  try {
    const promoteResponse = await axios.post(`${API_BASE}/auth/promote-admin`, {}, 
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (promoteResponse.status === 200) {
      console.log(`User promoted to ADMIN role`);
      // Wait longer for database to update and propagate
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Retry login up to 3 times to get token with ADMIN role
      let retries = 3;
      let newToken = null;
      while (retries > 0 && !newToken) {
        try {
          const newLoginResult = await login(adminEmail, adminPassword);
          // Verify token has ADMIN role by decoding it
          const payload = JSON.parse(Buffer.from(newLoginResult.token.split('.')[1], 'base64').toString());
          if (payload.role === 'ADMIN') {
            token = newLoginResult.token;
            newToken = newLoginResult.token;
            console.log(`Re-logged in with ADMIN role (verified in token)`);
          } else {
            console.log(`Token still has role: ${payload.role}, retrying... (${retries - 1} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 500));
            retries--;
          }
        } catch (loginErr) {
          console.warn(`Re-login attempt failed:`, loginErr.message);
          await new Promise(resolve => setTimeout(resolve, 500));
          retries--;
        }
      }
      
      if (!newToken) {
        console.warn(`Could not get token with ADMIN role after ${3} attempts`);
      }
    } else {
      console.warn(`Failed to promote to ADMIN: ${promoteResponse.status} - ${JSON.stringify(promoteResponse.data)}`);
    }
  } catch (e) {
    console.warn(`Failed to promote to ADMIN:`, e.message);
    if (e.response) {
      console.warn(`Response: ${e.response.status} - ${JSON.stringify(e.response.data)}`);
    }
  }
  
  // Step 4: Update profile if needed
  try {
    await axios.patch(`${API_BASE}/auth/profile`, 
      { phoneNumber: '0123456789', address: 'Admin Office' },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (e) {
    console.warn(`Profile update failed (non-critical):`, e.message);
  }
  
  console.log(`Admin account ready: ${adminEmail}`);
  console.log(`Password: ${adminPassword}`);
  return { email: adminEmail, password: adminPassword };
}

async function signupUser(email, password, fullName) {
  try {
    const { status, data } = await axios.post(`${API_BASE}/auth/signup`, { email, password, fullName });
    if (status === 201) {
      console.log(`Created new user: ${email}`);
      return { created: true };
    } else if (status === 409) {
      console.log(`User already exists: ${email}`);
      return { created: false, exists: true };
    } else {
      console.warn(`Signup returned ${status} for ${email}`);
      return { created: false };
    }
  } catch (e) {
    if (e.response?.status === 409) {
      console.log(`User already exists: ${email}`);
      return { created: false, exists: true };
    }
    console.warn(`Signup error for ${email}:`, e.message);
    return { created: false };
  }
}

async function updateUserProfile(email, password, profileData) {
  try {
    const { token } = await login(email, password);
    const api = client(token);
    const { status } = await api.patch('/auth/profile', profileData);
    if (status === 200) {
      console.log(`Updated profile for ${email}`);
    } else {
      console.warn(`Profile update returned ${status} for ${email}`);
    }
  } catch (e) {
    console.warn(`Profile update error for ${email}:`, e.message);
  }
}

async function seedCatalog(admin) {
  // === BRANDS - GearUp Full ===
  const brands = [
    // Laptop
    'Apple', 'Dell', 'Lenovo', 'HP', 'Asus', 'MSI', 'Acer',
    // CPU & GPU
    'Intel', 'AMD', 'NVIDIA',
    // RAM & Storage
    'Corsair', 'Kingston', 'G.Skill', 'Team', 'Samsung', 'WD', 'Seagate', 'Crucial',
    // Mainboard & Components
    'Gigabyte', 'ASRock',
    // Peripherals
    'Logitech', 'Razer', 'SteelSeries', 'HyperX',
    // Case & Cooling
    'NZXT', 'Cooler Master', 'be quiet!',
    // Monitor
    'LG', 'AOC', 'BenQ'
  ];
  
  // === CATEGORIES ===
  const categories = [
    'Laptop Gaming', 'Laptop Văn phòng', 'Laptop Đồ họa', 'Laptop Sinh viên',
    'CPU - Bộ vi xử lý', 'GPU - Card đồ họa', 'RAM - Bộ nhớ', 'SSD - Ổ cứng',
    'Mainboard - Bo mạch chủ', 'Case - Vỏ máy tính', 'PSU - Nguồn máy tính',
    'Cooling - Tản nhiệt', 'Monitor - Màn hình', 'Keyboard - Bàn phím',
    'Mouse - Chuột', 'Headset - Tai nghe'
  ];
  
  const bRes = await admin.get('/admin/catalog/brands');
  const cRes = await admin.get('/admin/catalog/categories');
  const brandsData = Array.isArray(bRes.data) ? bRes.data : (bRes.data?.items || []);
  const catsData = Array.isArray(cRes.data) ? cRes.data : (cRes.data?.items || []);
  
  // Delete old brands not in current list
  let brandDeleted = 0;
  const newBrandNames = new Set(brands.map(b => b.toLowerCase()));
  for (const b of brandsData) {
    if (!newBrandNames.has(b.name.toLowerCase())) {
      try {
        await admin.delete(`/admin/catalog/brands/${b.id}`);
        brandDeleted++;
      } catch (e) {}
    }
  }
  
  // Delete old categories not in current list
  let catDeleted = 0;
  const newCatNames = new Set(categories.map(c => c.toLowerCase()));
  for (const c of catsData) {
    if (!newCatNames.has(c.name.toLowerCase())) {
      try {
        await admin.delete(`/admin/catalog/categories/${c.id}`);
        catDeleted++;
      } catch (e) {}
    }
  }
  
  // Re-fetch after deletion
  const { data: freshBrands } = await admin.get('/admin/catalog/brands');
  const { data: freshCats } = await admin.get('/admin/catalog/categories');
  const freshBrandsData = Array.isArray(freshBrands) ? freshBrands : (freshBrands?.items || []);
  const freshCatsData = Array.isArray(freshCats) ? freshCats : (freshCats?.items || []);
  const haveBrands = new Set(freshBrandsData.map(b => b.name.toLowerCase()));
  const haveCats = new Set(freshCatsData.map(c => c.name.toLowerCase()));
  
  // Add missing brands with detailed error logging
  let brandCreated = 0;
  let brandFailed = [];
  for (const name of brands) {
    if (!haveBrands.has(name.toLowerCase())) {
      const res = await admin.post('/admin/catalog/brands', { name });
      if (res.status < 300) {
        brandCreated++;
      } else {
        brandFailed.push(`${name}: ${res.status} - ${res.data?.error || 'Unknown error'}`);
      }
    }
  }
  
  // Add missing categories with detailed error logging
  let catCreated = 0;
  let catFailed = [];
  for (const name of categories) {
    if (!haveCats.has(name.toLowerCase())) {
      const res = await admin.post('/admin/catalog/categories', { name });
      if (res.status < 300) {
        catCreated++;
      } else if (res.status === 409) {
        catFailed.push(`${name}: Trùng (Duplicate)`);
      } else {
        catFailed.push(`${name}: ${res.status} - ${res.data?.error || 'Unknown error'}`);
      }
    }
  }
  
  console.log(`→ Xóa ${brandDeleted} hãng cũ, ${catDeleted} danh mục cũ`);
  console.log(`→ Thêm ${brandCreated} hãng mới, ${catCreated} danh mục mới`);
  if (brandFailed.length > 0) console.log(`Hãng thất bại: ${brandFailed.join('; ')}`);
  if (catFailed.length > 0) console.log(`Danh mục thất bại: ${catFailed.join('; ')}`);

  const { data: allBrands } = await admin.get('/admin/catalog/brands');
  const { data: allCats } = await admin.get('/admin/catalog/categories');
  const brandsList = Array.isArray(allBrands) ? allBrands : (allBrands?.items || []);
  const catsList = Array.isArray(allCats) ? allCats : (allCats?.items || []);
  const brandByName = Object.fromEntries(brandsList.map(b => [b.name, b.id]));
  const catByName = Object.fromEntries(catsList.map(c => [c.name, c.id]));

  // === PRODUCTS - 60+ sản phẩm với specs theo nhóm ===
  const products = [
    // LAPTOP GAMING (3)
    { sku: 'MSI-KATANA15', name: 'MSI Katana 15 B13VFK', brand: 'MSI', cat: 'Laptop Gaming', priceCents: 32990000, discountPercent: 15, stock: 15, description: 'RTX 4060, i7-13620H, 144Hz gaming', imageUrl: 'https://images.unsplash.com/photo-1603481588273-2f908a9a7a1b?w=800&q=80', images: ['https://images.unsplash.com/photo-1603481588273-2f908a9a7a1b?w=800&q=80', 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=800&q=80', 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&q=80'], 
      specs: { 
        performance: { cpu: 'Intel Core i7-13620H (10 cores, 16 threads, up to 4.9GHz)', gpu: 'NVIDIA GeForce RTX 4060 8GB GDDR6', ram: '16GB DDR5-4800MHz (2x8GB, upgradable to 64GB)', storage: '512GB NVMe PCIe Gen4 SSD' },
        display: { size: '15.6 inch', resolution: '1920x1080 (FHD)', refresh_rate: '144Hz', panel_type: 'IPS-Level' },
        battery: { capacity: '53.5Whr', life: 'Up to 5 hours' },
        connectivity: { wifi: 'Wi-Fi 6E', bluetooth: 'Bluetooth 5.3', ports: 'Thunderbolt 4, USB-C, HDMI 2.1' },
        design: { weight: '2.25kg', os: 'Windows 11 Home' }
      }, 
      features: ['NVIDIA DLSS 3 & Ray Tracing', 'Cooler Boost 5 dual fan cooling', 'Nahimic Audio Enhancer', 'RGB Gaming Keyboard by SteelSeries', 'Wi-Fi 6E & Bluetooth 5.3', 'Thunderbolt 4 support', 'HD webcam with privacy shutter'] 
    },
    { sku: 'ASUS-ROG-G15', name: 'Asus ROG Strix G15', brand: 'Asus', cat: 'Laptop Gaming', priceCents: 28990000, discountPercent: 10, stock: 12, description: 'RTX 3060, Ryzen 7 6800H, 300Hz', imageUrl: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=800&q=80', images: ['https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=800&q=80', 'https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=800&q=80', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80'], 
      specs: { 
        performance: { cpu: 'AMD Ryzen 7 6800H (8 cores, 16 threads, up to 4.7GHz)', gpu: 'NVIDIA GeForce RTX 3060 6GB GDDR6', ram: '16GB DDR5-4800MHz (upgradable to 32GB)', storage: '512GB NVMe PCIe Gen4 SSD' },
        display: { size: '15.6 inch', resolution: '1920x1080 (FHD)', refresh_rate: '300Hz', panel_type: 'IPS 3ms', brightness: '300 nits' },
        battery: { capacity: '90Whr', life: 'Up to 8 hours' },
        connectivity: { wifi: 'Wi-Fi 6', bluetooth: 'Bluetooth 5.2', ports: '2x USB Type-C (DisplayPort, Power Delivery), USB-A 3.2' },
        design: { weight: '2.3kg', os: 'Windows 11 Home' }
      }, 
      features: ['AMD FreeSync Premium', 'ROG Intelligent Cooling with liquid metal', 'Aura Sync RGB lighting', 'MUX Switch with Advanced Optimus', 'Dolby Atmos speakers', 'Per-key RGB keyboard', '2x USB Type-C with DisplayPort & Power Delivery'] 
    },
    { sku: 'LENOVO-LEGION5', name: 'Lenovo Legion 5 Pro', brand: 'Lenovo', cat: 'Laptop Gaming', priceCents: 35990000, stock: 10, description: 'RTX 4060, i7-13700HX, WQXGA 165Hz', imageUrl: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&q=80', images: ['https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&q=80', 'https://images.unsplash.com/photo-1603481588273-2f908a9a7a1b?w=800&q=80', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80'], 
      specs: { 
        performance: { cpu: 'Intel Core i7-13700HX (16 cores, 24 threads, up to 5.0GHz)', gpu: 'NVIDIA GeForce RTX 4060 8GB GDDR6', ram: '16GB DDR5-5600MHz (2x8GB, upgradable to 32GB)', storage: '512GB NVMe PCIe Gen4 SSD (2x M.2 slots)' },
        display: { size: '16 inch', resolution: '2560x1600 (WQXGA)', refresh_rate: '165Hz', panel_type: 'IPS G-Sync', brightness: '500 nits' },
        battery: { capacity: '80Whr', life: 'Up to 7 hours' },
        connectivity: { wifi: 'Wi-Fi 6E', bluetooth: 'Bluetooth 5.2', ports: 'USB-C (Power Delivery), USB-A 3.2, HDMI 2.1' },
        design: { weight: '2.5kg', os: 'Windows 11 Home' },
        audio: { speakers: '2x 2W Harman speakers', technology: 'Nahimic Audio' }
      }, 
      features: ['NVIDIA DLSS 3 & Reflex', 'Legion Coldfront 5.0 vapor chamber', 'Tobii Horizon eye tracking', '4-zone RGB keyboard with 1.5mm travel', 'Nahimic Audio with 2W Harman speakers', 'Legion TrueStrike keyboard', 'iCUE compatible RGB'] 
    },
    
    // LAPTOP VĂN PHÒNG (3)
    { sku: 'DELL-XPS13PLUS', name: 'Dell XPS 13 Plus', brand: 'Dell', cat: 'Laptop Văn phòng', priceCents: 45990000, stock: 8, description: 'i7-1360P, OLED 3.5K, siêu mỏng', imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80', images: ['https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80', 'https://images.unsplash.com/photo-1585241645927-c7a8e5840c42?w=800&q=80', 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=800&q=80'], 
      specs: { 
        performance: { cpu: 'Intel Core i7-1360P (12 cores, up to 5.0GHz)', gpu: 'Intel Iris Xe Graphics', ram: '16GB LPDDR5-5200MHz (onboard)', storage: '512GB NVMe PCIe Gen4 SSD' },
        display: { size: '13.4 inch', resolution: '3456x2160 (3.5K)', panel_type: 'OLED InfinityEdge', brightness: '400 nits' },
        battery: { capacity: '55Whr', life: 'Up to 12 hours' },
        connectivity: { wifi: 'Wi-Fi 6E', bluetooth: 'Bluetooth 5.2', ports: 'Thunderbolt 4 (2 ports)' },
        design: { weight: '1.24kg', thickness: '15.28mm', os: 'Windows 11 Home' }
      }, 
      features: ['OLED touchscreen với 100% DCI-P3', 'Thiết kế không viền siêu mỏng', 'Haptic touchpad với phản hồi xúc giác', 'Capacitive touch function keys', 'Thunderbolt 4 (2 ports)', 'Fingerprint reader trên nút nguồn', 'Killer Wi-Fi 6E AX1690', 'ExpressCharge sạc nhanh 80% trong 1 giờ'] 
    },
    { sku: 'APPLE-MACAIR-M3', name: 'MacBook Air M3 2024', brand: 'Apple', cat: 'Laptop Văn phòng', priceCents: 28990000, stock: 20, description: 'M3 chip, 18h pin, Retina 13.6"', imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80', images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80', 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&q=80', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80'], 
      specs: { 
        performance: { cpu: 'Apple M3 chip (8-core CPU with 4 performance and 4 efficiency cores)', gpu: '8-core GPU với Hardware Ray Tracing', ram: '8GB Unified Memory (lên đến 24GB)', storage: '256GB SSD (lên đến 2TB)' },
        display: { size: '13.6 inch', resolution: '2560x1664 (Liquid Retina)', brightness: '500 nits', color_gamut: 'P3 wide color' },
        battery: { life: 'Up to 18 hours video playback' },
        connectivity: { wifi: 'Wi-Fi 6E (802.11ax)', bluetooth: 'Bluetooth 5.3', ports: 'MagSafe 3 + 2x Thunderbolt' },
        design: { weight: '1.24kg', thickness: '11.3mm', os: 'macOS Sonoma' }
      }, 
      features: ['Chip M3 với 3nm process', 'Hỗ trợ 2 màn hình ngoài (với màn hình laptop đóng)', 'Magic Keyboard với Touch ID', '1080p FaceTime HD camera', '4-speaker system với Spatial Audio', 'Sạc MagSafe 3 + 2x Thunderbolt', 'Wi-Fi 6E (802.11ax)', 'Fanless design hoàn toàn im lặng'] 
    },
    { sku: 'LENOVO-X1-CARBON', name: 'Lenovo ThinkPad X1 Carbon Gen 11', brand: 'Lenovo', cat: 'Laptop Văn phòng', priceCents: 42990000, stock: 12, description: 'i7-1355U, OLED 2.8K, MIL-STD-810H', imageUrl: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&q=80', images: ['https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&q=80', 'https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=800&q=80', 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&q=80'], 
      specs: { 
        performance: { cpu: 'Intel Core i7-1355U (10 cores, up to 5.0GHz vPro)', gpu: 'Intel Iris Xe Graphics', ram: '16GB LPDDR5-6400MHz (onboard)', storage: '512GB NVMe PCIe Gen4 SSD' },
        display: { size: '14 inch', resolution: '2880x1800 (2.8K)', panel_type: 'OLED', brightness: '400 nits', color_gamut: '100% DCI-P3' },
        battery: { capacity: '57Whr', life: 'Up to 15 hours' },
        connectivity: { wifi: 'Wi-Fi 6E', bluetooth: 'Bluetooth 5.2', ports: '2x Thunderbolt 4, 2x USB-A 3.2, HDMI 2.1' },
        design: { weight: '1.12kg', durability: 'MIL-STD-810H', os: 'Windows 11 Pro' }
      }, 
      features: ['MIL-STD-810H military durability', 'Dolby Atmos Speaker System', 'FHD IR + RGB Hybrid camera với Privacy Shutter', 'Backlit ThinkPad keyboard với TrackPoint', 'Match-on-Chip fingerprint reader', 'Wi-Fi 6E & 5G option', 'Rapid Charge 80% trong 1 giờ', 'Carbon fiber + magnesium chassis'] 
    },
    
    // LAPTOP ĐỒ HỌA (3)
    { sku: 'DELL-XPS15-9530', name: 'Dell XPS 15 9530', brand: 'Dell', cat: 'Laptop Đồ họa', priceCents: 52990000, stock: 6, description: 'i7-13700H, RTX 4050, OLED 3.5K', imageUrl: 'https://images.unsplash.com/photo-1585241645927-c7a8e5840c42?w=800&q=80', images: ['https://images.unsplash.com/photo-1585241645927-c7a8e5840c42?w=800&q=80', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80', 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=800&q=80'], 
      specs: { 
        performance: { cpu: 'Intel Core i7-13700H (14 cores, 20 threads, up to 5.0GHz)', gpu: 'NVIDIA GeForce RTX 4050 6GB GDDR6', ram: '32GB DDR5-4800MHz (2x16GB, upgradable to 64GB)', storage: '1TB NVMe PCIe Gen4 SSD' },
        display: { size: '15.6 inch', resolution: '3456x2160 (3.5K)', panel_type: 'OLED InfinityEdge', brightness: '400 nits', color_gamut: '100% DCI-P3' },
        battery: { capacity: '86Whr', life: 'Up to 13 hours' },
        connectivity: { wifi: 'Wi-Fi 6E', bluetooth: 'Bluetooth 5.2', ports: '2x Thunderbolt 4, USB-C 3.2, SD card reader' },
        design: { weight: '1.86kg', os: 'Windows 11 Pro' }
      }, 
      features: ['OLED touchscreen với Dolby Vision', '100% DCI-P3 color gamut - chuẩn màu chuyên nghiệp', 'NVIDIA Studio drivers tối ưu cho creative apps', 'Precision touchpad kích thước lớn', 'Quad speakers (8W) with Waves MaxxAudio Pro', 'Vapor chamber cooling system', 'ExpressCharge 3.0 - sạc 80% trong 1 giờ', 'Corning Gorilla Glass 7 touchscreen'] 
    },
    { sku: 'APPLE-MACPRO14-M3PRO', name: 'MacBook Pro 14 M3 Pro', brand: 'Apple', cat: 'Laptop Đồ họa', priceCents: 59990000, stock: 8, description: 'M3 Pro, XDR 14.2", 17h pin', imageUrl: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&q=80', images: ['https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&q=80', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80', 'https://images.unsplash.com/photo-1585241645927-c7a8e5840c42?w=800&q=80'], 
      specs: { 
        performance: { cpu: 'Apple M3 Pro chip (11-core CPU, 5P+6E)', gpu: '14-core GPU với Hardware Ray Tracing & Mesh Shading', ram: '18GB Unified Memory (lên đến 36GB)', storage: '512GB SSD (lên đến 4TB)' },
        display: { size: '14.2 inch', resolution: '3024x1964 (Liquid Retina XDR)', brightness: '1000 nits sustained, 1600 nits peak HDR', refresh_rate: 'Up to 120Hz (ProMotion)' },
        battery: { life: 'Up to 18 hours video, 12 hours wireless web' },
        connectivity: { wifi: 'Wi-Fi 6E', bluetooth: 'Bluetooth 5.3', ports: '3x Thunderbolt 4, HDMI 2.1, SDXC card, MagSafe 3' },
        design: { weight: '1.55kg', os: 'macOS Sonoma' }
      }, 
      features: ['Liquid Retina XDR display 1000nits sustained, 1600nits peak', 'ProMotion technology up to 120Hz', 'Hỗ trợ 2 external displays 6K@60Hz', '1080p FaceTime HD camera với advanced ISP', 'Studio-quality 6-speaker với Spatial Audio', 'Studio-quality 3-mic array với voice isolation', 'Magic Keyboard với Touch ID', 'Active cooling cho sustained performance'] 
    },
    { sku: 'MSI-CREATOR-Z16', name: 'MSI Creator Z16 HX Studio', brand: 'MSI', cat: 'Laptop Đồ họa', priceCents: 64990000, stock: 5, description: 'i9-13950HX, RTX 4070, Mini-LED QHD+', imageUrl: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=800&q=80', images: ['https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=800&q=80', 'https://images.unsplash.com/photo-1603481588273-2f908a9a7a1b?w=800&q=80', 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=800&q=80'], 
      specs: { 
        performance: { cpu: 'Intel Core i9-13950HX (24 cores, 32 threads, up to 5.5GHz)', gpu: 'NVIDIA GeForce RTX 4070 8GB GDDR6 Studio', ram: '64GB DDR5-5600MHz (2x32GB)', storage: '2TB NVMe PCIe Gen4 SSD (2x 1TB RAID 0)' },
        display: { size: '16 inch', resolution: '2560x1600 (QHD+)', panel_type: 'Mini-LED 1000+ dimming zones', refresh_rate: '165Hz', brightness: '1000 nits', color_gamut: '100% DCI-P3' },
        battery: { capacity: '90Whr', life: 'Up to 9 hours' },
        connectivity: { wifi: 'Wi-Fi 6E', bluetooth: 'Bluetooth 5.2', ports: 'Thunderbolt 4, 3x USB-A 3.2, HDMI 2.1, SD Express 7.0' },
        design: { weight: '2.39kg', os: 'Windows 11 Pro for Workstations' }
      }, 
      features: ['Mini-LED với 1000+ dimming zones, 1000nits', 'NVIDIA Studio drivers - certified cho Adobe, Autodesk', 'Cooler Boost Trinity+ với 3 fans + 7 heat pipes', 'Per-key RGB keyboard with white backlight mode', 'Golden ratio 16:10 touchscreen', 'MSI Center Pro for creators', 'Hi-Res Audio với 4 speakers (6W)', 'True Pixel Display 100% DCI-P3 color accurate'] 
    },
    
    // LAPTOP SINH VIÊN (3)
    { sku: 'ACER-ASPIRE5', name: 'Acer Aspire 5 A515', brand: 'Acer', cat: 'Laptop Sinh viên', priceCents: 12990000, discountPercent: 12, stock: 35, description: 'i5-1335U, 512GB SSD, Full HD', imageUrl: 'https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=800&q=80', images: ['https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=800&q=80', 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&q=80', 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&q=80'], 
      specs: { 
        performance: { cpu: 'Intel Core i5-1335U (10 cores, up to 4.6GHz)', gpu: 'Intel Iris Xe Graphics', ram: '8GB DDR4-3200MHz (1 slot free, upgradable to 32GB)', storage: '512GB NVMe PCIe SSD' },
        display: { size: '15.6 inch', resolution: '1920x1080 (Full HD)', panel_type: 'IPS slim bezel' },
        battery: { capacity: '50Whr', life: 'Up to 8 hours' },
        connectivity: { wifi: 'Wi-Fi 6', bluetooth: 'Bluetooth 5.1', ports: 'USB-C, 2x USB 3.2, USB 2.0, HDMI, LAN RJ-45' },
        design: { weight: '1.7kg', os: 'Windows 11 Home + Office 2021' }
      }, 
      features: ['Giá thành tốt cho sinh viên', 'Full HD IPS với góc nhìn rộng', 'Bàn phím số tiện lợi cho Excel', 'Tặng kèm Office 2021 bản quyền', 'Webcam HD với physical privacy shutter', 'Dual speakers với Acer TrueHarmony', 'Wi-Fi 6 AX201', 'Có thể nâng cấp RAM và SSD dễ dàng'] 
    },
    { sku: 'HP-15S-FQ5231TU', name: 'HP 15s-fq5231TU', brand: 'HP', cat: 'Laptop Sinh viên', priceCents: 12990000, stock: 35, description: 'i3-1215U, Office 2021, giá rẻ', imageUrl: 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&q=80', images: ['https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&q=80', 'https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=800&q=80', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80'], 
      specs: { 
        performance: { cpu: 'Intel Core i3-1215U (6 cores, up to 4.4GHz)', gpu: 'Intel UHD Graphics', ram: '8GB DDR4-3200MHz (onboard)', storage: '256GB NVMe PCIe SSD' },
        display: { size: '15.6 inch', resolution: '1366x768 (HD)', panel_type: 'SVA anti-glare' },
        battery: { capacity: '41Whr', life: 'Up to 7 hours' },
        connectivity: { wifi: 'Wi-Fi 5 (802.11ac)', bluetooth: 'Bluetooth 5.0', ports: 'USB-C, 2x USB-A 3.2, HDMI 1.4, SD card reader' },
        design: { weight: '1.69kg', os: 'Windows 11 Home + Office Home & Student 2021' }
      }, 
      features: ['Giá cực kỳ phải chăng', 'Tặng Office 2021 bản quyền', 'HP Fast Charge - sạc 50% trong 45 phút', 'Dual speakers với Audio by B&O', 'Webcam HP TrueVision 720p', 'Thiết kế nhẹ, dễ mang theo', 'Wi-Fi 5 (802.11ac)', 'Bảo hành 12 tháng chính hãng HP'] 
    },
    { sku: 'ASUS-VIVOBOOK15', name: 'Asus VivoBook 15 X1504ZA', brand: 'Asus', cat: 'Laptop Sinh viên', priceCents: 13490000, stock: 40, description: 'i5-1235U, NanoEdge display', imageUrl: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&q=80', images: ['https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&q=80', 'https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=800&q=80', 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&q=80'], 
      specs: { 
        performance: { cpu: 'Intel Core i5-1235U (10 cores, up to 4.4GHz)', gpu: 'Intel Iris Xe Graphics', ram: '8GB DDR4-3200MHz (1 slot free, upgradable to 16GB)', storage: '512GB NVMe PCIe SSD (M.2 slot free)' },
        display: { size: '15.6 inch', resolution: '1920x1080 (Full HD)', panel_type: 'NanoEdge IPS', brightness: '250 nits' },
        battery: { capacity: '42Whr', life: 'Up to 6 hours' },
        connectivity: { wifi: 'Wi-Fi 5', bluetooth: 'Bluetooth 5.0', ports: 'USB-C 3.2, 2x USB-A 3.2, USB 2.0, HDMI, microSD' },
        design: { weight: '1.7kg', os: 'Windows 11 Home' }
      }, 
      features: ['NanoEdge display với viền mỏng 82% screen-to-body', 'Full HD IPS với độ chính xác màu tốt', 'Ergonomic backlit keyboard', 'Có thể nâng cấp RAM và thêm SSD thứ 2', 'ASUS SonicMaster stereo speakers', 'Webcam với privacy shutter', 'Wi-Fi 5 & Bluetooth 5.0', 'Thiết kế trẻ trung với nhiều màu sắc'] 
    },
    
    // CPU (5)
    { sku: 'INTEL-I5-13400F', name: 'Intel Core i5-13400F', brand: 'Intel', cat: 'CPU - Bộ vi xử lý', priceCents: 4490000, discountPercent: 10, stock: 50, description: '10 nhân 16 luồng, turbo 4.6GHz, LGA1700', imageUrl: 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80', images: ['https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80'], specs: { cores: '10 cores / 16 threads (6P+4E)', base_clock: '2.5GHz', turbo_clock: '4.6GHz', cache: '20MB Intel Smart Cache', socket: 'LGA1700', tdp: '65W base, 148W max', memory: 'DDR5-4800, DDR4-3200', process: 'Intel 7 (10nm)' }, features: ['Hiệu suất vượt trội cho gaming và đa nhiệm', 'Hỗ trợ cả DDR4 và DDR5', 'Intel Thread Director thông minh', 'PCIe 5.0 và PCIe 4.0 support', 'Tương thích mainboard B660, H610, B760', 'Không có iGPU - cần card rời', 'Tản nhiệt stock cooler hoạt động tốt'] },
    { sku: 'INTEL-I7-13700K', name: 'Intel Core i7-13700K', brand: 'Intel', cat: 'CPU - Bộ vi xử lý', priceCents: 9990000, discountPercent: 8, stock: 30, description: '16 nhân 24 luồng, turbo 5.4GHz, unlocked', imageUrl: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', images: ['https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80'], specs: { cores: '16 cores / 24 threads (8P+8E)', base_clock: '3.4GHz', turbo_clock: '5.4GHz', cache: '30MB Intel Smart Cache', socket: 'LGA1700', tdp: '125W base, 253W max', memory: 'DDR5-5600, DDR4-3200', process: 'Intel 7 (10nm)', unlocked: 'Yes - Overclockable' }, features: ['Unlocked for overclocking', 'Hiệu suất cao cho gaming và content creation', 'Intel UHD Graphics 770 integrated', 'Intel Turbo Boost Max 3.0', 'PCIe 5.0 x16 + PCIe 4.0', 'Intel Thermal Velocity Boost', 'Yêu cầu tản nhiệt khí tốt (240mm AIO khuyến nghị)', 'Tương thích Z690, Z790 cho OC'] },
    { sku: 'AMD-RYZEN5-7600X', name: 'AMD Ryzen 5 7600X', brand: 'AMD', cat: 'CPU - Bộ vi xử lý', priceCents: 5990000, discountPercent: 12, stock: 40, description: '6 nhân 12 luồng, Zen 4, AM5', imageUrl: 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80', images: ['https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1587202372583-49330a15584d?w=800&q=80'], specs: { cores: '6 cores / 12 threads', base_clock: '4.7GHz', turbo_clock: '5.3GHz', cache: '32MB L3 + 6MB L2', socket: 'AM5', tdp: '105W', memory: 'DDR5-5200', process: '5nm Zen 4', unlocked: 'Yes - Overclockable' }, features: ['Kiến trúc Zen 4 mới nhất', 'Hiệu suất gaming vượt trội', 'Chỉ hỗ trợ DDR5', 'AMD EXPO profiles cho RAM OC', 'PCIe 5.0 support', 'Radeon Graphics integrated (2 cores)', 'AMD Precision Boost Overdrive 2', 'Socket AM5 mới - hỗ trợ lâu dài'] },
    { sku: 'AMD-RYZEN7-7800X3D', name: 'AMD Ryzen 7 7800X3D', brand: 'AMD', cat: 'CPU - Bộ vi xử lý', priceCents: 10990000, stock: 25, description: '8 nhân 16 luồng, 3D V-Cache, gaming tốt nhất', imageUrl: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', images: ['https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80', 'https://images.unsplash.com/photo-1587202372583-49330a15584d?w=800&q=80'], specs: { cores: '8 cores / 16 threads', base_clock: '4.2GHz', turbo_clock: '5.0GHz', cache: '96MB 3D V-Cache (64MB stacked + 32MB L3)', socket: 'AM5', tdp: '120W', memory: 'DDR5-5200', process: '5nm Zen 4 + 3D V-Cache', unlocked: 'Limited OC' }, features: ['CPU gaming tốt nhất hiện nay', '3D V-Cache technology độc quyền', 'Hiệu suất cao với TDP thấp', 'Tản nhiệt dễ dàng hơn 7950X3D', 'Không cần OC đã mạnh', 'Tối ưu cho 1440p và 4K gaming', 'Socket AM5 - upgrade lâu dài', '96MB cache giảm lag trong game'] },
    { sku: 'INTEL-I9-13900K', name: 'Intel Core i9-13900K', brand: 'Intel', cat: 'CPU - Bộ vi xử lý', priceCents: 14990000, stock: 15, description: '24 nhân 32 luồng, turbo 5.8GHz, flagship', imageUrl: 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80', images: ['https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80'], specs: { cores: '24 cores / 32 threads (8P+16E)', base_clock: '3.0GHz', turbo_clock: '5.8GHz', cache: '36MB Intel Smart Cache', socket: 'LGA1700', tdp: '125W base, 253W max', memory: 'DDR5-5600, DDR4-3200', process: 'Intel 7 (10nm)', unlocked: 'Yes - Overclockable' }, features: ['CPU flagship mạnh nhất của Intel', 'Unlocked for extreme overclocking', 'Hiệu suất đa nhân vượt trội', 'Intel UHD Graphics 770', 'Turbo Boost Max 3.0 đến 5.8GHz', 'Yêu cầu tản nhiệt 360mm AIO', 'Tối ưu cho workstation và gaming', 'Hỗ trợ PCIe 5.0 và DDR5-5600'] },
    
    // GPU (5)
    { sku: 'NVIDIA-RTX4060-8GB', name: 'NVIDIA GeForce RTX 4060 8GB', brand: 'NVIDIA', cat: 'GPU - Card đồ họa', priceCents: 8490000, discountPercent: 10, stock: 40, description: 'Ada Lovelace, DLSS 3, gaming Full HD/1440p', imageUrl: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80', images: ['https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80'], specs: { architecture: 'Ada Lovelace', vram: '8GB GDDR6', cuda_cores: '3072', boost_clock: '2460 MHz', power: '115W TDP' } },
    { sku: 'AMD-RX7600-8GB', name: 'AMD Radeon RX 7600 8GB', brand: 'AMD', cat: 'GPU - Card đồ họa', priceCents: 7490000, discountPercent: 12, stock: 35, description: 'RDNA 3, FSR 3, gaming 1080p tốt', imageUrl: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', images: ['https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80', 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80'], specs: { architecture: 'RDNA 3', vram: '8GB GDDR6', stream_processors: '2048', boost_clock: '2655 MHz', power: '165W TDP' } },
    { sku: 'NVIDIA-RTX4070-12GB', name: 'NVIDIA GeForce RTX 4070 12GB', brand: 'NVIDIA', cat: 'GPU - Card đồ họa', priceCents: 14990000, discountPercent: 8, stock: 25, description: 'Ada Lovelace, DLSS 3, gaming 1440p/4K', imageUrl: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80', images: ['https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80'], specs: { architecture: 'Ada Lovelace', vram: '12GB GDDR6X', cuda_cores: '5888', boost_clock: '2475 MHz', power: '200W TDP' } },
    { sku: 'AMD-RX7800XT-16GB', name: 'AMD Radeon RX 7800 XT 16GB', brand: 'AMD', cat: 'GPU - Card đồ họa', priceCents: 13990000, stock: 20, description: 'RDNA 3, FSR 3, gaming 1440p xuất sắc', imageUrl: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', images: ['https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80', 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80'], specs: { architecture: 'RDNA 3', vram: '16GB GDDR6', stream_processors: '3840', boost_clock: '2430 MHz', power: '263W TDP' } },
    { sku: 'NVIDIA-RTX4090-24GB', name: 'NVIDIA GeForce RTX 4090 24GB', brand: 'NVIDIA', cat: 'GPU - Card đồ họa', priceCents: 44990000, stock: 10, description: 'Ada Lovelace, DLSS 3, gaming 4K flagship', imageUrl: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80', images: ['https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80'], specs: { architecture: 'Ada Lovelace', vram: '24GB GDDR6X', cuda_cores: '16384', boost_clock: '2520 MHz', power: '450W TDP' } },
    
    // RAM (5)
    { sku: 'CORSAIR-VENGEANCE-16GB', name: 'Corsair Vengeance RGB 16GB DDR5-6000', brand: 'Corsair', cat: 'RAM - Bộ nhớ', priceCents: 2490000, discountPercent: 10, stock: 60, description: '2x8GB, RGB, Intel XMP 3.0', imageUrl: 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=800&q=80', images: ['https://images.unsplash.com/photo-1562976540-1502c2145186?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80'], specs: { capacity: '16GB (2x8GB)', type: 'DDR5', speed: '6000MHz', latency: 'CL36', rgb: 'Corsair iCUE RGB' }, features: ['DDR5 thế hệ mới với băng thông cao', 'Đèn RGB 10 zone điều khiển qua iCUE', 'Intel XMP 3.0 - overclock 1 click', 'Tản nhiệt nhôm nguyên khối', 'Độ trễ thấp CL36 cho hiệu suất tối ưu'] },
    { sku: 'KINGSTON-FURY-32GB', name: 'Kingston FURY Beast 32GB DDR5-5600', brand: 'Kingston', cat: 'RAM - Bộ nhớ', priceCents: 4290000, discountPercent: 8, stock: 50, description: '2x16GB, Intel XMP, AMD EXPO', imageUrl: 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=800&q=80', images: ['https://images.unsplash.com/photo-1562976540-1502c2145186?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80'], specs: { capacity: '32GB (2x16GB)', type: 'DDR5', speed: '5600MHz', latency: 'CL40', rgb: 'No RGB' }, features: ['Dung lượng 32GB cho đa nhiệm nặng', 'Hỗ trợ cả Intel XMP và AMD EXPO', 'Thiết kế tản nhiệt đơn giản, hiệu quả', 'Tương thích rộng rãi mainboard DDR5', 'Bảo hành trọn đời từ Kingston'] },
    { sku: 'GSKILL-TRIDENT-32GB', name: 'G.Skill Trident Z5 RGB 32GB DDR5-6400', brand: 'G.Skill', cat: 'RAM - Bộ nhớ', priceCents: 5990000, stock: 40, description: '2x16GB, RGB, overclock cao', imageUrl: 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=800&q=80', images: ['https://images.unsplash.com/photo-1562976540-1502c2145186?w=800&q=80', 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80'], specs: { capacity: '32GB (2x16GB)', type: 'DDR5', speed: '6400MHz', latency: 'CL32', rgb: 'Trident Z5 RGB' }, features: ['Tốc độ DDR5-6400 cực nhanh', 'Độ trễ CL32 thấp cho overclocker', 'Đèn RGB đa vùng đồng bộ', 'IC chất lượng cao được chọn lọc', 'Thiết kế tản nhiệt kim loại cao cấp'] },
    { sku: 'CORSAIR-DOMINATOR-64GB', name: 'Corsair Dominator Platinum RGB 64GB DDR5-5600', brand: 'Corsair', cat: 'RAM - Bộ nhớ', priceCents: 9990000, stock: 25, description: '2x32GB, RGB, cao cấp', imageUrl: 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=800&q=80', images: ['https://images.unsplash.com/photo-1562976540-1502c2145186?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1587202372583-49330a15584d?w=800&q=80'], specs: { capacity: '64GB (2x32GB)', type: 'DDR5', speed: '5600MHz', latency: 'CL40', rgb: 'Dominator RGB' }, features: ['Dung lượng khủng 64GB cho workstation', 'Thiết kế Dominator cao cấp với tản nhiệt Dual-Path DHX', 'Đèn RGB 12 LED riêng lẻ điều khiển iCUE', 'IC Samsung B-die chất lượng cao', 'Bảo hành trọn đời Corsair'] },
    { sku: 'TEAM-TFORCE-16GB', name: 'Team T-Force Delta RGB 16GB DDR4-3600', brand: 'Team', cat: 'RAM - Bộ nhớ', priceCents: 1490000, discountPercent: 15, stock: 80, description: '2x8GB, RGB, giá rẻ DDR4', imageUrl: 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=800&q=80', images: ['https://images.unsplash.com/photo-1562976540-1502c2145186?w=800&q=80', 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80'], specs: { capacity: '16GB (2x8GB)', type: 'DDR4', speed: '3600MHz', latency: 'CL18', rgb: 'Delta RGB' }, features: ['Giá cực tốt cho DDR4 RGB', 'Tốc độ 3600MHz phù hợp gaming', 'Đèn RGB 120° rực rỡ', 'Tương thích rộng rãi mainboard DDR4', 'Bảo hành trọn đời'] },
    
    // SSD (4)
    { sku: 'SAMSUNG-980PRO-1TB', name: 'Samsung 980 PRO 1TB NVMe Gen4', brand: 'Samsung', cat: 'SSD - Ổ cứng', priceCents: 2990000, discountPercent: 10, stock: 70, description: 'PCIe 4.0, 7000MB/s read, 5000MB/s write', imageUrl: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&q=80', images: ['https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&q=80', 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80'], specs: { capacity: '1TB', interface: 'PCIe 4.0 x4 NVMe', read_speed: '7000 MB/s', write_speed: '5000 MB/s', warranty: '5 years' }, features: ['Tốc độ đọc 7000 MB/s cực nhanh', 'PCIe 4.0 x4 NVMe thế hệ mới', 'Công nghệ V-NAND của Samsung', 'Bảo hành 5 năm chính hãng', 'Phù hợp gaming và creative work'] },
    { sku: 'WD-BLACK-SN850X-2TB', name: 'WD Black SN850X 2TB NVMe Gen4', brand: 'WD', cat: 'SSD - Ổ cứng', priceCents: 5490000, discountPercent: 8, stock: 50, description: 'PCIe 4.0, 7300MB/s, gaming', imageUrl: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&q=80', images: ['https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&q=80', 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80'], specs: { capacity: '2TB', interface: 'PCIe 4.0 x4 NVMe', read_speed: '7300 MB/s', write_speed: '6600 MB/s', warranty: '5 years' }, features: ['Tốc độ đỉnh cao 7300 MB/s', 'Dung lượng 2TB rộng rãi', 'Tối ưu cho gaming nặng', 'Game Mode 2.0 giảm lag', 'Bảo hành 5 năm WD'] },
    { sku: 'CRUCIAL-P3PLUS-1TB', name: 'Crucial P3 Plus 1TB NVMe Gen4', brand: 'Crucial', cat: 'SSD - Ổ cứng', priceCents: 1890000, discountPercent: 12, stock: 90, description: 'PCIe 4.0, giá rẻ, 5000MB/s', imageUrl: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&q=80', images: ['https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&q=80', 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=800&q=80', 'https://images.unsplash.com/photo-1587202372583-49330a15584d?w=800&q=80'], specs: { capacity: '1TB', interface: 'PCIe 4.0 x4 NVMe', read_speed: '5000 MB/s', write_speed: '4200 MB/s', warranty: '5 years' }, features: ['Giá tốt nhất phân khúc Gen4', 'Tốc độ 5000 MB/s ổn định', 'Tiết kiệm điện năng hiệu quả', 'Độ bền cao từ Micron', 'Bảo hành 5 năm Crucial'] },
    { sku: 'SAMSUNG-870EVO-1TB', name: 'Samsung 870 EVO 1TB SATA SSD', brand: 'Samsung', cat: 'SSD - Ổ cứng', priceCents: 2290000, stock: 60, description: 'SATA 2.5", 560MB/s, tin cậy', imageUrl: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&q=80', images: ['https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80'], specs: { capacity: '1TB', interface: 'SATA III 2.5"', read_speed: '560 MB/s', write_speed: '530 MB/s', warranty: '5 years' }, features: ['SATA SSD tin cậy nhất', 'Tương thích mọi laptop, PC cũ', 'Tốc độ SATA tối đa 560 MB/s', 'Công nghệ V-NAND bền bỉ', 'Bảo hành 5 năm Samsung'] },
    
    // MAINBOARD (4)
    { sku: 'ASUS-B760-PLUS', name: 'Asus Prime B760-Plus D4', brand: 'Asus', cat: 'Mainboard - Bo mạch chủ', priceCents: 3490000, discountPercent: 10, stock: 40, description: 'LGA1700, DDR4, PCIe 5.0', imageUrl: 'https://images.unsplash.com/photo-1587202372583-49330a15584d?w=800&q=80', images: ['https://images.unsplash.com/photo-1587202372583-49330a15584d?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80'], specs: { chipset: 'Intel B760', socket: 'LGA1700', memory_support: 'DDR4 up to 5333MHz', pcie_slots: '1x PCIe 5.0 x16, 2x PCIe 3.0 x1', form_factor: 'ATX' }, features: ['Hỗ trợ CPU Intel thế hệ 12, 13, 14', 'PCIe 5.0 sẵn sàng cho tương lai', 'DDR4 tiết kiệm chi phí', 'AI Noise Cancellation tích hợp', 'Bảo hành 3 năm Asus'] },
    { sku: 'MSI-B650-GAMING', name: 'MSI MAG B650 Tomahawk WiFi', brand: 'MSI', cat: 'Mainboard - Bo mạch chủ', priceCents: 4990000, discountPercent: 8, stock: 35, description: 'AM5, DDR5, WiFi 6E', imageUrl: 'https://images.unsplash.com/photo-1587202372583-49330a15584d?w=800&q=80', images: ['https://images.unsplash.com/photo-1587202372583-49330a15584d?w=800&q=80', 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80'], specs: { chipset: 'AMD B650', socket: 'AM5', memory_support: 'DDR5 up to 6400MHz', pcie_slots: '1x PCIe 4.0 x16, 2x PCIe 4.0 x1', form_factor: 'ATX' }, features: ['Hỗ trợ Ryzen 7000 series', 'WiFi 6E tích hợp sẵn', 'DDR5 tốc độ cao', 'Tản nhiệt VRM mạnh mẽ', 'Audio Boost 5 chất lượng cao'] },
    { sku: 'GIGABYTE-Z790-AORUS', name: 'Gigabyte Z790 Aorus Elite AX', brand: 'Gigabyte', cat: 'Mainboard - Bo mạch chủ', priceCents: 6490000, stock: 25, description: 'LGA1700, DDR5, WiFi 6E, overclock', imageUrl: 'https://images.unsplash.com/photo-1587202372583-49330a15584d?w=800&q=80', images: ['https://images.unsplash.com/photo-1587202372583-49330a15584d?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&q=80'], specs: { chipset: 'Intel Z790', socket: 'LGA1700', memory_support: 'DDR5 up to 7600MHz', pcie_slots: '1x PCIe 5.0 x16, 2x PCIe 4.0 x16', form_factor: 'ATX' }, features: ['Chipset Z790 cao cấp cho overclock', 'DDR5 tốc độ đến 7600MHz', 'WiFi 6E và 2.5GbE LAN', 'RGB Fusion 2.0', 'VRM 16+1+2 phases mạnh mẽ'] },
    { sku: 'ASROCK-X670E-TAICHI', name: 'ASRock X670E Taichi', brand: 'ASRock', cat: 'Mainboard - Bo mạch chủ', priceCents: 12990000, stock: 15, description: 'AM5, DDR5, PCIe 5.0, flagship', imageUrl: 'https://images.unsplash.com/photo-1587202372583-49330a15584d?w=800&q=80', images: ['https://images.unsplash.com/photo-1587202372583-49330a15584d?w=800&q=80', 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80', 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=800&q=80'], specs: { chipset: 'AMD X670E', socket: 'AM5', memory_support: 'DDR5 up to 6600MHz', pcie_slots: '2x PCIe 5.0 x16', form_factor: 'ATX' }, features: ['Flagship X670E cho Ryzen 7000', '2 slot PCIe 5.0 x16 độc quyền', 'VRM 24 phases cực mạnh', 'Polychrome RGB đồng bộ', 'Thiết kế Taichi sang trọng'] },
    
    // CASE (3)
    { sku: 'NZXT-H510-ELITE', name: 'NZXT H510 Elite', brand: 'NZXT', cat: 'Case - Vỏ máy tính', priceCents: 3490000, discountPercent: 10, stock: 30, description: 'Mid Tower, tempered glass, RGB fans', imageUrl: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&q=80', images: ['https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80'], specs: { form_factor: 'Mid Tower', material: 'Steel + Tempered Glass', fans_included: '2x 140mm RGB front, 1x 120mm rear', max_gpu_length: '381mm', max_cpu_cooler: '165mm' }, features: ['Kính cường lực 2 bên đẹp mắt', '2 quạt RGB 140mm tích hợp', 'Khái cable management gọn gàng', 'Hỗ trợ GPU dài đến 381mm', 'Điều khiển RGB qua CAM software'] },
    { sku: 'CORSAIR-4000D-AIRFLOW', name: 'Corsair 4000D Airflow', brand: 'Corsair', cat: 'Case - Vỏ máy tính', priceCents: 2490000, discountPercent: 12, stock: 40, description: 'Mid Tower, airflow tốt, giá tốt', imageUrl: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80', images: ['https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80', 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&q=80', 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80'], specs: { form_factor: 'Mid Tower', material: 'Steel + Tempered Glass', fans_included: '2x 120mm front', max_gpu_length: '360mm', max_cpu_cooler: '170mm' }, features: ['Airflow vượt trội cho tản nhiệt', 'Giá cực tốt phân khúc', 'Kính cường lực 1 bên', 'Dễ lắp ráp và nâng cấp', 'Chất lượng Corsair'] },
    { sku: 'CM-HAF700-EVO', name: 'Cooler Master HAF 700 EVO', brand: 'Cooler Master', cat: 'Case - Vỏ máy tính', priceCents: 14990000, stock: 10, description: 'Full Tower, RGB, cao cấp', imageUrl: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&q=80', images: ['https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80'], specs: { form_factor: 'Full Tower', material: 'Steel + Tempered Glass', fans_included: '3x 200mm ARGB, 1x 140mm ARGB', max_gpu_length: '490mm', max_cpu_cooler: '190mm' }, features: ['Full Tower siêu khủng cho build cao cấp', '4 quạt ARGB 200mm/140mm', 'Hỗ trợ GPU đến 490mm', 'Tản nhiệt đỉnh cao cho workstation', 'Thiết kế HAF huyền thoại'] },
    
    // PSU (3)
    { sku: 'CORSAIR-RM750E', name: 'Corsair RM750e 750W 80+ Gold', brand: 'Corsair', cat: 'PSU - Nguồn máy tính', priceCents: 2490000, discountPercent: 10, stock: 50, description: 'Modular, 80+ Gold, 10 năm BH', imageUrl: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800&q=80', images: ['https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80'], specs: { wattage: '750W', efficiency: '80+ Gold', modular: 'Fully Modular', pcie_connectors: '4x PCIe 8-pin', warranty: '10 years' }, features: ['Hiệu suất 80+ Gold tiết kiệm điện', 'Fully Modular gọn gàng dây', 'Bảo hành 10 năm Corsair', 'Quạt 135mm yên tĩnh', 'Phù hợp build gaming thông thường'] },
    { sku: 'BEQUIET-PURE-850W', name: 'be quiet! Pure Power 12 M 850W', brand: 'be quiet!', cat: 'PSU - Nguồn máy tính', priceCents: 3290000, discountPercent: 8, stock: 40, description: 'Modular, 80+ Gold, yên tĩnh', imageUrl: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800&q=80', images: ['https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800&q=80', 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80'], specs: { wattage: '850W', efficiency: '80+ Gold', modular: 'Fully Modular', pcie_connectors: '4x PCIe 8-pin', warranty: '10 years' }, features: ['Thương hiệu yên tĩnh số 1 thế giới', '850W cho build cao cấp', 'Quạt 120mm siêu yên tĩnh', 'Hiệu suất 80+ Gold', 'Bảo hành 10 năm'] },
    { sku: 'CORSAIR-HX1000I', name: 'Corsair HX1000i 1000W 80+ Platinum', brand: 'Corsair', cat: 'PSU - Nguồn máy tính', priceCents: 5990000, stock: 20, description: 'Digital monitoring, Platinum, cao cấp', imageUrl: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800&q=80', images: ['https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80', 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=800&q=80'], specs: { wattage: '1000W', efficiency: '80+ Platinum', modular: 'Fully Modular', pcie_connectors: '6x PCIe 8-pin', warranty: '10 years' }, features: ['1000W cho build workstation', 'Hiệu suất 80+ Platinum', 'Giám sát digital qua Corsair Link', '6 dây PCIe cho GPU đa', 'Bảo hành 10 năm'] },
    
    // COOLING (3)
    { sku: 'CM-HYPER212', name: 'Cooler Master Hyper 212 RGB Black', brand: 'Cooler Master', cat: 'Cooling - Tản nhiệt', priceCents: 790000, discountPercent: 15, stock: 80, description: 'Air cooler, RGB, giá rẻ', imageUrl: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', images: ['https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80', 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=800&q=80'], specs: { type: 'Air Cooler', fan_size: '120mm RGB', tdp_rating: '150W', height: '158mm', socket_support: 'Intel LGA1700/1200, AMD AM5/AM4' }, features: ['Giá rẻ nhất cho build cơ bản', 'Quạt RGB đẹp mắt', 'Dễ lắp đặt cho người mới', 'Tản được CPU phổ thông', 'Thương hiệu nổi tiếng'] },
    { sku: 'NZXT-KRAKEN-X63', name: 'NZXT Kraken X63 RGB 280mm AIO', brand: 'NZXT', cat: 'Cooling - Tản nhiệt', priceCents: 4290000, discountPercent: 10, stock: 40, description: '280mm AIO, RGB, LCD display', imageUrl: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80', images: ['https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&q=80'], specs: { type: 'AIO Liquid Cooler', radiator_size: '280mm', fan_size: '2x 140mm RGB', tdp_rating: '250W', socket_support: 'Intel LGA1700/1200, AMD AM5/AM4' }, features: ['AIO 280mm hiệu năng cao', 'Màn hình LCD hiển thị GIF', 'Điều khiển qua NZXT CAM', 'RGB đồng bộ toàn hệ thống', 'Thiết kế đẹp mắt'] },
    { sku: 'CORSAIR-H150I-ELITE', name: 'Corsair iCUE H150i Elite LCD 360mm', brand: 'Corsair', cat: 'Cooling - Tản nhiệt', priceCents: 7990000, stock: 25, description: '360mm AIO, LCD screen, cao cấp', imageUrl: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80', images: ['https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80', 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80'], specs: { type: 'AIO Liquid Cooler', radiator_size: '360mm', fan_size: '3x 120mm RGB', tdp_rating: '300W', socket_support: 'Intel LGA1700/1200, AMD AM5/AM4' }, features: ['AIO 360mm cao cấp nhất', 'Màn hình LCD 2.1 inch hiển thị', 'Tản nhiệt cho CPU overclock', 'Điều khiển RGB qua iCUE', 'Bảo hành 5 năm'] },
    
    // MONITOR (4)
    { sku: 'LG-27GL850', name: 'LG UltraGear 27GL850 27" 144Hz', brand: 'LG', cat: 'Monitor - Màn hình', priceCents: 7490000, discountPercent: 10, stock: 30, description: 'QHD 1440p, Nano IPS, 1ms, G-Sync', imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80', images: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80', 'https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80'], specs: { size: '27 inch', resolution: '2560x1440 (QHD)', panel: 'Nano IPS', refresh_rate: '144Hz', response_time: '1ms GtG', sync: 'G-Sync Compatible' }, features: ['Nano IPS màu sắc chuẩn 98% DCI-P3', '144Hz mượt mà cho gaming', 'G-Sync chống giật', 'Thiết kế gọn gàng đẹp', 'Phù hợp cả gaming và làm việc'] },
    { sku: 'SAMSUNG-G7-32', name: 'Samsung Odyssey G7 32" 240Hz Curved', brand: 'Samsung', cat: 'Monitor - Màn hình', priceCents: 12990000, discountPercent: 8, stock: 20, description: 'QHD, VA 1000R curve, HDR600', imageUrl: 'https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=800&q=80', images: ['https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=800&q=80', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80'], specs: { size: '32 inch', resolution: '2560x1440 (QHD)', panel: 'VA Curved 1000R', refresh_rate: '240Hz', response_time: '1ms', sync: 'G-Sync + FreeSync Premium Pro' }, features: ['Màn 32 inch 240Hz cho gaming chuyên sâu', 'Màn cong 1000R몰입감 cao', 'HDR 600 màu sắc sống động', 'G-Sync và FreeSync đầy đủ', 'Độ phân giải 1440p tối ưu'] },
    { sku: 'DELL-S2722DGM', name: 'Dell S2722DGM 27" 165Hz Curved', brand: 'Dell', cat: 'Monitor - Màn hình', priceCents: 5990000, discountPercent: 12, stock: 40, description: 'QHD, VA curve, giá tốt', imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80', images: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80', 'https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80'], specs: { size: '27 inch', resolution: '2560x1440 (QHD)', panel: 'VA Curved 1500R', refresh_rate: '165Hz', response_time: '1ms MPRT', sync: 'FreeSync Premium' }, features: ['Giá tốt nhất cho màn cong 1440p', 'Màn cong몰입감 tốt', '165Hz mượt mà đủ dùng', 'Chất lượng Dell uy tín', 'FreeSync cho AMD GPU'] },
    { sku: 'AOC-24G2', name: 'AOC 24G2 24" 144Hz IPS', brand: 'AOC', cat: 'Monitor - Màn hình', priceCents: 3990000, discountPercent: 15, stock: 50, description: 'Full HD, IPS, giá sinh viên', imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80', images: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=800&q=80'], specs: { size: '24 inch', resolution: '1920x1080 (Full HD)', panel: 'IPS', refresh_rate: '144Hz', response_time: '1ms MPRT', sync: 'FreeSync Premium' }, features: ['Giá rẻ nhất cho màn 144Hz IPS', 'IPS màu sắc sống động', 'Kích thước 24 inch vừa đủ', 'Phù hợp sinh viên, gaming nhẹ', 'FreeSync cho mượt mà'] },
    
    // KEYBOARD (3)
    { sku: 'LOGITECH-G512', name: 'Logitech G512 Carbon RGB', brand: 'Logitech', cat: 'Keyboard - Bàn phím', priceCents: 2290000, discountPercent: 10, stock: 40, description: 'Mechanical, GX Brown, RGB', imageUrl: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&q=80', images: ['https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&q=80', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80'], specs: { type: 'Mechanical Gaming', switch: 'GX Brown Tactile', rgb: 'Per-key RGB Lightsync', connectivity: 'USB Wired', features: 'Aircraft-grade aluminum' }, features: ['Switch GX Brown êm và tiếng nhỏ', 'RGB Lightsync đồng bộ toàn hệ thống', 'Khung nhôm aircraft-grade bền bỉ', 'Phù hợp cả gaming và làm việc', 'Chất lượng Logitech'] },
    { sku: 'RAZER-BLACKWIDOW-V3', name: 'Razer BlackWidow V3 Pro', brand: 'Razer', cat: 'Keyboard - Bàn phím', priceCents: 4790000, discountPercent: 8, stock: 25, description: 'Wireless, Green switch, RGB', imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80', images: ['https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80', 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80'], specs: { type: 'Mechanical Gaming', switch: 'Razer Green Clicky', actuation_force: '50g', actuation_point: '1.9mm', rgb: 'Razer Chroma RGB', connectivity: 'Wireless 2.4GHz + Bluetooth + USB-C Wired', battery: '200 hours', features: 'Doubleshot ABS keycaps' }, features: ['Kết nối 3 chế độ: 2.4GHz/Bluetooth/Có dây', 'Switch Razer Green clicky tactile đặc trưng', 'Chroma RGB 16.8 triệu màu per-key', 'Pin siêu trâu 200 giờ liên tục', 'Keycap Doubleshot ABS không phai màu', 'Full-size 104 phím đầy đủ chức năng'] },
    { sku: 'STEELSERIES-APEX-PRO', name: 'SteelSeries Apex Pro TKL', brand: 'SteelSeries', cat: 'Keyboard - Bàn phím', priceCents: 3990000, stock: 30, description: 'OmniPoint switch, tenkeyless', imageUrl: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&q=80', images: ['https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80'], specs: { type: 'Mechanical Gaming', switch: 'OmniPoint Adjustable', rgb: 'Per-key RGB', connectivity: 'USB Wired', actuation: '0.4mm - 3.6mm adjustable', features: 'Magnetic switches, OLED display' }, features: ['Switch OmniPoint từ tính điều chỉnh được', 'Tùy chỉnh độ nhạy từ 0.4mm đến 3.6mm', 'Màn hình OLED hiển thị thông tin', 'TKL compact tiết kiệm không gian', 'Khung nhôm cao cấp siêu bền', 'RGB per-key Prism Sync đồng bộ'] },
    
    // MOUSE (3)
    { sku: 'LOGITECH-G502-HERO', name: 'Logitech G502 HERO', brand: 'Logitech', cat: 'Mouse - Chuột', priceCents: 1290000, discountPercent: 15, stock: 60, description: '25K DPI, 11 buttons, RGB', imageUrl: 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=800&q=80', images: ['https://images.unsplash.com/photo-1527814050087-3793815479db?w=800&q=80', 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80'], specs: { sensor: 'HERO 25K', dpi: '100 - 25600 DPI', max_speed: '400 IPS', max_acceleration: '40G', buttons: '11 programmable', weight: '121g (adjustable)', rgb: 'Lightsync RGB', connectivity: 'USB Wired', polling_rate: '1000Hz' }, features: ['Sensor HERO 25K siêu chính xác 1:1 tracking', '11 nút lập trình tùy biến hoàn toàn', 'Hệ thống tăng giảm DPI nhanh on-the-fly', 'Trọng lượng điều chỉnh được bằng quả cân', 'RGB Lightsync đồng bộ với thiết bị Logitech', 'Giá tốt nhất cho gaming mouse cao cấp'] },
    { sku: 'RAZER-DEATHADDER-V3', name: 'Razer DeathAdder V3 Pro', brand: 'Razer', cat: 'Mouse - Chuột', priceCents: 3490000, discountPercent: 10, stock: 35, description: 'Wireless, 30K DPI, 90h battery', imageUrl: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&q=80', images: ['https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&q=80', 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80'], specs: { sensor: 'Focus Pro 30K Optical', dpi: '100 - 30000 DPI', max_speed: '750 IPS', resolution_accuracy: '99.8%', buttons: '8 programmable', weight: '63g', rgb: 'Razer Chroma RGB (logo only)', connectivity: 'HyperSpeed Wireless 2.4GHz + USB-C Wired', battery: '90 hours', polling_rate: '1000Hz / 4000Hz HyperPolling' }, features: ['Sensor Focus Pro 30K mới nhất thế hệ Gen-3', 'Siêu nhẹ chỉ 63g cho esports', 'Pin 90 giờ liên tục cực trâu', 'HyperSpeed Wireless nhanh như có dây', 'Thiết kế ergonomic thoải mái cho tay phải', 'DeathAdder V3 - huyền thoại tiếp nối'] },
    { sku: 'STEELSERIES-RIVAL3', name: 'SteelSeries Rival 3', brand: 'SteelSeries', cat: 'Mouse - Chuột', priceCents: 690000, discountPercent: 20, stock: 80, description: 'TrueMove Core, giá rẻ', imageUrl: 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=800&q=80', images: ['https://images.unsplash.com/photo-1527814050087-3793815479db?w=800&q=80', 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80'], specs: { sensor: 'TrueMove Core', dpi: '200 - 8500 CPI', max_speed: '300 IPS', buttons: '6 programmable', weight: '77g', rgb: 'Prism RGB 3-zone', connectivity: 'USB Wired', polling_rate: '1000Hz', durability: '60 million clicks' }, features: ['Giá rẻ nhất trong phân khúc gaming mouse', 'Sensor TrueMove Core 1:1 tracking chính xác', 'RGB Prism 3 vùng sáng đẹp mắt', 'Nhẹ nhàng 77g thoải mái cả ngày', 'Switches bền 60 triệu lần nhấn', 'Phù hợp sinh viên, game thủ mới bắt đầu'] },
    
    // HEADSET (3)
    { sku: 'HYPERX-CLOUD2', name: 'HyperX Cloud II', brand: 'HyperX', cat: 'Headset - Tai nghe', priceCents: 1790000, discountPercent: 12, stock: 50, description: '7.1 surround, memory foam, USB', imageUrl: 'https://images.unsplash.com/photo-1599669454699-248893623440?w=800&q=80', images: ['https://images.unsplash.com/photo-1599669454699-248893623440?w=800&q=80', 'https://images.unsplash.com/photo-1545127398-14699f92334b?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80'], specs: { type: 'Gaming Headset', driver: '53mm neodymium', frequency_response: '15Hz - 25000Hz', impedance: '60 Ohms', surround: 'Virtual 7.1 Surround Sound', microphone: 'Detachable noise-cancelling', mic_frequency: '50Hz - 18000Hz', connectivity: 'USB Sound Card + 3.5mm', cable_length: '1m + 2m extension', weight: '320g' }, features: ['Đệm tai memory foam siêu êm đeo cả ngày', 'Driver 53mm âm thanh Hi-Fi chất lượng cao', 'Âm thanh vòm 7.1 ảo qua USB soundcard', 'Micro chống ồn tháo rời TeamSpeak certified', 'Khung nhôm bền bỉ siêu chắc chắn', 'Tương thích đa nền tảng PC, PS4/5, Xbox, Switch'] },
    { sku: 'RAZER-BLACKSHARK-V2-PRO', name: 'Razer BlackShark V2 Pro', brand: 'Razer', cat: 'Headset - Tai nghe', priceCents: 3990000, discountPercent: 8, stock: 30, description: 'Wireless, THX Spatial, 24h battery', imageUrl: 'https://images.unsplash.com/photo-1545127398-14699f92334b?w=800&q=80', images: ['https://images.unsplash.com/photo-1545127398-14699f92334b?w=800&q=80', 'https://images.unsplash.com/photo-1599669454699-248893623440?w=800&q=80', 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80'], specs: { type: 'Wireless Gaming Headset', driver: 'Razer TriForce Titanium 50mm', frequency_response: '12Hz - 28000Hz', impedance: '32 Ohms', surround: 'THX Spatial Audio', microphone: 'HyperClear Supercardioid Detachable', mic_frequency: '100Hz - 10000Hz', mic_pattern: 'Unidirectional', connectivity: 'Razer HyperSpeed Wireless 2.4GHz + USB-C Wired', battery: '24 hours (70 hours THX off)', weight: '320g', earcups: 'FlowKnit Memory Foam' }, features: ['Không dây HyperSpeed 2.4GHz độ trễ cực thấp', 'THX Spatial Audio định vị kẻ địch chính xác', 'Pin 24 giờ liên tục (70h khi tắt THX)', 'Driver TriForce Titanium 50mm âm bass sâu', 'Micro HyperClear Supercardioid chống ồn tốt', 'Đệm tai FlowKnit Memory Foam thoáng mát', 'Nhẹ 320g đeo thoải mái cả ngày'] },
    { sku: 'STEELSERIES-ARCTIS-7PLUS', name: 'SteelSeries Arctis 7+', brand: 'SteelSeries', cat: 'Headset - Tai nghe', priceCents: 3290000, stock: 35, description: 'Wireless, 30h battery, retractable mic', imageUrl: 'https://images.unsplash.com/photo-1599669454699-248893623440?w=800&q=80', images: ['https://images.unsplash.com/photo-1599669454699-248893623440?w=800&q=80', 'https://images.unsplash.com/photo-1545127398-14699f92334b?w=800&q=80', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80'], specs: { type: 'Wireless Gaming Headset', driver: '40mm neodymium', frequency_response: '20Hz - 20000Hz', impedance: '32 Ohms', surround: 'DTS Headphone:X v2.0', microphone: 'ClearCast Retractable Bidirectional', mic_frequency: '100Hz - 6500Hz', mic_sensitivity: '-38dB', connectivity: 'SteelSeries Sonar Wireless 2.4GHz + USB-C + 3.5mm', battery: '30 hours', fast_charge: '15 min = 3 hours', weight: '350g', earcups: 'AirWeave Memory Foam' }, features: ['Pin 30 giờ siêu trâu + sạc nhanh 15 phút = 3 giờ', 'Micro ClearCast rút gọn tiện lợi Discord certified', 'DTS Headphone:X v2.0 âm thanh vòm 7.1 sống động', 'Kết nối không dây 2.4GHz ổn định zero lag', 'Băng đầu treo SKI Goggle siêu thoải mái', 'Đệm tai AirWeave thoáng mát không nóng', 'Tương thích PC, PlayStation, Nintendo Switch'] }
  ];

  // Thay vì xóa tất cả, chúng ta sẽ UPDATE nếu SKU trùng hoặc tạo mới nếu chưa có
  const { data: current } = await admin.get('/admin/catalog/products?pageSize=1000');
  const existingProducts = Array.isArray(current) ? current : (current?.items || []);
  const existingBySku = new Map(existingProducts.map(p => [p.sku?.toUpperCase(), p]));
  console.log(`Tìm thấy ${existingProducts.length} sản phẩm hiện có`);

  // Thêm hoặc cập nhật sản phẩm
  console.log(`Thêm/cập nhật ${products.length} sản phẩm`);
  let successCount = 0;
  let updateCount = 0;
  let createCount = 0;
  let failCount = 0;
  const createdProductIds = [];
  
  for (const p of products) {
    try {
      const skuUpper = p.sku?.toUpperCase();
      const existing = existingBySku.get(skuUpper);
      
      if (existing) {
        // UPDATE sản phẩm đã tồn tại
        try {
          const updateResponse = await admin.put(`/admin/catalog/products/${existing.id}`, {
            name: p.name,
            brandId: brandByName[p.brand] || null,
            categoryId: catByName[p.cat] || null,
            priceCents: p.priceCents,
            discountPercent: p.discountPercent || 0,
            stock: p.stock,
            description: p.description,
            imageUrl: p.imageUrl,
            images: p.images || [],
            specs: p.specs || {},
            features: p.features || []
          });
          if (updateResponse.status >= 200 && updateResponse.status < 300) {
            successCount++;
            updateCount++;
            createdProductIds.push({ id: existing.id, name: p.name, category: p.cat });
          } else {
            // Nếu UPDATE thất bại, thử tạo mới với SKU khác
            throw new Error(`Update failed: ${updateResponse.status}`);
          }
        } catch (updateError) {
          // Nếu UPDATE thất bại, thử tạo mới với SKU mới (thêm timestamp)
          const newSku = `${p.sku}-${Date.now()}`;
          const createResponse = await admin.post('/admin/catalog/products', {
            sku: newSku,
            name: p.name,
            brandId: brandByName[p.brand] || null,
            categoryId: catByName[p.cat] || null,
            priceCents: p.priceCents,
            discountPercent: p.discountPercent || 0,
            stock: p.stock,
            description: p.description,
            imageUrl: p.imageUrl,
            images: p.images || [],
            specs: p.specs || {},
            features: p.features || []
          });
          if (createResponse.status >= 200 && createResponse.status < 300) {
            successCount++;
            createCount++;
            createdProductIds.push({ id: createResponse.data.id, name: p.name, category: p.cat });
          } else {
            failCount++;
            if (failCount <= 3) {
              console.warn(`Failed to create/update product "${p.name}": ${createResponse.status} - ${JSON.stringify(createResponse.data)}`);
            }
          }
        }
      } else {
        // Tạo mới sản phẩm
        const response = await admin.post('/admin/catalog/products', {
          sku: p.sku,
          name: p.name,
          brandId: brandByName[p.brand] || null,
          categoryId: catByName[p.cat] || null,
          priceCents: p.priceCents,
          discountPercent: p.discountPercent || 0,
          stock: p.stock,
          description: p.description,
          imageUrl: p.imageUrl,
          images: p.images || [],
          specs: p.specs || {},
          features: p.features || []
        });
        if (response.status >= 200 && response.status < 300) {
          successCount++;
          createCount++;
          createdProductIds.push({ id: response.data.id, name: p.name, category: p.cat });
        } else {
          failCount++;
          if (failCount <= 3) {
            console.warn(`Failed to create product "${p.name}": ${response.status} - ${JSON.stringify(response.data)}`);
          }
        }
      }
      
      // Thêm delay nhỏ giữa các requests để tránh rate limiting
      if (successCount % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      failCount++;
      if (failCount <= 3) {
        console.warn(`Error processing product "${p.name}":`, error.message);
        if (error.response) {
          console.warn(`Response: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        }
      }
    }
  }
  console.log(`${successCount}/${products.length} sản phẩm thành công (${createCount} tạo mới, ${updateCount} cập nhật, ${failCount} thất bại) - ${categories.length} danh mục`);
  
  // Tạo variants cho một số sản phẩm (ít nhất 2 variants mỗi sản phẩm)
  await seedVariants(admin, createdProductIds);
  
  return createdProductIds;
}

async function seedVariants(admin, productIds) {
  console.log('  → Tạo variants cho sản phẩm');
  let variantCount = 0;
  let variantErrorCount = 0;
  let skippedCount = 0;
  
  // Chọn một số sản phẩm để tạo variants (ưu tiên laptop và CPU)
  const productsToVariant = productIds.filter(p => 
    p.category.includes('Laptop') || 
    p.category.includes('CPU') || 
    p.category.includes('GPU') ||
    p.category.includes('RAM') ||
    p.category.includes('SSD')
  ).slice(0, 15); // Tạo variants cho 15 sản phẩm đầu tiên
  
  // Helper function để retry với exponential backoff
  async function createVariantWithRetry(productId, variant, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Delay tăng dần: 200ms, 500ms, 1000ms
        if (attempt > 0) {
          const delay = Math.min(200 * Math.pow(2, attempt - 1), 1000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const response = await admin.post(`/admin/catalog/products/${productId}/variants`, variant);
        if (response.status >= 200 && response.status < 300) {
          return { success: true };
        } else if (response.status === 503) {
          // Service unavailable - retry
          if (attempt < maxRetries - 1) {
            continue;
          }
          return { success: false, error: `503 - ${JSON.stringify(response.data)}` };
        } else {
          return { success: false, error: `${response.status} - ${JSON.stringify(response.data)}` };
        }
      } catch (err) {
        if (attempt < maxRetries - 1 && (err.response?.status === 503 || err.code === 'ECONNRESET')) {
          continue; // Retry on 503 or connection reset
        }
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: 'Max retries exceeded' };
  }
  
  // Lấy thông tin giá từ database
  for (const product of productsToVariant) {
    try {
      // Delay nhỏ giữa các products để tránh quá tải
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Lấy thông tin product từ API để có price và variants hiện có
      const productRes = await admin.get(`/catalog/products/${product.id}`);
      const productData = productRes.data;
      const basePrice = productData?.price_cents || 20000000;
      const existingVariants = productData?.variants || [];
      
      // Nếu đã có ít nhất 2 variants, bỏ qua (đã đủ yêu cầu)
      // Nếu chưa có hoặc có ít hơn 2, tạo thêm để đảm bảo có ít nhất 2 variants
      if (existingVariants.length >= 2) {
        skippedCount++;
        continue; // Bỏ qua products đã có đủ variants
      }
      
      // Tính số variants cần tạo (đảm bảo có ít nhất 2)
      const neededVariants = Math.max(2 - existingVariants.length, 0);
      if (neededVariants === 0) {
        skippedCount++;
        continue;
      }
      
      // Tạo 2-3 variants cho mỗi sản phẩm
      const variants = generateVariantsForProduct({ ...product, priceCents: basePrice });
      const variantsToCreate = variants.slice(0, neededVariants);
      
      for (const variant of variantsToCreate) {
        const result = await createVariantWithRetry(product.id, variant);
        if (result.success) {
          variantCount++;
        } else {
          variantErrorCount++;
          if (variantErrorCount <= 5) {
            console.warn(`    Failed to create variant for product ${product.id} (${product.name}): ${result.error}`);
          }
        }
        
        // Delay giữa các variants
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    } catch (err) {
      variantErrorCount++;
      if (variantErrorCount <= 5) {
        console.warn(`    Failed to get/create variants for product ${product.id}:`, err.message);
      }
    }
  }
  
  console.log(`   Tạo ${variantCount} variants cho ${productsToVariant.length - skippedCount} sản phẩm (${skippedCount} đã có đủ variants, ${variantErrorCount} lỗi)`);
}

function generateVariantsForProduct(product) {
  const variants = [];
  const category = product.category || '';
  
  if (category.includes('Laptop')) {
    // Laptop variants: RAM + Storage
    variants.push(
      {
        name: '16GB RAM / 512GB SSD',
        priceCents: product.priceCents || 20000000,
        discountPercent: 0,
        attributes: { ram: '16GB', storage: '512GB SSD' },
        stock: 10,
        displayOrder: 1
      },
      {
        name: '32GB RAM / 1TB SSD',
        priceCents: (product.priceCents || 20000000) + 5000000,
        discountPercent: 5,
        attributes: { ram: '32GB', storage: '1TB SSD' },
        stock: 5,
        displayOrder: 2
      },
      {
        name: '16GB RAM / 256GB SSD',
        priceCents: (product.priceCents || 20000000) - 2000000,
        discountPercent: 0,
        attributes: { ram: '16GB', storage: '256GB SSD' },
        stock: 15,
        displayOrder: 0
      }
    );
  } else if (category.includes('CPU')) {
    // CPU variants: Box vs Tray
    variants.push(
      {
        name: 'Box (Có quạt tản nhiệt)',
        priceCents: product.priceCents || 5000000,
        discountPercent: 0,
        attributes: { type: 'Box', cooler: 'Included' },
        stock: 20,
        displayOrder: 1
      },
      {
        name: 'Tray (Không có quạt)',
        priceCents: (product.priceCents || 5000000) - 500000,
        discountPercent: 0,
        attributes: { type: 'Tray', cooler: 'Not Included' },
        stock: 15,
        displayOrder: 2
      }
    );
  } else if (category.includes('GPU')) {
    // GPU variants: Brand models
    variants.push(
      {
        name: 'ASUS Dual',
        priceCents: product.priceCents || 10000000,
        discountPercent: 5,
        attributes: { model: 'ASUS Dual', cooling: 'Dual Fan' },
        stock: 8,
        displayOrder: 1
      },
      {
        name: 'MSI Gaming X',
        priceCents: (product.priceCents || 10000000) + 2000000,
        discountPercent: 0,
        attributes: { model: 'MSI Gaming X', cooling: 'Triple Fan' },
        stock: 5,
        displayOrder: 2
      },
      {
        name: 'Gigabyte Windforce',
        priceCents: (product.priceCents || 10000000) + 1000000,
        discountPercent: 3,
        attributes: { model: 'Gigabyte Windforce', cooling: 'Triple Fan' },
        stock: 7,
        displayOrder: 3
      }
    );
  } else if (category.includes('RAM')) {
    // RAM variants: Capacity
    variants.push(
      {
        name: '16GB (2x8GB)',
        priceCents: product.priceCents || 2000000,
        discountPercent: 0,
        attributes: { capacity: '16GB', kit: '2x8GB' },
        stock: 30,
        displayOrder: 1
      },
      {
        name: '32GB (2x16GB)',
        priceCents: (product.priceCents || 2000000) * 1.8,
        discountPercent: 5,
        attributes: { capacity: '32GB', kit: '2x16GB' },
        stock: 20,
        displayOrder: 2
      }
    );
  } else if (category.includes('SSD')) {
    // SSD variants: Capacity
    variants.push(
      {
        name: '500GB',
        priceCents: (product.priceCents || 3000000) * 0.6,
        discountPercent: 0,
        attributes: { capacity: '500GB' },
        stock: 40,
        displayOrder: 1
      },
      {
        name: '1TB',
        priceCents: product.priceCents || 3000000,
        discountPercent: 0,
        attributes: { capacity: '1TB' },
        stock: 30,
        displayOrder: 2
      },
      {
        name: '2TB',
        priceCents: (product.priceCents || 3000000) * 1.8,
        discountPercent: 8,
        attributes: { capacity: '2TB' },
        stock: 15,
        displayOrder: 3
      }
    );
  } else {
    // Default: Color variants
    variants.push(
      {
        name: 'Đen',
        priceCents: product.priceCents || 1000000,
        discountPercent: 0,
        attributes: { color: 'Đen' },
        stock: 20,
        displayOrder: 1
      },
      {
        name: 'Trắng',
        priceCents: product.priceCents || 1000000,
        discountPercent: 0,
        attributes: { color: 'Trắng' },
        stock: 15,
        displayOrder: 2
      }
    );
  }
  
  return variants;
}

async function clearUserCart(userEmail, password) {
  try {
    const { token } = await login(userEmail, password);
    const cli = client(token);
    const { data: cart } = await cli.get('/cart');
    const items = cart?.items || [];
    for (const item of items) {
      await cli.delete(`/cart/items/${item.id}`);
    }
  } catch (error) {}
}

async function seedDemoOrders(userEmail, password) {
  try {
    const { token } = await login(userEmail, password);
    const cli = client(token);
    const prodsResponse = await cli.get('/catalog/products');
    if (prodsResponse.status >= 400) return;
    const prodList = prodsResponse.data?.items || prodsResponse.data || [];
    if (prodList.length === 0) return;
    const pick = prodList.slice(0, 2).map((p, i) => {
      const originalPrice = p.price_cents || 0;
      const discountPercent = p.discount_percent || 0;
      const finalPrice = Math.round(originalPrice * (100 - discountPercent) / 100);
      return { productId: p.id, quantity: i + 1, priceCents: finalPrice };
    });
    const { data: order } = await cli.post('/orders/checkout', { items: pick });
    await cli.post(`/orders/${order.orderId}/pay`, { intentId: order.paymentIntentId });
  } catch (error) {}
}

async function seedBanners(admin) {
  const banners = [
    { title: 'Laptop Gaming Đỉnh Cao', subtitle: 'RTX 4000 Series - Chiến mọi game AAA 144fps', imageUrl: 'https://images.unsplash.com/photo-1603481588273-2f908a9a7a1b?w=1920&h=600&fit=crop&q=80', linkUrl: '/products?categoryId=1', active: true, displayOrder: 1 },
    { title: 'CPU AMD Ryzen 7000', subtitle: 'Zen 4 - Hiệu năng vượt trội - Giá tốt nhất', imageUrl: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=1920&h=600&fit=crop&q=80', linkUrl: '/products?categoryId=5', active: true, displayOrder: 2 },
    { title: 'GPU RTX 4070 Ti', subtitle: 'DLSS 3 - Gaming 4K mượt mà', imageUrl: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=1920&h=600&fit=crop&q=80', linkUrl: '/products?categoryId=6', active: true, displayOrder: 3 },
    { title: 'RAM DDR5 Giá Sốc', subtitle: 'Kingston, Corsair - Giảm đến 20%', imageUrl: 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=1920&h=600&fit=crop&q=80', linkUrl: '/products?categoryId=7', active: true, displayOrder: 4 },
    { title: 'Monitor Gaming 240Hz', subtitle: 'QHD - G-Sync - Màu chuẩn', imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=1920&h=600&fit=crop&q=80', linkUrl: '/products?categoryId=13', active: true, displayOrder: 5 },
    { title: 'Gear Gaming Giá Rẻ', subtitle: 'Keyboard, Mouse, Headset - Từ 690K', imageUrl: 'https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=1920&h=600&fit=crop&q=80', linkUrl: '/products?minPrice=0&maxPrice=2000000', active: true, displayOrder: 6 }
  ];
  try {
    const bannerResponse = await admin.get('/admin/banners');
    const existingBanners = bannerResponse.data;
    const existing = Array.isArray(existingBanners) ? existingBanners : (existingBanners?.items || []);
    if (existing.length === 0) {
      console.log('  → Thêm banners');
      for (const banner of banners) await admin.post('/admin/banners', banner);
      console.log(`   Tạo ${banners.length} banners`);
    } else {
      console.log(` Đã có ${existing.length} banners`);
    }
  } catch (error) {
    console.warn(`    Không thể kiểm tra/tạo banners`);
  }
}

async function seedReviews() {
  console.log('  → Tạo demo reviews với ratings đa dạng');
  try {
    const { token: user1Token, userId: user1Id } = await login('tendemten051512@gmail.com', '123456');
    const user1Cli = client(user1Token);
    const { data: products } = await user1Cli.get('/catalog/products?limit=100');
    const productList = products?.items || products || [];
    if (productList.length === 0) return;
    
    const sampleReviews = [
      { rating: 5, comment: 'Sản phẩm tuyệt vời! Chất lượng xuất sắc, giao hàng nhanh. Recommend!' },
      { rating: 5, comment: 'Quá hài lòng! Chính xác như mô tả. 5 sao không cần bàn cãi!' },
      { rating: 4, comment: 'Sản phẩm tốt trong tầm giá. Hiệu năng ổn, đáng mua.' },
      { rating: 4, comment: 'Chất lượng OK, giá cả hợp lý. Sẽ ủng hộ shop.' },
      { rating: 4, comment: 'Tốt, đáp ứng kỳ vọng. Giao hàng đúng hẹn.' },
      { rating: 3, comment: 'Ổn, không có gì đặc biệt. Giá hơi cao so với chất lượng.' },
      { rating: 3, comment: 'Sản phẩm tạm được, nhưng có thể tốt hơn.' },
      { rating: 2, comment: 'Không như mong đợi. Có một số vấn đề nhỏ.' },
      { rating: 1, comment: 'Rất thất vọng. Sản phẩm không đúng mô tả.' },
      { rating: 5, comment: 'Xuất sắc! Vượt quá mong đợi. Đáng giá từng đồng!' },
      { rating: 4, comment: 'Tốt, nhưng có thể cải thiện thêm.' },
      { rating: 5, comment: 'Hoàn hảo! Mua ngay không cần suy nghĩ!' }
    ];
    
    let reviewCount = 0;
    // Tạo nhiều reviews hơn để test pagination và filter
    for (let i = 0; i < Math.min(productList.length, 30); i++) {
      const productId = productList[i].id;
      // Tạo 2-4 reviews cho mỗi sản phẩm để có đủ data test
      const numReviews = Math.floor(Math.random() * 3) + 2; // 2-4 reviews
      
      for (let j = 0; j < numReviews; j++) {
        try {
          const review = sampleReviews[(i * numReviews + j) % sampleReviews.length];
          const response = await user1Cli.post(`/catalog/products/${productId}/reviews`, { 
            userId: user1Id, 
            rating: review.rating,
            comment: review.comment + ` (Review ${j + 1} cho sản phẩm ${i + 1})`
          });
          if (response.status < 400) reviewCount++;
        } catch (err) { }
      }
    }
    console.log(`   Tạo ${reviewCount} reviews với ratings từ 1-5 sao`);
  } catch (err) {
    console.warn(`    Lỗi tạo reviews:`, err.message);
  }
}

async function main() {
  console.log(' Seed GearUp database với 60+ sản phẩm đa dạng...');
  
  const adminEmail = process.env.ADMIN_EMAIL || 'tenho051512@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
  
  // Create regular users
  await signupUser('tendemten051512@gmail.com', '123456', 'Nguyễn Văn A');
  await signupUser('hoten051512@gmail.com', '123456', 'Trần Thị B');
  await signupUser('testuser3@example.com', '123456', 'Test User 3');
  await signupUser('testuser4@example.com', '123456', 'Test User 4');
  await signupUser('testuser5@example.com', '123456', 'Test User 5');
  await signupUser('testuser6@example.com', '123456', 'Test User 6');
  
  // Update user profiles with complete info
  console.log('Cập nhật thông tin user');
  await updateUserProfile('tendemten051512@gmail.com', '123456', {
    fullName: 'Nguyễn Văn A',
    phone: '0912345678',
    province: 'Hà Nội',
    ward: 'Phường Hoàn Kiếm',
    addressDetail: '123 Nguyễn Huệ'
  });
  await updateUserProfile('hoten051512@gmail.com', '123456', {
    fullName: 'Trần Thị B',
    phone: '0987654321',
    province: 'Hồ Chí Minh',
    ward: 'Phường Bến Nghé',
    addressDetail: '456 Lê Lợi'
  });
  
  // Create or verify admin user exists with correct password
  let adminToken;
  let actualAdminEmail = adminEmail;
  let actualAdminPassword = adminPassword;
  try {
    const { token } = await login(adminEmail, adminPassword);
    adminToken = token;
    console.log(`Admin login successful`);
    
    // Check if user has ADMIN role, if not, promote them
    try {
      const promoteResponse = await axios.post(`${API_BASE}/auth/promote-admin`, {}, 
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      if (promoteResponse.status === 200) {
        console.log(`User promoted to ADMIN role`);
        // Wait longer for database to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Retry login to get token with ADMIN role
        let retries = 3;
        while (retries > 0) {
          try {
            const { token: newToken } = await login(adminEmail, adminPassword);
            // Verify token has ADMIN role
            const payload = JSON.parse(Buffer.from(newToken.split('.')[1], 'base64').toString());
            if (payload.role === 'ADMIN') {
              adminToken = newToken;
              console.log(`Re-logged in with ADMIN role (verified)`);
              break;
            } else {
              console.log(`Token role: ${payload.role}, retrying... (${retries - 1} left)`);
              await new Promise(resolve => setTimeout(resolve, 500));
              retries--;
            }
          } catch (loginErr) {
            console.warn(`   ⚠ Re-login failed:`, loginErr.message);
            await new Promise(resolve => setTimeout(resolve, 500));
            retries--;
          }
        }
      }
    } catch (promoteErr) {
      // If promotion fails, it might be because user already has ADMIN role or email doesn't match
      console.log(`Promotion check: ${promoteErr.response?.data?.error || promoteErr.message}`);
    }
  } catch (loginError) {
    // If login fails, try to create the admin user
    console.log(`Admin login failed, attempting to create admin user...`);
    const adminCreds = await createAdminUser();
    actualAdminEmail = adminCreds.email;
    actualAdminPassword = adminCreds.password;
    
    // Wait longer for database to update role
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Retry login to get token with ADMIN role
    let retries = 3;
    while (retries > 0) {
      try {
        const { token } = await login(actualAdminEmail, actualAdminPassword);
        // Verify token has ADMIN role
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (payload.role === 'ADMIN') {
          adminToken = token;
          console.log(`Admin user created and logged in with ADMIN role (verified)`);
          break;
        } else {
          console.log(`Token role: ${payload.role}, retrying... (${retries - 1} left)`);
          await new Promise(resolve => setTimeout(resolve, 500));
          retries--;
        }
      } catch (loginErr) {
        console.warn(`Login failed:`, loginErr.message);
        await new Promise(resolve => setTimeout(resolve, 500));
        retries--;
      }
    }
    
    if (!adminToken) {
      throw new Error('Failed to get admin token after creating user');
    }
  }
  
  const admin = client(adminToken, true); // Pass true to set x-user-role header
  
  // Test admin access
  try {
    const testRes = await admin.get('/admin/catalog/brands');
    if (testRes.status >= 400) {
      console.error(`Admin access test failed: ${testRes.status} - ${JSON.stringify(testRes.data)}`);
    } else {
      console.log(`Admin access verified`);
    }
  } catch (e) {
    console.error(`Admin access test error:`, e.message);
  }
  
  const createdProducts = await seedCatalog(admin);
  await seedBanners(admin);
  
  console.log('Xóa giỏ hàng cũ');
  await clearUserCart('tendemten051512@gmail.com', '123456');
  await clearUserCart('hoten051512@gmail.com', '123456');
  
  console.log('Tạo demo orders');
  await seedDemoOrders('tendemten051512@gmail.com', '123456');
  await seedDemoOrders('hoten051512@gmail.com', '123456');

  await seedReviews();
  console.log('Hoàn thành seed - GearUp sẵn sàng!');
}

main().catch((e) => {
  console.error('Seeding failed', e);
  process.exit(1);
});
