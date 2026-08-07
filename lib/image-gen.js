const axios = require('axios');

/**
 * ترجمة النص العربي لإنجليزي ليفهمه موقع Pollinations بدقة
 */
async function translateToEnglish(text) {
  try {
    const res = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`);
    return res.data[0][0][0];
  } catch (err) {
    return text; // في حال فشل الترجمة يرسل النص كما هو
  }
}

/**
 * يولّد صورة عبر Pollinations
 */
async function generateImage(prompt) {
  // ترجمة الوصف للإنجليزي لضمان تصميم الطلب بدقة
  const englishPrompt = await translateToEnglish(prompt.trim());
  const cleanPrompt = encodeURIComponent(englishPrompt);
  const seed = Math.floor(Math.random() * 100000);
  
  const imageUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1080&height=1080&nologo=true&seed=${seed}`;
  
  return { url: imageUrl };
}

async function editImage(imageBuffer, mimetype, instruction) {
  return await generateImage(instruction);
}

module.exports = { generateImage, editImage };
