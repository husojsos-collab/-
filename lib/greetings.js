// ============ إشعارات تحديثات الجروب (ترقية/تنزيل إداري، صورة، رابط دعوة) ============
// ملاحظة: ميزة الترحيب والوداع (رسالة لما عضو ينضم/يخرج) اتحذفت بالكامل بطلب المستخدم.

const { jidToNumber } = require('./util');
const path = require('path');
const fs = require('fs');

// ============ تسجيل "آخر عضو انضم" لكل جروب (يُستخدم زر "طرد آخر عضو دخل" باللوحة) ============
function lastJoinedFilePath(persistDir) {
  return path.join(persistDir, 'last-joined.json');
}

function recordLastJoined(persistDir, groupJid, participantJid) {
  try {
    const file = lastJoinedFilePath(persistDir);
    let data = {};
    if (fs.existsSync(file)) data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data[groupJid] = { jid: participantJid, time: new Date().toISOString() };
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('خطأ بتسجيل آخر عضو انضم:', err.message);
  }
}

function getLastJoined(persistDir, groupJid) {
  try {
    const file = lastJoinedFilePath(persistDir);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return data[groupJid] || null;
  } catch (err) {
    return null;
  }
}

// ============ معالج حدث ترقية/تنزيل عضو (group-participants.update بـ Baileys) ============
// update: { id: groupJid, participants: [jid,...], action: 'add'|'remove'|'promote'|'demote', author?: jid }
async function handleGroupParticipantsUpdate(sock, imagesDir, update, persistDir) {
  try {
    const { id: groupJid, participants, action, author } = update;

    // -------- عضو جديد انضم (add) — نسجّله عشان زر "طرد آخر عضو دخل" باللوحة --------
    if (action === 'add' && persistDir) {
      const joinedJid = participants && participants[0];
      if (joinedJid) recordLastJoined(persistDir, groupJid, joinedJid);
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
  handleGroupsUpdate,
  getLastJoined
};
