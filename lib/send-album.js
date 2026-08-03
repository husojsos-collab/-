// ============ send-album.js ============
// يبعث ألبوم صور/فيديو حقيقي بواتساب (تسحب بينهم بإصبعك داخل نفس
// الرسالة) - بدون أي مكتبة خارجية غير رسمية. يستخدم بس دوال رسمية
// موجودة أصلاً جوه @whiskeysockets/baileys (اللي عندك مثبتة أصلاً):
// generateWAMessageFromContent و relayMessage.
//
// ⚠️ ملاحظة صراحة: ميزة "الألبوم" نفسها مو موثقة رسمياً من واتساب/
// Baileys، فالطريقة هذي مبنية على أمثلة من مكتبات ثانية غير رسمية
// (بس إحنا ما نستخدم كودهم، بس نفس الفكرة بدوالنا الرسمية). ممكن
// تحتاج تعديل بسيط لو واتساب غيّر شكل البروتوكول.

const { generateWAMessageFromContent, generateWAMessage } = require('@whiskeysockets/baileys');

/**
 * @param {*} sock - اتصال Baileys الحالي
 * @param {string} jid - آيدي الشات
 * @param {Array<{type: 'image'|'video', data: {url: string}, caption?: string}>} medias
 * @param {{caption?: string}} options
 */
async function sendAlbumMessage(sock, jid, medias, options = {}) {
  const imageCount = medias.filter((m) => m.type === 'image').length;
  const videoCount = medias.filter((m) => m.type === 'video').length;

  // 1) رسالة "الحاوية" - تعلن لواتساب إنه جاي ألبوم فيه كذا صورة/فيديو
  const albumMsg = generateWAMessageFromContent(
    jid,
    {
      albumMessage: {
        expectedImageCount: imageCount,
        expectedVideoCount: videoCount
      }
    },
    { userJid: sock.user.id }
  );
  console.log('[ألبوم] بوت JID:', sock.user?.id);
  console.log('[ألبوم] رسالة الحاوية key:', JSON.stringify(albumMsg.key));
  await sock.relayMessage(jid, albumMsg.message, { messageId: albumMsg.key.id });

  // 2) نبعت كل صورة/فيديو مربوطة بالحاوية عن طريق messageAssociation
  for (let i = 0; i < medias.length; i++) {
    const media = medias[i];
    const isFirst = i === 0;

    const itemMsg = await generateWAMessage(
      jid,
      {
        [media.type]: media.data,
        caption: isFirst ? options.caption || media.caption || '' : undefined
      },
      { upload: sock.waUploadToServer, userJid: sock.user.id }
    );
    console.log(`[ألبوم] صورة ${i + 1} key:`, JSON.stringify(itemMsg.key));

    const innerKey = `${media.type}Message`;
    if (itemMsg.message[innerKey]) {
      itemMsg.message[innerKey].contextInfo = {
        ...(itemMsg.message[innerKey].contextInfo || {}),
        messageAssociation: {
          associationType: 1,
          parentMessageKey: albumMsg.key
        }
      };
    }

    await sock.relayMessage(jid, itemMsg.message, { messageId: itemMsg.key.id });
  }

  return albumMsg;
}

module.exports = { sendAlbumMessage };
