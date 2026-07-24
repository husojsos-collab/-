// ============ بناء الصور: بروفايل، جيفات مخزّنة ============
// كل دوال sharp/svg نفسها زي الأصل بدون تغيير (ما كانتش تعتمد على whatsapp-web.js أصلاً).
// الشي الوحيد اللي اتغيّر فعلياً هو getProfilePicBuffer: بـ Baileys بنجيب رابط صورة
// البروفايل بـ sock.profilePictureUrl(jid, 'image') بدل client.getProfilePicUrl(id).

const path = require('path');
const fs = require('fs');
const axios = require('axios');
const sharp = require('sharp');

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

// ============ جيفات/فيديوهات مخزّنة (كاش بالذاكرة) ============
// تحديث: بدل ما نحول الجيف لـ mp4 وقت التشغيل (يحتاج ffmpeg، وده سبب مشاكل
// بمنصات استضافة معينة)، صرنا نقرأ ملفات mp4 جاهزة مباشرة من القرص (بالضبط
// زي فيديو حقوق بوت اللي كان شغال دايمًا لأنه ما يحتاج ffmpeg أصلاً).
// لازم ترفع الملفين المحولين مسبقًا بمجلد images/ بهالاسمين بالظبط:
const MENU_MP4_FILENAME = 'VID_20260724_121837.mp4';
const HUSAAM_MP4_FILENAME = 'VID_20260724_122444.mp4';
const HUSAAM_MENTION_NUMBER = '218912832335';
const HUSAAM_MENTION_NUMBERS = [HUSAAM_MENTION_NUMBER, '218942301686'];
const HUQOQ_VIDEO_FILENAME = 'VID_20260721_170815.mp4';

let cachedMenuGifMp4 = null;
let cachedHusaamGifMp4 = null;
let cachedHuqoqVideoBuffer = null;

// دالة عامة تقرأ أي ملف فيديو جاهز مباشرة من القرش (مع كاش وفحص وجود الملف)
function readVideoFileBuffer(imagesDir, filename) {
  const videoPath = path.join(imagesDir, filename);
  if (!fs.existsSync(videoPath)) {
    throw new Error(`الملف مش موجود بالسيرفر أصلاً: ${videoPath}`);
  }
  return fs.readFileSync(videoPath);
}

async function getMenuGifMp4Buffer(imagesDir) {
  if (cachedMenuGifMp4) return cachedMenuGifMp4;
  cachedMenuGifMp4 = readVideoFileBuffer(imagesDir, MENU_MP4_FILENAME);
  return cachedMenuGifMp4;
}

async function getHusaamGifMp4Buffer(imagesDir) {
  if (cachedHusaamGifMp4) return cachedHusaamGifMp4;
  cachedHusaamGifMp4 = readVideoFileBuffer(imagesDir, HUSAAM_MP4_FILENAME);
  return cachedHusaamGifMp4;
}

async function getHuqoqVideoBuffer(imagesDir) {
  if (cachedHuqoqVideoBuffer) return cachedHuqoqVideoBuffer;
  cachedHuqoqVideoBuffer = readVideoFileBuffer(imagesDir, HUQOQ_VIDEO_FILENAME);
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
