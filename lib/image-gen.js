const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY;

async function generateImage(prompt) {
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    // تعزيز النص تلقائياً لضمان رسم أنمي عالي الدقة وواضح الملامح
    const enhancedPrompt = `${prompt}, highly detailed official anime art style, masterpiece, sharp features, 8k resolution, cinematic studio lighting`;

    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: enhancedPrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });

    const base64ImageBytes = response.generatedImages[0].image.imageBytes;
    return Buffer.from(base64ImageBytes, 'base64');
  } catch (err) {
    console.error('خطأ في Google Imagen API:', err.message);
    throw new Error('تعذر توليد الصورة حالياً.');
  }
}

async function editImage(imageBuffer, mimetype, instruction) {
  return await generateImage(instruction);
}

module.exports = { generateImage, editImage };
