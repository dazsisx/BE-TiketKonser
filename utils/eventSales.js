const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta (UTC+7, tanpa DST)
const DAY_MS = 24 * 60 * 60 * 1000;

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

// Awal hari berikutnya (00:00:00 WIB) setelah hari berlangsungnya event, sebagai Date (UTC).
// Penjualan boleh sampai 23:59:59.999 WIB pada tanggal acara, yaitu selama now < nilai ini.
const startOfNextDayWIB = (date) => {
  const startOfDay =
    Math.floor((date.getTime() + WIB_OFFSET_MS) / DAY_MS) * DAY_MS - WIB_OFFSET_MS;
  return new Date(startOfDay + DAY_MS);
};

/**
 * Pastikan event masih boleh dijual (online maupun offline).
 * - status harus 'aktif'
 * - penjualan dibuka sampai 23:59:59 WIB pada tanggal acara
 * Melempar error ber-`status` (ditangani handler controller).
 * @param {'online'|'offline'} channel hanya untuk teks pesan error
 */
const assertEventOpenForSale = (event, channel, now = new Date()) => {
  if (event.status !== 'aktif') {
    throw httpError(400, 'Penjualan tiket untuk event ini sedang tidak dibuka.');
  }

  const tanggal = new Date(event.tanggal);
  if (Number.isNaN(tanggal.getTime())) {
    throw httpError(400, 'Tanggal event tidak valid. Hubungi admin.');
  }

  if (now >= startOfNextDayWIB(tanggal)) {
    throw httpError(
      400,
      channel === 'offline'
        ? 'Event sudah berakhir. Penjualan tiket offline ditutup.'
        : 'Event sudah berakhir. Penjualan tiket online ditutup.'
    );
  }
};

module.exports = { assertEventOpenForSale, startOfNextDayWIB };