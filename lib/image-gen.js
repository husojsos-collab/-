const axios = require('axios');

// يقرأ توكن Hugging Face من Variables في Railway
const HF_API_KEY = process.env.HF_API_KEY;

/**
 * ترجمة النص العربي لإنجليزي دقيق
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
 * توليد الصور باستخدام أفضل نموذج أنمي وواقعي عبر Hugging Face
 */
async function generateImage(prompt) {
  try {
    const englishPrompt = await translateToEnglish(prompt.trim());
    
    // تعزيز الوصف لضمان ملامح جبارة وجودة أنمي عالية
    const enhancedPrompt = `${englishPrompt}, highly detailed portrait, masterpiece, 8k resolution, cinematic lighting, realistic features, official art`;

    const response = await axios.post(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      { inputs: enhancedPrompt },
      {
        headers: { 
          Authorization: `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    return Buffer.from(response.data, 'binary');
  } catch (err) {
    console.error('خطأ في HuggingFace API:', err.message);
    
    // محرك احتياطي مطور في حال انشغال السيرفر
    const englishPrompt = await translateToEnglish(prompt.trim());
    const enhancedPrompt = `${englishPrompt}, masterpiece, highly detailed, 8k, realistic portrait`;
    const seed = Math.floor(Math.random() * 999999);
    
    return { url: `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&model=flux&seed=${seed}&nologo=true` };
  }
}

async function editImage(imageBuffer, mimetype, instruction) {
  return await generateImage(instruction);
}

module.exports = { generateImage, editImage };
