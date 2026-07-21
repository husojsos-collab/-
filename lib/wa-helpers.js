// ============ أدوات مساعدة لاستخراج المعلومات من رسائل Baileys ============
// whatsapp-web.js كان يوفر methods جاهزة (message.body, message.getContact()...).
// Baileys بيرجع الرسالة كـ object خام، فهاي الدوال بتعمل نفس الدور يدوياً.

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { jidToNumber, isGroupJid } = require('./util');

// ============ نص الرسالة (مكافئ message.body) ============
function getMessageText(msg) {
  const m = msg.message;
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  ).trim();
}

function getChatId(msg) {
  return msg.key.remoteJid;
}

// معرف كاتب الرسالة (بالجروب: participant ، بالخاص: نفس remoteJid)
function getAuthorId(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

function isFromMe(msg) {
  return !!msg.key.fromMe;
}

// ============ المنشونات (مكافئ message.getMentions()) ============
function getMentionedJids(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  return ctx?.mentionedJid || [];
}

// ============ الرسالة المقتبسة (Reply) - مكافئ hasQuotedMsg/getQuotedMessage ============
function hasQuotedMessage(msg) {
  return !!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
}

function getQuotedInfo(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  if (!ctx || !ctx.quotedMessage) return null;
  return {
    message: ctx.quotedMessage,
    stanzaId: ctx.stanzaId, // معرف الرسالة الأصلية (نستخدمه بدل message.id._serialized)
    participant: ctx.participant, // مين بعت الرسالة الأصلية
    fromMe: ctx.participant ? undefined : undefined // بيتحدد لاحقاً بمقارنة sock.user.id
  };
}

function getQuotedText(quotedMessage) {
  if (!quotedMessage) return '';
  return quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || '';
}

// ============ نوع الميديا (صورة/صوت/فيديو/ملصق) ============
function getMediaType(msg) {
  const m = msg.message;
  if (!m) return null;
  if (m.imageMessage) return 'image';
  if (m.stickerMessage) return 'sticker';
  if (m.videoMessage) return 'video';
  if (m.audioMessage) return m.audioMessage.ptt ? 'ptt' : 'audio';
  return null;
}

// ============ تحميل الميديا (مكافئ message.downloadMedia()) ============
async function downloadMedia(msg) {
  const m = msg.message;
  if (!m) return null;
  let content = null;
  let type = null;
  let mimetype = null;

  if (m.imageMessage) { content = m.imageMessage; type = 'image'; mimetype = m.imageMessage.mimetype; }
  else if (m.stickerMessage) { content = m.stickerMessage; type = 'sticker'; mimetype = m.stickerMessage.mimetype; }
  else if (m.videoMessage) { content = m.videoMessage; type = 'video'; mimetype = m.videoMessage.mimetype; }
  else if (m.audioMessage) { content = m.audioMessage; type = 'audio'; mimetype = m.audioMessage.mimetype; }

  if (!content) return null;

  const stream = await downloadContentFromMessage(content, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return { buffer: Buffer.concat(chunks), mimetype };
}

// نفس فكرة downloadMedia بس للرسالة المقتبسة (quotedMessage object مش msg كامل)
async function downloadQuotedMedia(quotedMessage) {
  if (!quotedMessage) return null;
  let content = null;
  let type = null;
  let mimetype = null;

  if (quotedMessage.imageMessage) { content = quotedMessage.imageMessage; type = 'image'; mimetype = quotedMessage.imageMessage.mimetype; }
  else if (quotedMessage.videoMessage) { content = quotedMessage.videoMessage; type = 'video'; mimetype = quotedMessage.videoMessage.mimetype; }

  if (!content) return null;

  const stream = await downloadContentFromMessage(content, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return { buffer: Buffer.concat(chunks), mimetype };
}

// ============ تحديد الهدف: منشن أو رد (Reply) بدون منشن ============
// لو فيه منشن @شخص → نرجعه هو.
// لو ماكو منشن بس الرسالة رد (Reply) على رسالة ثانية → نرجع صاحب الرسالة المردود عليها.
// لو ماكو منشن ولا رد → نرجع array فاضي.
function resolveTargets(msg) {
  const mentioned = getMentionedJids(msg);
  if (mentioned.length > 0) return mentioned;

  const quotedInfo = getQuotedInfo(msg);
  if (quotedInfo && quotedInfo.participant) {
    return [quotedInfo.participant];
  }

  return [];
}

// ============ فحوصات الأدمن بالجروب ============
function isParticipantAdmin(groupMeta, jid) {
  const p = groupMeta.participants.find((pp) => pp.id === jid);
  return !!(p && (p.admin === 'admin' || p.admin === 'superadmin'));
}

function isBotAdmin(groupMeta, botJid) {
  const botNumber = jidToNumber(botJid);
  const p = groupMeta.participants.find((pp) => jidToNumber(pp.id) === botNumber);
  return !!(p && (p.admin === 'admin' || p.admin === 'superadmin'));
}

// ============ رد سريع (مكافئ message.reply) ============
async function reply(sock, msg, text) {
  return sock.sendMessage(getChatId(msg), { text }, { quoted: msg });
}

// ============ منشن كتاجات @رقم لعرض بالنص ============
function tag(jid) {
  return `@${jidToNumber(jid)}`;
}

module.exports = {
  getMessageText,
  getChatId,
  getAuthorId,
  isFromMe,
  getMentionedJids,
  resolveTargets,
  hasQuotedMessage,
  getQuotedInfo,
  getQuotedText,
  getMediaType,
  downloadMedia,
  downloadQuotedMedia,
  isParticipantAdmin,
  isBotAdmin,
  reply,
  tag,
  isGroupJid
};
