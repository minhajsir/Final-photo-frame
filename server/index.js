const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const allowedOrigin = process.env.FRONTEND_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '25mb' }));

// Serve generated files
const filesDir = path.join(__dirname, 'files');
if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir);
app.use('/files', express.static(filesDir));

// Twilio Verify (env placeholders)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyService = process.env.TWILIO_VERIFY_SERVICE_SID;
let twilioClient = null;
if (accountSid && authToken) {
  twilioClient = require('twilio')(accountSid, authToken);
} else {
  console.warn('Twilio credentials not set. OTP endpoints will fail until you add env vars.');
}

// Send OTP
app.post('/send-otp', async (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ success: false, error: 'phone required' });
  try {
    if (!twilioClient) throw new Error('Twilio not configured');
    const verification = await twilioClient.verify.services(verifyService)
      .verifications.create({ to: phone, channel: 'sms' });
    res.json({ success: true, sid: verification.sid, status: verification.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify OTP
app.post('/verify-otp', async (req, res) => {
  const { phone, code } = req.body || {};
  if (!phone || !code) return res.status(400).json({ success: false, error: 'phone and code required' });
  try {
    if (!twilioClient) throw new Error('Twilio not configured');
    const check = await twilioClient.verify.services(verifyService)
      .verificationChecks.create({ to: phone, code });
    if (check.status === 'approved') {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: 'incorrect code', status: check.status });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: parse data URL
function decodeDataUrl(dataUrl) {
  const match = /^data:(.+);base64,(.*)$/.exec(dataUrl || '');
  if (!match) return null;
  return Buffer.from(match[2], 'base64');
}

// Composite endpoint
app.post('/composite', async (req, res) => {
  try {
    const { photo, side = 'right', scale = 1.0, posX = 30, posY = 30, opacity = 1.0 } = req.body || {};
    if (!photo) return res.status(400).json({ error: 'photo (data URL) is required' });

    const photoBuf = decodeDataUrl(photo);
    if (!photoBuf) return res.status(400).json({ error: 'invalid photo data URL' });

    const baseImg = sharp(photoBuf);
    const meta = await baseImg.metadata();
    const W = meta.width || 1080;
    const H = meta.height || 1920;

    const heroPath = path.join(__dirname, 'hero.png');
    if (!fs.existsSync(heroPath)) return res.status(500).json({ error: 'hero.png not found on server' });
    const hero = sharp(heroPath);
    const heroMeta = await hero.metadata();
    const aspect = (heroMeta.width || 800) / (heroMeta.height || 1200);

    const desiredH = Math.round(H * 0.8 * Math.max(0.5, Math.min(scale, 2)));
    const oH = desiredH;
    const oW = Math.round(desiredH * aspect);

    const leftBase = side === 'left' ? posX : (W - oW - posX);
    const x = Math.max(0, Math.min(W - oW, leftBase));
    const y = Math.max(0, Math.min(H - oH, H - oH - posY));

    const overlayBuffer = await hero.resize(oW, oH).ensureAlpha().toBuffer();
    const opacityVal = Math.max(0.2, Math.min(1, opacity));
    const overlayWithOpacity = await sharp(overlayBuffer)
      .composite([{ input: Buffer.from([255,255,255, Math.round(255*opacityVal)]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in' }])
      .toBuffer();

    const outName = `${uuidv4()}.jpg`;
    const outPath = path.join(filesDir, outName);
    await baseImg.composite([{ input: overlayWithOpacity, left: x, top: y }]).jpeg({ quality: 90 }).toFile(outPath);

    const url = `${req.protocol}://${req.get('host')}/files/${outName}`;
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (_req, res) => res.send('API OK'));
app.listen(port, () => console.log(`Server listening on ${port}`));
