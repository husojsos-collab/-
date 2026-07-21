// ============ نظام التحذيرات + فلتر السب/القذف + فلتر الصور ============
// المنطق والنصوص والقوائم كلها زي الأصل بالضبط. الشي اللي اتغيّر هو punishProfanity:
// بـ whatsapp-web.js كان بيستخدم message.delete() و chat.participants و client.info.wid.
// بـ Baileys الطريقة مختلفة: sock.sendMessage(groupJid, { delete: key }) للحذف،
// و sock.groupMetadata(groupJid) عشان نجيب المشرفين، و sock.user.id لمعرفة رقم البوت نفسه.

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { GEMINI_ENDPOINT, GEMINI_API_KEY } = require('./config');
const { jidToNumber } = require('./util');

const MAX_WARNINGS = 5;

// قائمة الكلمات الممنوعة (سب/قذف كبير). الفلتر بيطابق حتى لو مكتوبة بمسافات أو تكرار حروف.
const BAD_WORDS = [
  'قحبة', 'قحبه', 'كحبة', 'كحبه', 'شرموطة', 'شرموطه', 'شرموطتي', 'عاهرة', 'عاهره',
  'كس امك', 'كسامك', 'كص امك', 'كصامك', 'كصامكم', 'كس اختك', 'كساختك', 'كس ابوك', 'كسابوك',
  'زب', 'زبي', 'زيب', 'الزب', 'صب', 'طيزك', 'نيك', 'نيكامك', 'نيك امك', 'واد الزنا', 'ولد الحرام', 'ابن الحرام',
  'خول', 'لوطي', 'متناك', 'منيك', 'كلب ابن كلب',
  // إضافات (طلب حماية الجروب - 13/7/2026)
  'سكس', 'طبون', 'طبونمك', 'منيوك'
];

function normalizeForFilter(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s\-_.*]+/g, '');
}

const NORMALIZED_BAD_WORDS = BAD_WORDS.map(normalizeForFilter);

function containsBadWord(text) {
  const normalized = normalizeForFilter(text);
  if (!normalized) return false;
  return NORMALIZED_BAD_WORDS.some((w) => w.length > 0 && normalized.includes(w));
}

// ============ فلتر السب الذكي (يمسك الكلام المشفر/المموّه عبر Gemini) - fail-open ============
async function moderateTextForProfanity(text) {
  if (!text || text.trim().length === 0) return { unsafe: false };
  try {
    const response = await axios.post(
      `${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`,
      {
        systemInstruction: {
          parts: [{
            text: [
              'أنت مصنّف أمان صارم لرسائل جروب واتساب عربي فيه بنات، هدفك حماية الأعضاء من السب والقذف والإهانات الجنسية.',
              'هيدي الرسالة ممكن تكون مكتوبة بطريقة عادية أو مموّهة/مشفرة عشان تتهرب من فلتر كلمات ثابت، مثلاً:',
              '- حروف متباعدة بمسافات أو نقط أو رموز (ق ح ب ة / ق.ح.ب.ة)',
              '- أرقام أو حروف انجليزي بدل حروف عربي (q7ba, 3ahra)',
              '- تكرار حروف (قحححبة)',
              '- الكلمة ملفوفة جوه جملة طويلة أو بصيغة غير مباشرة لكن قصدها واضح إهانة أو سب جنسي',
              'رد بسطر واحد بالظبط، بدون أي شرح إضافي:',
              '- SAFE: لو الرسالة عادية ومفيهاش سب/قذف/إهانة جنسية أو شخصية خطيرة',
              '- UNSAFE: لو الرسالة فيها سب أو قذف أو إهانة جنسية أو شخصية، حتى لو مكتوبة بطريقة مموّهة',
              'لا تفسّر، لا تكتب غير الكلمة الوحيدة SAFE أو UNSAFE.'
            ].join('\n')
          }]
        },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { maxOutputTokens: 5, temperature: 0, thinkingConfig: { thinkingLevel: 'minimal' } }
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 8000 }
    );
    const raw = (response.data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toUpperCase();
    return { unsafe: raw.includes('UNSAFE') };
  } catch (err) {
    console.error('خطأ بفلتر السب الذكي (Gemini):', err.response?.data || err.message);
    return { unsafe: false };
  }
}

// ============ فلتر الصور/الملصقات الإباحية - fail-open ============
const CRITICAL_NSFW_CATEGORIES = ['S3', 'S4']; // خطر شديد جداً - صفر تسامح

async function moderateImageBuffer(base64Data, mimeType) {
  try {
    const response = await axios.post(
      `${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          role: 'user',
          parts: [
            {
              text: [
                'You are a strict content-safety classifier for a WhatsApp group moderation bot.',
                'Look at the image and reply with EXACTLY one line, nothing else, no explanation:',
                '- If the image has no sexual/pornographic content, reply: SAFE',
                '- If it contains sexual/pornographic content involving adults, reply: UNSAFE:SEXUAL',
                '- If it contains any sexual content involving a minor, or appears to be child sexual abuse material, reply: UNSAFE:CSAM',
                'Reply with only one of these exact tokens (SAFE / UNSAFE:SEXUAL / UNSAFE:CSAM) and nothing else.'
              ].join('\n')
            },
            { inline_data: { mime_type: mimeType, data: base64Data } }
          ]
        }],
        generationConfig: { maxOutputTokens: 10, temperature: 0, thinkingConfig: { thinkingLevel: 'minimal' } }
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    const raw = (response.data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toUpperCase();
    if (raw.includes('CSAM')) return { unsafe: true, categories: ['S4'] };
    if (raw.includes('UNSAFE') || raw.includes('SEXUAL')) return { unsafe: true, categories: ['S12'] };
    return { unsafe: false, categories: [] };
  } catch (err) {
    console.error('خطأ بفحص الصورة (Gemini):', err.response?.data || err.message);
    return { unsafe: false, categories: [] };
  }
}

// ============ تخزين التحذيرات ============
function warningsFilePath(persistDir) {
  return path.join(persistDir, 'data', 'warnings.json');
}

function loadWarnings(persistDir) {
  try {
    const file = warningsFilePath(persistDir);
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
  } catch (err) {
    console.error('خطأ بقراءة ملف التحذيرات:', err.message);
    return [];
  }
}

function saveWarnings(persistDir, warnings) {
  try {
    const file = warningsFilePath(persistDir);
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(warnings, null, 2), 'utf8');
  } catch (err) {
    console.error('خطأ بحفظ ملف التحذيرات:', err.message);
  }
}

function getWarningCount(persistDir, userId, chatId) {
  const warnings = loadWarnings(persistDir);
  const entry = warnings.find((w) => w.userId === userId && w.chatId === chatId);
  return entry ? entry.count : 0;
}

function addWarning(persistDir, userId, chatId) {
  const warnings = loadWarnings(persistDir);
  let entry = warnings.find((w) => w.userId === userId && w.chatId === chatId);
  if (!entry) {
    entry = { userId, chatId, count: 0 };
    warnings.push(entry);
  }
  entry.count += 1;
  saveWarnings(persistDir, warnings);
  return entry.count;
}

function resetWarnings(persistDir, userId, chatId) {
  const warnings = loadWarnings(persistDir);
  const filtered = warnings.filter((w) => !(w.userId === userId && w.chatId === chatId));
  saveWarnings(persistDir, filtered);
}

// ============ بانرات التحذيرات/الطرد ============
function kickBanner(targetLine, executorLine) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '👢⃝⚡ *تـم طـرد الـعـضـو بـنـجـاح*',
    `👤⃝⚡ *الـمـسـتـخـدم:* ${targetLine}`,
    `👤⃝⚡ *مـنفـذ الـطـرد:* ${executorLine}`,
    '',
    '✅ *تـم الـتـنـفـيـذ بـواسـطـة الـنـظـام*',
    '',
    ' ִᗀᩙᰰ ̼𝆬🔥̸〫 ᮭ࣪࣪ 𝗧𝗢𝗝𝗜 𝗕𝗢𝗧 𖤍 𝅄 ۫ ִᗀᩙᰰ ̼𝆬🔥',
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function newWarningBanner(targetLine, count, max) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🔔⃝⚡ *إنـذار جـديـد*',
    `👤⃝⚡ *الـعـضـو:* ${targetLine}`,
    `📊⃝⚡ *الـعـدد:* ${count}/${max}`,
    '',
    '⚠️ *خـلـي لـسـانـك عـدلـيـن مـعـشـر*',
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function finalWarningKickBanner(targetLine, executorLine) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🚫⃝⚡ *إنـذار نـهـائـي وطـرد*',
    `👤⃝⚡ *الـعـضـو:* ${targetLine}`,
    `👤⃝⚡ *مـنـفـذ الـطـرد:* ${executorLine}`,
    '',
    '✅ *تـم الـتـنـفـيـذ بـواسـطـة الـنـظـام*',
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function violationDmBanner(reasonText, memberLine, count, max) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '⚡⃝🌙 *سـبـب الـتـحـذيـر:*',
    `> ${reasonText}`,
    '',
    `🌙⃝⚡ *الـعـضـو:* ${memberLine}`,
    '',
    `تـم تسـجيـل الـتحـذيـر، مـعـاك ${count}/${max} 🌙`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function warningCountBanner(targetLine, count, max) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '📊⃝⚡ *عـدد الـتـحـذيـرات*',
    `👤⃝⚡ *الـعـضـو:* ${targetLine}`,
    `📊⃝⚡ *الـعـدد:* ${count}/${max}`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function warningsResetBanner(targetLine) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '✅⃝⚡ *تـصـفـيـر الـتـحـذيـرات*',
    `👤⃝⚡ *الـعـضـو:* ${targetLine}`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

// ============ تنفيذ عقوبة السب (حذف الرسالة + تحذير + طرد عند الوصول للحد) - نسخة Baileys ============
// msg: عنصر رسالة Baileys كامل (من messages.upsert) - لازم يحتوي key وmessage
async function punishProfanity(sock, persistDir, groupJid, msg, authorJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    const senderParticipant = meta.participants.find((p) => p.id === authorJid);

    // المشرف مستثنى بالكامل
    if (senderParticipant && (senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin')) {
      return;
    }

    // حذف الرسالة المسيئة (لازم البوت يكون أدمن بالجروب)
    try {
      await sock.sendMessage(groupJid, { delete: msg.key });
    } catch (delErr) {
      console.error('ما قدرت أحذف الرسالة المسيئة:', delErr.message);
    }

    const numberTag = `@${jidToNumber(authorJid)}`;
    const newCount = addWarning(persistDir, authorJid, groupJid);

    if (newCount >= MAX_WARNINGS) {
      resetWarnings(persistDir, authorJid, groupJid);
      try {
        const botJid = sock.user?.id;
        const botParticipant = meta.participants.find((p) => jidToNumber(p.id) === jidToNumber(botJid));
        const botIsAdmin = botParticipant && (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin');

        if (botIsAdmin) {
          await sock.groupParticipantsUpdate(groupJid, [authorJid], 'remove');
          await sock.sendMessage(groupJid, {
            text: kickBanner(numberTag, 'مراد 🔥 (تلقائي - تجاوز التحذيرات)'),
            mentions: [authorJid]
          });
        } else {
          await sock.sendMessage(groupJid, {
            text: `${numberTag} وصل ${MAX_WARNINGS} تحذيرات وكان لازم يتطرد، بس أنا مش أدمن هنا، خلوني أدمن 🙏`,
            mentions: [authorJid]
          });
        }
      } catch (kickErr) {
        console.error('خطأ بطرد العضو تلقائي:', kickErr.message);
      }
    } else {
      await sock.sendMessage(groupJid, {
        text: newWarningBanner(numberTag, newCount, MAX_WARNINGS),
        mentions: [authorJid]
      });
    }
  } catch (filterErr) {
    console.error('خطأ بفلتر الألفاظ:', filterErr.message);
  }
}

module.exports = {
  MAX_WARNINGS,
  BAD_WORDS,
  normalizeForFilter,
  containsBadWord,
  moderateTextForProfanity,
  moderateImageBuffer,
  CRITICAL_NSFW_CATEGORIES,
  loadWarnings,
  saveWarnings,
  getWarningCount,
  addWarning,
  resetWarnings,
  kickBanner,
  newWarningBanner,
  finalWarningKickBanner,
  violationDmBanner,
  warningCountBanner,
  warningsResetBanner,
  punishProfanity
};
