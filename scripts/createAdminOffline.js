require('dotenv').config();
const { sequelize, User } = require('../models');

(async () => {
  const [nama, email, password] = process.argv.slice(2);

  if (!nama || !email || !password) {
    console.error('Pemakaian: node scripts/createAdminOffline.js "Nama" email@contoh.com password');
    process.exit(1);
  }

  try {
    await sequelize.authenticate();

    const ada = await User.findOne({ where: { email } });
    if (ada) {
      console.error(`Email ${email} sudah terdaftar (role: ${ada.role}). Tidak ada perubahan.`);
      process.exitCode = 1;
      return;
    }

    const user = await User.create({ nama, email, password, role: 'admin_offline' });
    console.log(`Admin Offline dibuat: id=${user.id}, email=${user.email}`);
  } catch (error) {
    console.error('Gagal membuat akun:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();