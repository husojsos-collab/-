// ============ مسجل رسايل خفيف بالذاكرة (لأغراض !اقتباس و!تحليل_شخصية) ============
// ملاحظة: بالذاكرة بس (ما ينحفظش على القرص)، فبينمسح لو السيرفر عمل ريستارت.
// هذا مقصود - ما بنسجل محتوى دائم لرسايل الناس، بس آخر شوية رسايل مؤقتة لأغراض المرح.

const MAX_PER_CONVO = 150; // آخر 150 رسالة لكل عضو بكل جروب
const MAX_TRACKED_CONVOS = 500;

// المفتاح: `${chatId}_${number}` ، القيمة: [{ text, ts }, ...]
const chatLogs = new Map();

function logMessage(chatId, number, text) {
  if (!chatId || !number || !text) return;
  const key = `${chatId}_${number}`;
  if (!chatLogs.has(key)) {
    chatLogs.set(key, []);
    if (chatLogs.size > MAX_TRACKED_CONVOS) {
      const oldestKey = chatLogs.keys().next().value;
      chatLogs.delete(oldestKey);
    }
  }
  const arr = chatLogs.get(key);
  arr.push({ text, ts: Date.now() });
  while (arr.length > MAX_PER_CONVO) arr.shift();
}

function getMessages(chatId, number) {
  return chatLogs.get(`${chatId}_${number}`) || [];
}

function getRandomMessage(chatId, number) {
  const arr = getMessages(chatId, number);
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = {
  logMessage,
  getMessages,
  getRandomMessage
};
