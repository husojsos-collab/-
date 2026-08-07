const axios = require('axios');

/**
 * يولّد صورة من وصف نصي عبر خدمة Pollinations المجانية
 * @param {string} prompt - وصف الصورة المطلوبة
 * @returns {Promise<Buffer>} بيانات الصورة كـ Buffer جاهزة للإرسال بالواتساب
 */
async function generateImage(prompt) {
  try {
    const cleanPrompt = encodeURIComponent(prompt.trim());
    // رابط توليد الصورة بدقة عالية
    const imageUrl = `https://pollinations.ai/p/${cleanPrompt}?width=1080&height=1080&nologo=true&seed=${Math.floor(Math.random() * 1000)}`;
    
    // تنزيل الصورة كـ Buffer ليرسلها البوت كملف صورة حقيقي بالقروب
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (err) {
    console.error('خطأ في توليد الصورة:', err.message);
    throw new Error('تعذر توليد الصورة حالياً، حاول مرة أخرى.');
  }
}

/**
 * دالة التعديل (تولد صورة جديدة بناءً على النص المطلوب)
 */
async function editImage(imageBuffer, mimetype, instruction) {
  return await generateImage(instruction);
}

module.exports = { generateImage, editImage };
