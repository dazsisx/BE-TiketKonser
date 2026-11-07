const crypto = require('crypto');

const isConfigured = () =>
  Boolean(process.env.MIDTRANS_SERVER_KEY && process.env.FRONTEND_URL);

const getSnapUrl = () =>
  process.env.MIDTRANS_IS_PRODUCTION === 'true'
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

const createSnapTransaction = async ({ pesanan, kategori, user }) => {
  if (!isConfigured()) {
    const error = new Error('Payment gateway belum dikonfigurasi.');
    error.status = 503;
    throw error;
  }

  const orderId = pesanan.gateway_order_id;
  const requestBody = {
    transaction_details: {
      order_id: orderId,
      gross_amount: Number(pesanan.total_harga),
    },
    item_details: [
      {
        id: String(kategori.id),
        price: Number(kategori.harga),
        quantity: pesanan.jumlah,
        name: `${kategori.nama_kelas} - ${pesanan.jumlah} tiket`.slice(0, 50),
      },
    ],
    customer_details: {
      first_name: user.nama,
      email: user.email,
      ...(user.no_telepon ? { phone: user.no_telepon } : {}),
    },
    callbacks: {
      finish: `${process.env.FRONTEND_URL.replace(/\/+$/, '')}/pembelian/sukses?order=${pesanan.id}`,
    },
    expiry: { unit: 'minute', duration: 30 },
  };

  const response = await fetch(getSnapUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.MIDTRANS_SERVER_KEY}:`).toString('base64')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(15000),
  });

  const result = await response.json();
  if (!response.ok || typeof result.redirect_url !== 'string') {
    console.error('Midtrans Snap transaction creation failed:', response.status, result);
    const error = new Error('Sesi pembayaran gagal dibuat. Silakan coba lagi atau hubungi admin.');
    error.status = 502;
    throw error;
  }

  return { orderId, paymentUrl: result.redirect_url };
};

const verifyNotification = (notification) => {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey || !notification || typeof notification !== 'object') return false;

  const { order_id: orderId, status_code: statusCode, gross_amount: grossAmount, signature_key: signature } = notification;
  if (![orderId, statusCode, grossAmount, signature].every((value) => typeof value === 'string')) return false;

  const expected = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest();
  let received;
  try {
    received = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
};

module.exports = { createSnapTransaction, isConfigured, verifyNotification };
