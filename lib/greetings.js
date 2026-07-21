// ============ إشعارات تحديثات الجروب (ترقية/تنزيل إداري، صورة، رابط دعوة) ============
// ملاحظة: ميزة الترحيب والوداع (رسالة لما عضو ينضم/يخرج) اتحذفت بالكامل بطلب المستخدم.

const { jidToNumber } = require('./util');

// ============ معالج حدث ترقية/تنزيل عضو (group-participants.update بـ Baileys) ============
// update: { id: groupJid, participants: [jid,...], action: 'add'|'remove'|'promote'|'demote', author?: jid }
async function handleGroupParticipantsUpdate(sock, imagesDir, update) {
  try {
    const { id: groupJid, participants, action, author } = update;

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

// ============ معالج حدث تغيير بيانات الجروب (groups.update بـ Baileys: صورة/رابط دعوة) ============
// ملاحظة: Baileys غالباً ما بيجيبش "مين اللي غيّر" (author) بشكل موثوق لكل الحالات،
// فمنعرض "؟" لو مو متوفر (نفس فكرة الأصل `actor?.number || '؟'`).
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
  handleGroupParticipantsUpdate,
  handleGroupsUpdate
};
