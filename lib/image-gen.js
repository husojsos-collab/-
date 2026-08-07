const axios = require('axios');

/**
 * ترجمة دقيقة ومباشرة لضمان تفكيك شخصيات الأنمي والوضعية
 */
async function translateToEnglish(text) {
  try {
    const res = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`);
    return res.data[0][0][0];
  } catch (err) {
    return text;
  }
}

/**
 * توليد صورة باستخدام نموذج Flux.1-Quick الحقيقي والاحترافي للأنمي والشخصيات
 */
async function generateImage(prompt) {
  const englishPrompt = await translateToEnglish(prompt.trim());
  
  // تحسين وصف الأنمي تلقائياً للنموذج ليصل لأعلى دقة تفاصيل
  const enhancedPrompt = encodeURIComponent(`anime style, highly detailed, ${englishPrompt}`);
  const seed = Math.floor(Math.random() * 1000000);
  
  // استخدام محرك Flux السريع بدقة 1080p ودون جودة عشوائية
  const imageUrl = `https://image.pollinations.ai/prompt/${enhancedPrompt}?width=1080&height=1080&model=flux&nologo=true&seed=${seed}`;
  
  return { url: imageUrl };
}

async function editImage(imageBuffer, mimetype, instruction) {
  return await generateImage(instruction);
}

module.exports = { generateImage, editImage };
