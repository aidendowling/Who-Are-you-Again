const QRCode = require('qrcode');
const fs = require('fs');

const generateQR = async (seat) => {
  const data = `wh0ru://room/test-room/seat/${seat}`;
  const filePath = `assets/qr_seat_${seat}.png`;
  await QRCode.toFile(filePath, data);
  console.log(`QR code generated for seat ${seat}: ${filePath}`);
};

(async () => {
  await generateQR(67);
  await generateQR(69);
})();
