// ============ الترحيب والوداع + إشعارات تحديثات الجروب ============
// ⛔ ملاحظة مهمة: رسالة الترحيب والوداع كانت معطّلة بالكود الأصلي بطلب المستخدم
// (19 يوليو 2026) - نفس التعطيل محفوظ هنا تماماً (الدوال موجودة وجاهزة، بس ما بتتنادى).
// لو حبيت ترجعها، فعّل الاستدعاء بـ index.js بمكان التعليق "TODO: welcome/goodbye".

const { getProfilePicBuffer, buildGreetingImage } = require('./media');
const { canonicalJid, jidToNumber } = require('./util');

// حارس ضد التكرار (نفس فكرة shouldSendGreeting الأصلية)
const recentGreetings = new Map();
const GREETING_DEDUPE_WINDOW_MS = 8000;

function shouldSendGreeting(chatId, contactId, type) {
  const key = `${chatId}::${contactId || 'unknown'}::${type}`;
  const now = Date.now();
  const lastSent = recentGreetings.get(key);
  if (lastSent && now - lastSent < GREETING_DEDUPE_WINDOW_MS) return false;
  recentGreetings.set(key, now);
  if (recentGreetings.size > 500) {
    for (const [k, ts] of recentGreetings) {
      if (now - ts >= GREETING_DEDUPE_WINDOW_MS) recentGreetings.delete(k);
    }
  }
  return true;
}

// ============ وقت ليبيا (Africa/Tripoli) لكابشن الترحيب والوداع ============
function formatTripoliTime(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Tripoli',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

function buildWelcomeCaption(mentionTag, memberCount) {
  const countLine = memberCount != null ? `#${memberCount}` : '#?';
  return `「👑 NEW MEMBER 👑」\nWELCOME : ${mentionTag} ✋\nMEMBER № : ${countLine}\nJOINED AT : ${formatTripoliTime()}`;
}

function buildGoodbyeCaption(mentionTag, memberCount) {
  const countLine = memberCount != null ? `#${memberCount}` : '#?';
  return `「👋 GOOD BYE 👋」\nLEFT : ${mentionTag}\nMEMBER № : ${countLine}\nLEFT AT : ${formatTripoliTime()}`;
}

// جهز البانر (ترحيب/وداع) وابعته، ولو فشلت الصورة ابعت كابشن نصي بديل
// sock: الاتصال (makeWASocket)، memberJid: معرف العضو المنضم/الخارج، groupJid: معرف الجروب
async function sendGreetingBanner(sock, imagesDir, groupJid, templateName, memberJid, caption, mentions = []) {
  try {
    const fallbackLetter = jidToNumber(memberJid) || '?';
    const picBuffer = memberJid ? await getProfilePicBuffer(sock, memberJid) : null;
    const finalImage = await buildGreetingImage(imagesDir, templateName, picBuffer, fallbackLetter);
    await sock.sendMessage(groupJid, { image: finalImage, caption, mentions });
  } catch (imgErr) {
    console.error(`فشل تجهيز صورة ${templateName}:`, imgErr.message);
    try {
      await sock.sendMessage(groupJid, { text: caption, mentions });
    } catch (sendErr) {
      console.error('فشل إرسال كابشن الترحيب/الوداع كنص بديل:', sendErr.message);
    }
  }
}

function getGroupMemberCount(groupMetadata) {
  return Array.isArray(groupMetadata?.participants) ? groupMetadata.participants.length : null;
}

// ============ معالج حدث انضمام/خروج/ترقية/تنزيل عضو (group-participants.update بـ Baileys) ============
// update: { id: groupJid, participants: [jid,...], action: 'add'|'remove'|'promote'|'demote', author?: jid }
async function handleGroupParticipantsUpdate(sock, imagesDir, update, fetchGroupMetadata) {
  try {
    const { id: groupJid, participants, action, author } = update;

    // -------- عضو انضم --------
    // ⛔ معطّل بطلب المستخدم (زي الأصل بالضبط) - خليتها جاهزة لو حبيت ترجعها بالمستقبل
    if (action === 'add') {
      return;
      // eslint-disable-next-line no-unreachable
      for (const memberJid of participants) {
        if (!shouldSendGreeting(groupJid, memberJid, 'welcome')) continue;
        const meta = await fetchGroupMetadata(groupJid);
        const caption = buildWelcomeCaption(`@${jidToNumber(memberJid)}`, getGroupMemberCount(meta));
        await sendGreetingBanner(sock, imagesDir, groupJid, 'welcome', memberJid, caption, [memberJid]);
      }
      return;
    }

    // -------- عضو خرج/اتشال --------
    // ⛔ معطّل بطلب المستخدم (زي الأصل بالضبط)
    if (action === 'remove') {
      return;
      // eslint-disable-next-line no-unreachable
      for (const memberJid of participants) {
        if (!shouldSendGreeting(groupJid, memberJid, 'goodbye')) continue;
        const meta = await fetchGroupMetadata(groupJid);
        const caption = buildGoodbyeCaption(`@${jidToNumber(memberJid)}`, getGroupMemberCount(meta));
        await sendGreetingBanner(sock, imagesDir, groupJid, 'goodbye', memberJid, caption, [memberJid]);
      }
      return;
    }

    // -------- إزالة عضو من الإدارة (demote) --------
    if (action === 'demote') {
      const demotedJid = participants && participants[0];
      const banner = [
        '⌬──══┈•⤣🪐⤤•┈══──⌬',
        '',
        '◈╎ `تـم إزالـة عـضـو مـن الإدارة`',
        '── • ◈ • ──',
        `◞🪶◜⇓ ۬.͜ـ🌗˖ ⟨بواسـطـة: @${jidToNumber(author) || '؟'}⟩`,
        `◞🪶◜⇓ ۬.͜ـ🌗˖ ⟨العـضـو: @${jidToNumber(demotedJid) || '؟'}⟩`,
        '',
        '───── ꒰ა⋟﹏⋞໒꒱ ─────',
        '⌬──══┈•⤣🪐⤤•┈══──⌬'
      ].join('\n');
      const mentions = [author, demotedJid].filter(Boolean);
      await sock.sendMessage(groupJid, { text: banner, mentions });
    }
  } catch (err) {
    console.error('خطأ بمعالجة تحديث أعضاء الجروب:', err.message);
  }
}

// ============ معالج حدث تغيير بيانات الجروب (groups.update بـ Baileys: صورة/وصف/رابط دعوة) ============
// ملاحظة: على عكس group-participants.update، حدث groups.update بـ Baileys غالباً
// ما بيجيبش "مين اللي غيّر" (author) بشكل موثوق لكل الحالات - فمنعرض "؟" لو مو متوفر،
// بنفس فكرة `actor?.number || '؟'` الأصلية.
async function handleGroupsUpdate(sock, updates) {
  for (const update of updates) {
    try {
      const groupJid = update.id;
      if (!groupJid) continue;
      const authorTag = jidToNumber(update.author) || '؟';

      if (Object.prototype.hasOwnProperty.call(update, 'imgUrl') || update.picture !== undefined) {
        const banner = [
          '⌬──══┈•⤣🪐⤤•┈══──⌬',
          '',
          '◈╎ `تـم تـغـيـيـر صـورة الـمـجـمـوعـة`',
          '── • ◈ • ──',
          `◞🪶◜⇓ ۬.͜ـ🌗˖ ⟨بواسـطـة: @${authorTag}⟩`,
          '',
          '───── ꒰ა⋟﹏⋞໒꒱ ─────',
          '⌬──══┈•⤣🪐⤤•┈══──⌬'
        ].join('\n');
        await sock.sendMessage(groupJid, { text: banner, mentions: update.author ? [update.author] : [] });
        continue;
      }

      if (update.inviteCode !== undefined) {
        const banner = [
          '⌬──══┈•⤣🪐⤤•┈══──⌬',
          '',
          '◈╎ `تـم تـغـيـيـر رابـط الـدعـوة`',
          '── • ◈ • ──',
          `◞🪶◜⇓ ۬.͜ـ🌗˖ ⟨بواسـطـة: @${authorTag}⟩`,
          '',
          '⌬──══┈•⤣🪐⤤•┈══─'
        ].join('\n');
        await sock.sendMessage(groupJid, { text: banner, mentions: update.author ? [update.author] : [] });
      }
    } catch (err) {
      console.error('خطأ بمعالجة تحديث بيانات الجروب:', err.message);
    }
  }
}

module.exports = {
  shouldSendGreeting,
  formatTripoliTime,
  buildWelcomeCaption,
  buildGoodbyeCaption,
  sendGreetingBanner,
  getGroupMemberCount,
  handleGroupParticipantsUpdate,
  handleGroupsUpdate
};
