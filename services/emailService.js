// services/emailService.js
const { Resend } = require("resend");

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "DRStar <no-reply@drstar.id>";
let resend;

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY belum dikonfigurasi. Tambahkan API key Resend ke file .env backend."
    );
  }

  resend ??= new Resend(process.env.RESEND_API_KEY);
  return resend;
}

function buildOtpEmailHtml(otp, expiryMinutes) {
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; background:#FFFBF5; padding: 32px 0;">
    <div style="max-width: 480px; margin: 0 auto; background:#ffffff; border:1px solid #E5E7EB; border-radius:16px; overflow:hidden;">
      <div style="padding: 24px 32px; border-bottom:1px solid #E5E7EB;">
        <span style="font-size:18px; font-weight:700; color:#1F2937;">DR<span style="color:#0F766E;">Star</span></span>
      </div>
      <div style="padding: 32px;">
        <h2 style="margin:0 0 12px; font-size:18px; color:#1F2937;">Verifikasi Ubah Kata Sandi</h2>
        <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#6B7280;">
          Halo, kami menerima permintaan untuk mengatur ulang kata sandi akun DRStar kamu. Gunakan kode verifikasi di bawah ini:
        </p>
        <div style="margin: 24px 0; text-align:center;">
          <span style="display:inline-block; font-size:32px; font-weight:700; letter-spacing:8px; color:#0F766E; background:#0F766E14; padding:14px 24px; border-radius:12px;">
            ${otp}
          </span>
        </div>
        <p style="margin:0 0 8px; font-size:13px; color:#6B7280;">
          Kode ini akan kedaluwarsa dalam <strong>${expiryMinutes} menit</strong>.
        </p>
        <p style="margin:0; font-size:13px; color:#6B7280;">
          Demi keamanan akunmu, jangan bagikan kode ini kepada siapa pun, termasuk pihak yang mengaku dari DRStar.
        </p>
        <p style="margin:24px 0 0; font-size:13px; color:#9CA3AF;">
          Jika kamu tidak meminta perubahan kata sandi, abaikan saja email ini.
        </p>
      </div>
      <div style="padding: 16px 32px; border-top:1px solid #E5E7EB; font-size:12px; color:#9CA3AF;">
        &copy; ${new Date().getFullYear()} DRStar. Seluruh hak cipta dilindungi.
      </div>
    </div>
  </div>`;
}

async function sendOtpEmail({ to, otp, expiryMinutes }) {
  const { error } = await getResendClient().emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Kode Verifikasi Ubah Kata Sandi - DRStar",
    html: buildOtpEmailHtml(otp, expiryMinutes),
  });

  if (error) {
    throw new Error("Gagal mengirim email OTP: " + error.message);
  }
}

module.exports = { sendOtpEmail };