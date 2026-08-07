const axios = require('axios');

/**
 * يولّد صورة من وصف نصي عبر خدمة Pollinations المجانية وبدون حدود
 * @param {string} prompt - وصف الصورة المطلوبة
 * @returns {Promise<Buffer>} بيانات الصورة كـ Buffer جاهزة للإرسال في الواتساب
 */
async function generateImage(prompt) {
  try {
    const cleanPrompt = encodeURIComponent(prompt.trim());
    // رابط توليد الصورة بأبعاد مناسبة ودقة عالية
    const imageUrl = `https://pollinations.ai/p/${cleanPrompt}?width=1080&height=1080&nologo=true&seed=${Math.floor(Math.random() * 1000)}`;
    
    // جلب الصورة وتحويلها إلى Buffer
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    return Buffer.from(response.data, 'binary');
  } catch (err) {
    console.error('خطأ في توليد الصورة:', err.message);
    throw new Error('تعذر توليد الصورة حالياً، حاول مرة أخرى.');
  }
}

/**
 * دالة التعديل
 */
async function editImage(imageBuffer, mimetype, instruction) {
  return await generateImage(instruction);
}

module.exports = { generateImage, editImage };
