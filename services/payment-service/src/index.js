import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
import qs from 'qs'; // Use qs package for proper stringify
import moment from 'moment';
import dotenv from 'dotenv';
import RedisLockManager from '../shared/RedisLockManager.js';

// Load environment variables from .env
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Initialize Redis Lock Manager
const lockManager = new RedisLockManager();

const PORT = process.env.PORT || 3005;
const intents = new Map();

// VNPay Configuration
const VNPAY_TMN_CODE = process.env.VNPAY_TMN_CODE || 'DEMO';
const VNPAY_HASH_SECRET = process.env.VNPAY_HASH_SECRET || 'DEMO_SECRET';
const VNPAY_URL = process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const VNPAY_RETURN_URL = process.env.VNPAY_RETURN_URL || 'http://localhost:5173/payment/vnpay-return';

// Bank transfer QR (for COD alternative)
const BANK_ACC = process.env.BANK_ACC || '';
const BANK_CODE = process.env.BANK_CODE || 'VCB';
const QR_TEMPLATE = process.env.QR_TEMPLATE || 'compact';

// Helper: Sort object by key (simple version)
function sortObject(obj) {
  let sorted = {};
  let keys = Object.keys(obj).sort();
  keys.forEach((key) => {
    sorted[key] = obj[key];
  });
  return sorted;
}

// Create VNPay payment URL (using working logic from payment_onl-main)
app.post('/payment/vnpay/create', (req, res) => {
  try {
    const { orderId, amountCents, orderInfo, bankCode } = req.body;

    if (!orderId || !amountCents) {
      return res.status(400).json({ error: 'Missing orderId or amountCents' });
    }

    // VNPay configuration
    const tmnCode = VNPAY_TMN_CODE;
    const secretKey = VNPAY_HASH_SECRET;
    const returnUrl = VNPAY_RETURN_URL;
    const vnp_Url = VNPAY_URL;

    // Get IP address
    let ipAddr = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || '127.0.0.1';
    if (ipAddr.includes('::ffff:')) {
      ipAddr = ipAddr.replace('::ffff:', '');
    }
    if (ipAddr === '::1') {
      ipAddr = '127.0.0.1';
    }

    // Transaction reference and dates
    // 🔥 FIX: Dùng orderId thật từ database làm TxnRef thay vì timestamp
    // Điều này giúp mapping chính xác khi cancel/confirm order
    let txnRef = String(orderId); // Convert orderId to string for VNPay
    let createDate = moment().format("YYYYMMDDHHmmss");
    let orderInfoText = orderInfo || `Thanh_toan_don_hang_${orderId}`;
    let locale = "vn";
    let currCode = "VND";

    // Build params exactly like the working example
    let vnp_Params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_Locale: locale,
      vnp_CurrCode: currCode,
      vnp_TxnRef: txnRef, // Now uses real orderId from database
      vnp_OrderInfo: orderInfoText,
      vnp_OrderType: "billpayment",
      // VNPay expects amount multiplied by 100 (no decimal separator)
      vnp_Amount: String(Number(amountCents) * 100),
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    };

    if (bankCode !== "") {
      vnp_Params["vnp_BankCode"] = bankCode;
    }

    // Remove empty/null params per VNPay requirement
    Object.keys(vnp_Params).forEach(k => {
      if (vnp_Params[k] === undefined || vnp_Params[k] === null || vnp_Params[k] === '') delete vnp_Params[k];
    });

    vnp_Params = sortObject(vnp_Params);

    // Create signData using URL encoding as per VNPay docs
    let signData = qs.stringify(vnp_Params);
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
    vnp_Params["vnp_SecureHash"] = signed;

    // Debug logs to help verify signature
    console.log('=== VNPay Payment Created ===');
    console.log('VNPay signData:', signData);
    console.log('VNPay signature:', signed);
    console.log('Order ID (Real):', orderId);
    console.log('TxnRef (Same as OrderID):', txnRef);
    console.log('Amount (VND * 100):', vnp_Params.vnp_Amount);
    console.log('================================');

    // Build final URL with proper encoding
    let paymentUrl = vnp_Url + "?" + qs.stringify(vnp_Params);

    // Store intent for tracking
    const intentId = nanoid();
    intents.set(intentId, {
      id: intentId,
      orderId,
      txnRef,
      amountCents,
      status: 'PENDING',
      createdAt: new Date()
    });

    return res.json({
      success: true,
      paymentUrl,
      txnRef,
      intentId
    });

  } catch (error) {
    console.error('VNPay create error:', error);
    return res.status(500).json({ error: 'Failed to create payment' });
  }
});

// 🔒 CRITICAL: Verify VNPay IPN/Return callback WITH LOCK (VNPay can send multiple callbacks)
app.get('/payment/vnpay/return', async (req, res) => {
  const query = req.query;
  const txnRef = query.vnp_TxnRef;
  
  if (!txnRef) {
    return res.status(400).json({ success: false, message: 'Missing transaction reference' });
  }
  
  // 🔒 Lock by transaction reference to prevent duplicate processing
  const webhookLockKey = `vnpay:webhook:${txnRef}`;
  
  try {
    // Use Redis lock with 60s TTL (enough time to process)
    const result = await lockManager.withLock(webhookLockKey, async () => {
      return await processVNPayCallback(query);
    }, { ttlSeconds: 60, maxRetries: 1, throwOnFailure: false });
    
    if (!result) {
      // Lock acquisition failed - callback already processed
      console.log(`⚠️ VNPay callback already processed for txnRef: ${txnRef}`);
      return res.json({ 
        success: true,
        message: "Thanh toán đã được xử lý",
        alreadyProcessed: true
      });
    }
    
    return res.json(result);
    
  } catch (error) {
    console.error('VNPay callback error:', error);
    return res.status(500).json({ 
      success: false,
      message: "Lỗi xử lý thanh toán" 
    });
  }
});

// Extracted VNPay callback processing logic
async function processVNPayCallback(query) {
  try {
    const secretKey = VNPAY_HASH_SECRET;
    const vnp_SecureHash = query.vnp_SecureHash;

    // Clone query to avoid mutating original
    const queryParams = { ...query };
    delete queryParams.vnp_SecureHash;
    delete queryParams.vnp_SecureHashType;

    // Remove empty/null params
    Object.keys(queryParams).forEach(k => {
      if (queryParams[k] === undefined || queryParams[k] === null || queryParams[k] === '') delete queryParams[k];
    });

    const sortedQuery = sortObject(queryParams);

    // Create signData using URL encoding
    const signData = qs.stringify(sortedQuery);

    const hmac = crypto.createHmac("sha512", secretKey);
    const checkSum = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    console.log('=== VNPay Return Callback (LOCKED) ===');
    console.log('Response Code:', query.vnp_ResponseCode);
    console.log('TxnRef:', query.vnp_TxnRef);
    console.log('SignData:', signData);
    console.log('CheckSum (calculated):', checkSum);
    console.log('vnp_SecureHash (received):', vnp_SecureHash);
    console.log('Signature Valid:', vnp_SecureHash === checkSum);

    if (vnp_SecureHash === checkSum) {
      if (query.vnp_ResponseCode === "00") {
        // ✅ Payment successful - Call order-service to confirm order and reserve inventory
        const orderId = query.vnp_TxnRef;
        try {
          const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3004';
          const orderResponse = await fetch(`${ORDER_SERVICE_URL}/orders/confirm-vnpay`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              orderId,
              transactionNo: query.vnp_TransactionNo,
              amount: parseInt(query.vnp_Amount) / 100,
              bankCode: query.vnp_BankCode
            })
          });
          
          if (!orderResponse.ok) {
            const errorText = await orderResponse.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch (e) {
              errorData = { error: 'UNKNOWN_ERROR', message: errorText };
            }
            
            // Check if order was cancelled due to out of stock
            if (errorData.error === 'OUT_OF_STOCK' && errorData.cancelled) {
              console.error(`❌ VNPay order #${orderId} cancelled - Out of stock:`, errorData.message);
              return {
                success: false,
                message: errorData.message || 'Sản phẩm đã hết hàng. Đơn hàng đã bị hủy.',
                code: 'OUT_OF_STOCK',
                orderId: errorData.orderId,
                cancelled: true
              };
            }
            
            console.error('Failed to confirm VNPay order:', errorText);
            return {
              success: false,
              message: errorData.message || 'Không thể xác nhận đơn hàng',
              code: errorData.error || 'CONFIRM_FAILED'
            };
          } else {
            const orderData = await orderResponse.json();
            console.log(`✅ VNPay order #${orderId} confirmed and stock reserved`);
            return { 
              success: true,
              message: "Thanh toán thành công", 
              data: {
                orderId: query.vnp_TxnRef,
                amount: parseInt(query.vnp_Amount) / 100,
                transactionNo: query.vnp_TransactionNo,
                bankCode: query.vnp_BankCode
              }
            };
          }
        } catch (orderErr) {
          console.error('Error calling order service:', orderErr.message);
          return {
            success: false,
            message: 'Lỗi kết nối đến hệ thống đơn hàng',
            code: 'SERVICE_ERROR'
          };
        }
      } else {
        // Payment failed - Cancel order
        const orderId = query.vnp_TxnRef;
        try {
          const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3004';
          await fetch(`${ORDER_SERVICE_URL}/orders/${orderId}/cancel-vnpay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          console.log(`❌ VNPay payment failed - Order #${orderId} cancelled`);
        } catch (err) {
          console.error('Error cancelling order:', err.message);
        }
        
        return { 
          success: false,
          message: "Thanh toán thất bại", 
          code: query.vnp_ResponseCode,
          data: query 
        };
      }
    } else {
      return { 
        success: false,
        message: "Dữ liệu không hợp lệ - Sai chữ ký" 
      };
    }
  } catch (error) {
    console.error('VNPay callback processing error:', error);
    throw error;
  }
}

// Old mock payment intent (for COD)
app.post('/payment/intents', (req, res) => {
  const { orderId, amountCents, currency } = req.body;
  if (!orderId || !amountCents) return res.status(400).json({ error: 'Missing fields' });
  const id = nanoid();
  const clientSecret = nanoid();
  const amount = Math.max(0, Math.floor(amountCents / 100));
  const description = `ORDER_${orderId}`;
  const qrUrl = BANK_ACC
    ? `https://qr.sepay.vn/img?acc=${encodeURIComponent(BANK_ACC)}&bank=${encodeURIComponent(BANK_CODE)}&amount=${amount}&des=${encodeURIComponent(description)}&template=${encodeURIComponent(QR_TEMPLATE)}`
    : null;
  intents.set(id, { id, orderId, amountCents, currency: currency || 'VND', status: 'REQUIRES_CONFIRMATION', clientSecret, qrUrl });
  return res.status(201).json({ id, clientSecret, qrUrl });
});

app.post('/payment/intents/:id/confirm', (req, res) => {
  const { id } = req.params;
  const intent = intents.get(id);
  if (!intent) return res.status(404).json({ error: 'Not found' });
  intent.status = 'SUCCEEDED';
  intents.set(id, intent);
  return res.json({ id, status: intent.status });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'payment-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    vnpay: {
      configured: !!process.env.VNPAY_TMN_CODE
    }
  });
});

// Connect to Redis on startup
lockManager.connect().then(() => {
  console.log('✅ Payment service Redis lock manager ready');
}).catch(err => {
  console.error('❌ Redis connection failed:', err);
  console.warn('⚠️ Service will run WITHOUT distributed locks');
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Payment service listening on ${PORT}`);
});


