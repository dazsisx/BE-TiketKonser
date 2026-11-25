const { Wishlist, Event, Artis, KategoriTiket } = require('../models');

// Samakan bentuk event dengan GET /api/event: poster diambil dari image_url / banner.
const formatEvent = (event) => {
  if (!event) return null;
  const source = typeof event.toJSON === 'function' ? event.toJSON() : event;
  const poster = source.image_url ?? source.banner ?? null;
  return { ...source, poster, image_url: poster, banner: poster };
};

const eventInclude = [
  { model: Artis, as: 'artis', attributes: ['id', 'nama', 'foto', 'genre'] },
  { model: KategoriTiket, as: 'kategori_tiket' },
];

const parseEventId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// @desc    Daftar wishlist milik pelanggan yang login (terbaru dulu)
// @route   GET /api/wishlist
// @access  Pelanggan
const getWishlist = async (req, res) => {
  try {
    const rows = await Wishlist.findAll({
      where: { user_id: req.user.id },
      include: [{ model: Event, as: 'event', include: eventInclude }],
      order: [['created_at', 'DESC']],
    });

    // Event yang sudah dihapus admin tidak ikut ditampilkan
    const data = rows
      .filter((row) => row.event)
      .map((row) => ({
        id: row.id,
        event_id: row.event_id,
        ditambahkan_pada: row.createdAt,
        event: formatEvent(row.event),
      }));

    return res.status(200).json({ success: true, total: data.length, data });
  } catch (error) {
    console.error('getWishlist error:', error.message);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
  }
};

// @desc    Daftar id event di wishlist (ringan, untuk status tombol hati)
// @route   GET /api/wishlist/ids
// @access  Pelanggan
const getWishlistIds = async (req, res) => {
  try {
    const rows = await Wishlist.findAll({
      where: { user_id: req.user.id },
      attributes: ['event_id'],
    });
    return res.status(200).json({ success: true, data: rows.map((row) => row.event_id) });
  } catch (error) {
    console.error('getWishlistIds error:', error.message);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
  }
};

// @desc    Tambah event ke wishlist (aman dipanggil berulang)
// @route   POST /api/wishlist
// @access  Pelanggan
const tambahWishlist = async (req, res) => {
  try {
    const eventId = parseEventId(req.body && req.body.event_id);
    if (!eventId) {
      return res.status(400).json({ success: false, message: 'event_id wajib diisi dengan benar.' });
    }

    const event = await Event.findByPk(eventId, { attributes: ['id'] });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event tidak ditemukan.' });
    }

    const [row, dibuat] = await Wishlist.findOrCreate({
      where: { user_id: req.user.id, event_id: eventId },
    });

    return res.status(dibuat ? 201 : 200).json({
      success: true,
      message: dibuat ? 'Event ditambahkan ke wishlist.' : 'Event sudah ada di wishlist.',
      data: { id: row.id, event_id: row.event_id },
    });
  } catch (error) {
    console.error('tambahWishlist error:', error.message);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
  }
};

// @desc    Hapus event dari wishlist (hanya milik sendiri)
// @route   DELETE /api/wishlist/:eventId
// @access  Pelanggan
const hapusWishlist = async (req, res) => {
  try {
    const eventId = parseEventId(req.params.eventId);
    if (!eventId) {
      return res.status(400).json({ success: false, message: 'ID event tidak valid.' });
    }

    await Wishlist.destroy({ where: { user_id: req.user.id, event_id: eventId } });

    // Idempoten: menghapus event yang tidak ada di wishlist tetap dianggap berhasil
    return res.status(200).json({ success: true, message: 'Event dihapus dari wishlist.' });
  } catch (error) {
    console.error('hapusWishlist error:', error.message);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
  }
};

module.exports = { getWishlist, getWishlistIds, tambahWishlist, hapusWishlist };
