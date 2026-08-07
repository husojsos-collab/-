const axios = require('axios');
const { POLLINATIONS_API_KEY } = require('./config');

// Pollinations.ai - توليد صور بالذكاء الاصطناعي عبر gen.pollinations.ai (يحتاج API key)
const POLLINATIONS_BASE_URL = 'https://gen.pollinations.ai/image';

/**
 * يولّد صورة من وصف نصي عبر Pollinations.ai
 * @param {string} prompt - وصف الصورة المطلوبة (عربي أو انجليزي)
 * @returns {Promise<Buffer>} بيانات الصورة كـ Buffer جاهزة للإرسال بواتساب
 */
async function generateImage(prompt) {
  const seed = Math.floor(Math.random() * 1000000);
  const encodedPrompt = encodeURIComponent(prompt.trim());
  const url = `${POLLINATIONS_BASE_URL}/${encodedPrompt}?model=flux&width=1024&height=1024&seed=${seed}`;

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000, // ممكن ياخد شوي وقت (توليد صورة حقيقي)
    headers: {
      Authorization: `Bearer ${POLLINATIONS_API_KEY}`
    }
  });

  return Buffer.from(response.data);
}

/**
 * يعدّل صورة موجودة عبر Pollinations.ai (/v1/images/edits)
 * @param {Buffer} imageBuffer - بيانات الصورة الأصلية
 * @param {string} mimetype - نوع الصورة (مثلاً image/jpeg)
 * @param {string} instruction - وصف التعديل المطلوب (عربي أو انجليزي)
 * @returns {Promise<Buffer>} بيانات الصورة المعدّلة كـ Buffer جاهزة للإرسال بواتساب
 */
async function editImage(imageBuffer, mimetype, instruction) {
  const FormData = require('form-data');
  const form = new FormData();
  form.append('image', imageBuffer, { filename: 'image.jpg', contentType: mimetype || 'image/jpeg' });
  form.append('prompt', instruction.trim());
  form.append('model', 'kontext'); // موديل مخصص للتعديل (image-to-image)

  const response = await axios.post('https://gen.pollinations.ai/v1/images/edits', form, {
    responseType: 'json',
    timeout: 60000,
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${POLLINATIONS_API_KEY}`
    }
  });

  // الرد بصيغة OpenAI-compatible: data[0].b64_json
  const b64 = response.data && response.data.data && response.data.data[0] && response.data.data[0].b64_json;
  if (!b64) throw new Error('ما رجع الـ API صورة معدّلة (رد غير متوقع)');
  return Buffer.from(b64, 'base64');
}

module.exports = { generateImage, editImage };
