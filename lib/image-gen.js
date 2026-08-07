/**
 * يولّد رابط صورة مباشر عبر Pollinations
 */
async function generateImage(prompt) {
  const cleanPrompt = encodeURIComponent(prompt.trim());
  return `https://pollinations.ai/p/${cleanPrompt}?width=1080&height=1080&nologo=true&seed=${Math.floor(Math.random() * 1000)}`;
}

async function editImage(imageBuffer, mimetype, instruction) {
  return await generateImage(instruction);
}

module.exports = { generateImage, editImage };

