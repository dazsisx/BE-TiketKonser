const withPembeli = (pesanan) => {
  const data = typeof pesanan.toJSON === 'function' ? pesanan.toJSON() : { ...pesanan };

  if (!data.user) {
    data.user = {
      id: null,
      nama: data.nama_pembeli,
      email: data.email_pembeli,
      no_telepon: data.no_telepon_pembeli,
    };
  }

  return data;
};

module.exports = { withPembeli };