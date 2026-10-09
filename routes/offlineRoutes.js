const express = require('express');
const router = express.Router();
const {
  jualOffline,
  getRiwayatOffline,
  getDetailOffline,
  getDashboardOffline,
} = require('../controllers/offlineController');
const { protect, authorize, ROLES } = require('../middleware/authMiddleware');

router.use(protect, authorize(ROLES.ADMIN, ROLES.ADMIN_OFFLINE));

router.get('/dashboard', getDashboardOffline);
router.post('/pesanan', jualOffline);
router.get('/pesanan', getRiwayatOffline);
router.get('/pesanan/:id', getDetailOffline);

module.exports = router;