// ============ بناء الصور: بروفايل، جيفات مخزّنة ============
// كل دوال sharp/svg نفسها زي الأصل بدون تغيير (ما كانتش تعتمد على whatsapp-web.js أصلاً).
// الشي الوحيد اللي اتغيّر فعلياً هو getProfilePicBuffer: بـ Baileys بنجيب رابط صورة
// البروفايل بـ sock.profilePictureUrl(jid, 'image') بدل client.getProfilePicUrl(id).

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const axios = require('axios');
const sharp = require('sharp');
const { execFile } = require('child_process');

// ============ جلب صورة بروفايل العضو من واتساب (نسخة Baileys) ============
// jid: معرف Baileys كامل (مثلاً "218912345678@s.whatsapp.net")
async function getProfilePicBuffer(sock, jid) {
  if (!sock || !jid) return null;
  try {
    const url = await sock.profilePictureUrl(jid, 'image');
    if (!url) return null;
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
    return Buffer.from(res.data);
  } catch (err) {
    // طبيعي جداً إن هذا يفشل لو العضو ما عندوش صورة بروفوايل أصلاً - مش لازم نعتبره خطأ خطير
    console.log(`ℹ️ ما قدرت أجيب صورة بروفايل لـ ${jid}:`, err.message);
    return null;
  }
}

// ============ صورة افتراضية (لو العضو ماله صورة بروفايل) ============
async function defaultAvatarBuffer(diameter, letter) {
  const safeLetter = (letter || '?').toString().slice(0, 1).toUpperCase();
  const svg = `
    <svg width="${diameter}" height="${diameter}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#2b2b2b"/>
      <text x="50%" y="58%" font-size="${Math.round(diameter * 0.45)}" fill="#f4c430"
            text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold">${safeLetter}</text>
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ============ جيفات/فيديوهات مخزّنة (كاش بالذاكرة) - نفس الأسماء والمنطق الأصلي ============
const MENU_GIF_FILENAME = '75098623da86402ce93bdc7ba44ab623.gif';
const HUSAAM_GIF_FILENAME = '0b796a2198f36cdb21c4357592a10ecf.gif';
// الأرقام المصرح لها إنها "حسام" (لو طار رقم يدخل بالتاني وكأنه ما صار شي)
const HUSAAM_MENTION_NUMBERS = ['218912832335', '218942301686', '218930471213'];
// الرقم الأساسي المستخدم بالمنشن/التاغ (أول رقم بالقايمة)
const HUSAAM_MENTION_NUMBER = HUSAAM_MENTION_NUMBERS[0];
const HUQOQ_VIDEO_FILENAME = 'lv_0_20260716164701.mp4';

let cachedMenuGifMp4 = null;
let cachedHusaamGifMp4 = null;
let cachedHuqoqVideoBuffer = null;

async function gifToMp4Buffer(gifPath) {
  const tmpId = crypto.randomBytes(6).toString('hex');
  const outPath = path.join(os.tmpdir(), `gif_${tmpId}.mp4`);
  try {
    await new Promise((resolve, reject) => {
      execFile(
        'ffmpeg',
        [
          '-y', '-i', gifPath,
          '-movflags', 'faststart',
          '-pix_fmt', 'yuv420p',
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          outPath
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });
    return fs.readFileSync(outPath);
  } finally {
    try { fs.unlinkSync(outPath); } catch (_) {}
  }
}

async function getMenuGifMp4Buffer(imagesDir) {
  if (cachedMenuGifMp4) return cachedMenuGifMp4;
  cachedMenuGifMp4 = await gifToMp4Buffer(path.join(imagesDir, MENU_GIF_FILENAME));
  return cachedMenuGifMp4;
}

async function getHusaamGifMp4Buffer(imagesDir) {
  if (cachedHusaamGifMp4) return cachedHusaamGifMp4;
  cachedHusaamGifMp4 = await gifToMp4Buffer(path.join(imagesDir, HUSAAM_GIF_FILENAME));
  return cachedHusaamGifMp4;
}

async function getHuqoqVideoBuffer(imagesDir) {
  if (cachedHuqoqVideoBuffer) return cachedHuqoqVideoBuffer;
  cachedHuqoqVideoBuffer = fs.readFileSync(path.join(imagesDir, HUQOQ_VIDEO_FILENAME));
  return cachedHuqoqVideoBuffer;
}

module.exports = {
  getProfilePicBuffer,
  defaultAvatarBuffer,
  getMenuGifMp4Buffer,
  getHusaamGifMp4Buffer,
  getHuqoqVideoBuffer,
  HUSAAM_MENTION_NUMBER,
  HUSAAM_MENTION_NUMBERS
};
