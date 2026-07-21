// ============ إعدادات/مفاتيح مشتركة يستخدمها أكتر من ملف ============

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// الرابط اللي بيبعته أمر !رابط
const SHARED_LINK = 'https://lambent-cat-50bd8a.netlify.app/';

module.exports = {
  GROQ_API_KEY,
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GEMINI_ENDPOINT,
  SHARED_LINK
};
