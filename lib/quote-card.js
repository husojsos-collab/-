// ============ !اقتباس - بطاقة اقتباس لرسالة قديمة قالها عضو بالجروب ============

function formatArabicDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
}

function quoteBanner(nameTag, text, ts) {
  return [
    '⌬──══─┈•⤣📜⤤•┈─══──⌬',
    '📜 *اقـتـبـاس مـن الأرشـيـف*',
    '',
    `"${text}"`,
    '',
    `👤 قالها: ${nameTag}`,
    `🗓️ يوم: ${formatArabicDate(ts)}`,
    '⌬──══─┈•⤣📜⤤•┈─══──⌬'
  ].join('\n');
}

function noQuoteFoundMessage() {
  return 'ما عندي أي رسالة محفوظة لهاد العضو لسا (لازم يكون حكى بالجروب من بعد ما اشتغل البوت آخر مرة) 🤷';
}

module.exports = {
  quoteBanner,
  noQuoteFoundMessage
};
