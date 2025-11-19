import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import { nanoid } from 'nanoid';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 3005;
const intents = new Map();
const BANK_ACC = process.env.BANK_ACC || '';
const BANK_CODE = process.env.BANK_CODE || 'VCB';
const QR_TEMPLATE = process.env.QR_TEMPLATE || 'compact';

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

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Payment service listening on ${PORT}`);
});


