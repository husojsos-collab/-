// ============ بانرات نصية عامة يستخدمها أكتر من مكان بالبوت ============

function muradBanner(line, headerText = '💗 *تـم تـحـديـث الإعـدادات بـنـجـاح!*') {
  return [
    '⌬──══─┈•⤣🎀⤤•┈─══──⌬',
    '',
    '₊˚୨🎀୧⋆ 𝗔𝗟𝗬𝗔-𝗖𝗛𝗔𝗡 ⋆୨🎀୧˚₊',
    '',
    headerText,
    '',
    `> ${line} ✨`,
    '⌬──══─┈•⤣🎀⤤•┈─══──⌬'
  ].join('\n');
}

// نفس شكل muradBanner بالضبط، بس بعنوان "لا يوجد تغيير" - نستخدمها لما حد يكرر
// أمر إدارة (قفل/فتح/فتح رابط/قفل رابط) والحالة أصلاً زي ما هو طالبها
function noChangeBanner(line) {
  return muradBanner(line, '🌸 *هـي أصـلاً كـذا، ما تغيّر شي!*');
}

function wrongCommandBanner() {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '❌⃝⚡ *الأمـر مـكـتـوب غـلـط*',
    '',
    '📋 اكتب !اوامر عشان تشوف كل الأوامر الصحيحة',
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

module.exports = {
  muradBanner,
  noChangeBanner,
  wrongCommandBanner
};
