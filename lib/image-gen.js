const axios = require('axios');

// يقرأ المفتاح بأمان من Variables في Railway
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;

/**
 * ترجمة النص العربي لإنجليزي ليفهمه النموذج بأعلى دقة
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
 * توليد صورة باستخدام أقوى نموذج FLUX.1 عبر Together AI
 */
async function generateImage(prompt) {
  try {
    const englishPrompt = await translateToEnglish(prompt.trim());
    
    // تعزيز النص بكلمات توجيهية لضمان نمط أنمي/واقعي احترافي
    const enhancedPrompt = `${englishPrompt}, highly detailed anime style, masterpiece, 8k resolution, cinematic lighting`;

    const response = await axios.post(
      'https://api.together.xyz/v1/images/generations',
      {
        model: 'black-forest-labs/FLUX.1-schnell-Free',
        prompt: enhancedPrompt,
        width: 1024,
        height: 1024,
        steps: 4,
        n: 1,
        response_format: 'url'
      },
      {
        headers: {
          'Authorization': `Bearer ${TOGETHER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const imageUrl = response.data.data[0].url;
    return { url: imageUrl };
  } catch (err) {
    console.error('خطأ في Together AI API:', err.response ? err.response.data : err.message);
    
    // نظام احتياطي سريعي في حال انشغال السيرفر
    const englishPrompt = await translateToEnglish(prompt.trim());
    const seed = Math.floor(Math.random() * 999999);
    return { url: `https://image.pollinations.ai/prompt/${encodeURIComponent(englishPrompt)}?width=1024&height=1024&model=flux&seed=${seed}&nologo=true` };
  }
}

async function editImage(imageBuffer, mimetype, instruction) {
  return await generateImage(instruction);
}

module.exports = { generateImage, editImage };
