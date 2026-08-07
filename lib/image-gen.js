const axios = require('axios');

// يقرأ المفتاح بأمان من Variables في Railway
const HF_API_KEY = process.env.HF_API_KEY;

/**
 * ترجمة النص العربي لإنجليزي ليفهمه النموذج بدقة عالية
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
 * توليد صورة باستخدام نموذج Stable Diffusion XL عبر HuggingFace
 */
async function generateImage(prompt) {
  try {
    const englishPrompt = await translateToEnglish(prompt.trim());
    
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      { inputs: englishPrompt },
      {
        headers: { Authorization: `Bearer ${HF_API_KEY}` },
        responseType: 'arraybuffer'
      }
    );

    return Buffer.from(response.data, 'binary');
  } catch (err) {
    console.error('خطأ في توليد الصورة عبر HuggingFace:', err.message);
    const englishPrompt = await translateToEnglish(prompt.trim());
    const seed = Math.floor(Math.random() * 100000);
    return { url: `https://image.pollinations.ai/prompt/${encodeURIComponent(englishPrompt)}?width=1080&height=1080&model=flux&nologo=true&seed=${seed}` };
  }
}

async function editImage(imageBuffer, mimetype, instruction) {
  return await generateImage(instruction);
}

module.exports = { generateImage, editImage };
