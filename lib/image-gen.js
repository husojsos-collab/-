/**
 * يولّد صورة عبر رابط Pollinations المباشر لتتوافق مع مكتبة Baileys
 */
async function generateImage(prompt) {
  const cleanPrompt = encodeURIComponent(prompt.trim());
  const seed = Math.floor(Math.random() * 10000);
  
  // استخدام الرابط المباشر للمحرك لتفادي حظر السيرفرات وإرجاع الصورة فوراً
  const imageUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1080&height=1080&nologo=true&seed=${seed}`;
  
  return { url: imageUrl };
}

/**
 * دالة التعديل
 */
async function editImage(imageBuffer, mimetype, instruction) {
  return await generateImage(instruction);
}

module.exports = { generateImage, editImage };

