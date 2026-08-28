const { Sequelize } = require('sequelize');
require('dotenv').config();

const requiredEnv = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
const placeholderEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD'].filter((name) =>
  /your_|project-ref|aws-0-region|replace_with/i.test(process.env[name] || '')
);

if (missingEnv.length > 0) {
  throw new Error(`Environment variable wajib diisi: ${missingEnv.join(', ')}`);
}

if (placeholderEnv.length > 0) {
  throw new Error(
    `Ganti nilai placeholder Supabase di .env: ${placeholderEnv.join(', ')}`
  );
}

const useSsl = process.env.DB_SSL !== 'false';

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    dialect: 'postgres',
    dialectOptions: useSsl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      timestamps: true,
      underscored: true,
    },
  }
);

module.exports = sequelize;
