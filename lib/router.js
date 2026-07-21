// ============ معالجة كل الرسائل (النسخة الكاملة - Baileys) ============
// نفس ترتيب الفحوصات والنصوص والمنطق من index.js القديم بالظبط، بس بواجهة Baileys.
// XP اتحذف بالكامل بطلب المستخدم، فكل نقاط تسجيل/مكافأة XP اتشالت من هون.

const path = require('path');
const wa = require('./wa-helpers');
const { jidToNumber, numberToJid, getCountryFlag } = require('./util');
const moderation = require('./moderation');
const links = require('./links');
const marriage = require('./marriage');
const games = require('./games');
const ai = require('./ai');
const media = require('./media');
const banners = require('./banners');
const greetings = require('./greetings');
const { SHARED_LINK, GROQ_API_KEY } = require('./config');
const prayer = require('../prayer');
const { textToVoiceBuffer, transcribeVoiceBuffer } = require('../voice');

// حالة تفعيل الذكاء الصناعي (تتحكم فيها !توقف و !تشغيل) - بالذاكرة، نفس الأصل
let aiEnabled = true;

// أسئلة !دين (محمّلة مرة وحدة عند تشغيل البوت)
let DEAN_QUESTIONS = [];

function initRouter(baseDir) {
  DEAN_QUESTIONS = games.loadDeanQuestions(baseDir);
}

// دالة موحّدة: هل المرسل أدمن بالجروب؟ (بترجع false لو مو جروب أصلاً)
async function senderIsAdmin(sock, chatId, authorId) {
  if (!wa.isGroupJid(chatId)) return false;
  const meta = await sock.groupMetadata(chatId);
  return wa.isParticipantAdmin(meta, authorId);
}

async function botIsAdminInGroup(sock, chatId) {
  const meta = await sock.groupMetadata(chatId);
  return wa.isBotAdmin(meta, sock.user?.id);
}

// ============ المعالج الرئيسي - بينادى لكل رسالة توصل (messages.upsert) ============
async function handleMessagesUpsert(sock, upsert, imagesDir, persistDir) {
  if (upsert.type !== 'notify') return;

  for (const msg of upsert.messages) {
    try {
      await handleSingleMessage(sock, msg, imagesDir, persistDir);
    } catch (err) {
      console.error('خطأ بمعالجة الرسالة:');
      console.error('MSG:', err?.message || '(no message)');
      console.error('NAME:', err?.name || '(no name)');
      if (err?.stack) console.error('STACK:', err.stack);
    }
  }
}

async function handleSingleMessage(sock, msg, imagesDir, persistDir) {
  if (!msg.message) return; // رسائل بروتوكول فاضية (زي حذف/رياكشن) - نتجاهلها

  const chatId = wa.getChatId(msg);
  const isGroup = wa.isGroupJid(chatId);
  const fromMe = wa.isFromMe(msg);
  const body = wa.getMessageText(msg);
  const authorId = wa.getAuthorId(msg);
  const convoKey = `${chatId}_${authorId}`;

  // -------- فحص جواب تحدي معلّق --------
  if (!fromMe && body && !body.startsWith('!')) {
    const activeChallenge = games.pendingChallenges.get(chatId);
    if (activeChallenge && games.normalizeAnswer(body) === games.normalizeAnswer(activeChallenge.answer)) {
      clearTimeout(activeChallenge.timer);
      games.pendingChallenges.delete(chatId);
      try {
        await sock.sendMessage(chatId, {
          text: games.challengeWinnerBanner(wa.tag(authorId), activeChallenge.answer),
          mentions: [authorId]
        });
      } catch (challErr) {
        console.error('خطأ بمعالجة الفوز بالتحدي:', challErr.message);
      }
      return;
    }
  }

  // -------- فحص جواب سؤال ديني معلّق --------
  if (!fromMe && body && !body.startsWith('!')) {
    const activeDean = games.pendingDeanQuestions.get(chatId);
    if (activeDean && games.normalizeAnswer(body) === games.normalizeAnswer(activeDean.answer)) {
      clearTimeout(activeDean.timer);
      games.pendingDeanQuestions.delete(chatId);
      try {
        await sock.sendMessage(chatId, {
          text: games.deanWinnerBanner(wa.tag(authorId), activeDean.answer),
          mentions: [authorId]
        });
      } catch (deanErr) {
        console.error('خطأ بمعالجة الفوز بالسؤال الديني:', deanErr.message);
      }
      return;
    }
  }

  // -------- فلتر الروابط --------
  if (isGroup && !fromMe && body && links.isLinksBlockEnabled(persistDir, chatId) && links.LINK_REGEX.test(body)) {
    try {
      const meta = await sock.groupMetadata(chatId);
      const senderIsAdminNow = wa.isParticipantAdmin(meta, authorId);
      if (!senderIsAdminNow) {
        try {
          await sock.sendMessage(chatId, { delete: msg.key });
        } catch (delErr) {
          console.error('ما قدرت أحذف الرابط:', delErr.message);
        }

        const newCount = moderation.addWarning(persistDir, authorId, chatId);
        if (newCount >= moderation.MAX_WARNINGS) {
          moderation.resetWarnings(persistDir, authorId, chatId);
          const botAdmin = wa.isBotAdmin(meta, sock.user?.id);
          if (botAdmin) {
            await sock.groupParticipantsUpdate(chatId, [authorId], 'remove');
            await sock.sendMessage(chatId, {
              text: moderation.finalWarningKickBanner(wa.tag(authorId), 'مراد 🔥 (تلقائي - تجاوز التحذيرات بسبب الروابط)'),
              mentions: [authorId]
            });
          } else {
            await sock.sendMessage(chatId, {
              text: `${wa.tag(authorId)} وصل ${moderation.MAX_WARNINGS} تحذيرات وكان لازم يتطرد، بس أنا مش أدمن هنا، خلوني أدمن 🙏`,
              mentions: [authorId]
            });
          }
        } else {
          await sock.sendMessage(chatId, {
            text: moderation.newWarningBanner(wa.tag(authorId), newCount, moderation.MAX_WARNINGS),
            mentions: [authorId]
          });
        }
        return;
      }
    } catch (linkErr) {
      console.error('خطأ بفلتر الروابط:', linkErr.message);
    }
  }

  // -------- فلتر الألفاظ (قائمة ثابتة + AI للكلام المموّه) --------
  if (isGroup && body && !body.startsWith('!')) {
    if (moderation.containsBadWord(body)) {
      await moderation.punishProfanity(sock, persistDir, chatId, msg, authorId);
      return;
    }
    const aiCheck = await moderation.moderateTextForProfanity(body);
    if (aiCheck.unsafe) {
      await moderation.punishProfanity(sock, persistDir, chatId, msg, authorId);
      return;
    }
  }

  // -------- فلتر الصور/الملصقات الإباحية --------
  const mediaType = wa.getMediaType(msg);
  if (isGroup && !fromMe && (mediaType === 'image' || mediaType === 'sticker')) {
    try {
      const meta = await sock.groupMetadata(chatId);
      const senderIsAdminNow = wa.isParticipantAdmin(meta, authorId);
      if (!senderIsAdminNow) {
        const downloaded = await wa.downloadMedia(msg);
        if (downloaded) {
          const base64Data = downloaded.buffer.toString('base64');
          const result = await moderation.moderateImageBuffer(base64Data, downloaded.mimetype);
          if (result.unsafe) {
            try {
              await sock.sendMessage(chatId, { delete: msg.key });
            } catch (delErr) {
              console.error('ما قدرت أحذف الصورة/الملصق المخالف:', delErr.message);
            }

            const isCritical = result.categories.some((c) => moderation.CRITICAL_NSFW_CATEGORIES.includes(c));
            if (isCritical) {
              const botAdmin = wa.isBotAdmin(meta, sock.user?.id);
              if (botAdmin) {
                await sock.groupParticipantsUpdate(chatId, [authorId], 'remove');
                await sock.sendMessage(chatId, {
                  text: moderation.finalWarningKickBanner(wa.tag(authorId), 'مراد 🔥 (محتوى محظور تماماً - طرد فوري)'),
                  mentions: [authorId]
                });
              } else {
                await sock.sendMessage(chatId, {
                  text: `${wa.tag(authorId)} بعت محتوى محظور تماماً وكان لازم يتطرد فوري، بس أنا مش أدمن هنا، خلوني أدمن 🙏`,
                  mentions: [authorId]
                });
              }
            } else {
              const newCount = moderation.addWarning(persistDir, authorId, chatId);
              if (newCount >= moderation.MAX_WARNINGS) {
                moderation.resetWarnings(persistDir, authorId, chatId);
                const botAdmin = wa.isBotAdmin(meta, sock.user?.id);
                if (botAdmin) {
                  await sock.groupParticipantsUpdate(chatId, [authorId], 'remove');
                  await sock.sendMessage(chatId, {
                    text: moderation.finalWarningKickBanner(wa.tag(authorId), 'مراد 🔥 (تلقائي - محتوى إباحي)'),
                    mentions: [authorId]
                  });
                } else {
                  await sock.sendMessage(chatId, {
                    text: `${wa.tag(authorId)} وصل ${moderation.MAX_WARNINGS} تحذيرات وكان لازم يتطرد، بس أنا مش أدمن هنا، خلوني أدمن 🙏`,
                    mentions: [authorId]
                  });
                }
              } else {
                await sock.sendMessage(chatId, {
                  text: moderation.newWarningBanner(wa.tag(authorId), newCount, moderation.MAX_WARNINGS),
                  mentions: [authorId]
                });
              }
            }
            return;
          }
        }
      }
    } catch (mediaFilterErr) {
      console.error('خطأ بفلتر الصور/الملصقات:', mediaFilterErr.message);
    }
  }

  // -------- تعال [منشن] [رسالة] - أدمن بس، يبعت رسالة خاصة للمنشونين --------
  if (body.startsWith('تعال')) {
    if (isGroup && !(await senderIsAdmin(sock, chatId, authorId))) {
      await wa.reply(sock, msg, 'هاد الأمر للأدمن بس يا بطل 🚫');
      return;
    }
    const mentioned = wa.getMentionedJids(msg);
    if (mentioned.length > 0) {
      let textToSend = body.replace('تعال', '');
      mentioned.forEach((jid) => {
        textToSend = textToSend.replace(wa.tag(jid), '');
      });
      textToSend = textToSend.trim();

      if (textToSend.length > 0) {
        for (const jid of mentioned) {
          await sock.sendMessage(jid, { text: textToSend });
        }
        await wa.reply(sock, msg, 'تم إرسال الرسالة ✅');
      } else {
        await wa.reply(sock, msg, 'اكتب الرسالة اللي بدك تبعتها بعد المنشن 📩');
      }
    }
    return;
  }

  // -------- !توقف / !تشغيل --------
  if (body === '!توقف') {
    aiEnabled = false;
    await wa.reply(sock, msg, banners.muradBanner('🔇⃝⚡ *تـم إسـكـات مـراـد*'));
    return;
  }
  if (body === '!تشغيل') {
    aiEnabled = true;
    await wa.reply(sock, msg, banners.muradBanner('🎙️⃝⚡ *مـراـد رجـع لـلـحـكـي*'));
    return;
  }

  // -------- "مين مطورك" وصيغه المشابهة --------
  if (/مين\s*مطورك|من\s*مطورك|مطورك\s*مين|مين\s*سواك|من\s*صممك/i.test(body)) {
    await wa.reply(sock, msg, 'مطوري شخص واعر ماشي الحال، بس اسمه سر بيني وبينه 😏 كفاية إنه بناني زينة كدة');
    return;
  }

  // -------- "حسام" (بدون !) - يرد بجيف + شعر + منشن --------
  if (body === 'حسام') {
    try {
      const husaamJid = numberToJid(media.HUSAAM_MENTION_NUMBER);
      const caption = [
        '*꒷꒦꒷꒷꒦꒷꒷꒦꒷꒷𝅄 ۫ ִᗀᩙᰰ ̼HUSAAM  ̸〫 ᮭ࣪࣪ ⸼۫  ꒷꒦꒷꒦꒷꒷꒷꒦꒷*',
        '*⃝⚡┆حسام اسمٍ إذا مرّ، رفع الهامة فخر، وإذا عشق... صار الحب له عنوان**⃝⚡',
        '',
        `*⃝🌙┆*المنشن: ${wa.tag(husaamJid)}`,
        `*⃝⚡┆الي منشن: ${wa.tag(authorId)}`,
        '*꒷꒦꒷꒷꒦꒷꒷꒦꒷꒷𝅄 ۫ ִᗀᩙᰰ ̼𝆬🌙̸〫 ᮭ࣪࣪ ⸼۫  ꒷꒦꒷꒦꒷꒷꒷꒦꒷*',
        '',
        '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
        '©️⃝⚡ *جـمـيـع الـحـقـوق مـحـفـوظـة*',
        '👨‍💻⃝⚡ *الـمـطـور:* حـسـام بـوت 😎',
        '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
      ].join('\n');
      const gifBuffer = await media.getHusaamGifMp4Buffer(imagesDir);
      await sock.sendMessage(chatId, {
        video: gifBuffer,
        gifPlayback: true,
        caption,
        mentions: [husaamJid, authorId]
      });
    } catch (husaamErr) {
      console.error('خطأ بأمر تكريم حسام:', husaamErr.message);
    }
    return;
  }

  // -------- "سعاد" بالنص - رومانسي لو حسام، وإلا يقول متزوجة --------
  if (body.includes('سعاد')) {
    try {
      const husaamNumber = media.HUSAAM_MENTION_NUMBER;
      if (media.HUSAAM_MENTION_NUMBERS.includes(jidToNumber(authorId))) {
        const loveReplies = [
          'عيون سعاد؟ لبيه يا بعد قلبي.. ✨',
          'يا هنيالي بسماع اسمي منك، وش بدك يا عسل؟ 🍯',
          'سمعت اسمي وجيت ركض.. الجروب نور بوجودك والله 🥰',
          'سعاد كلها فدوى لعيونك، آمرني يا غالي 💖',
          'يا أخ الصبّر، كلامك الحلو هذا يضيع علوم سعاد! 🙈'
        ];
        await wa.reply(sock, msg, loveReplies[Math.floor(Math.random() * loveReplies.length)]);
      } else {
        const husaamJid = numberToJid(husaamNumber);
        const marriedReplies = [
          `يا قلبي سعاد متزوجة وقلبها كله لزوجها ${wa.tag(husaamJid)} 💍 بس محبتكم توصل بالسلامة 🌹`,
          `سعاد عروسة ${wa.tag(husaamJid)} من زمان يا غالي، ادعيلهم بالسعادة بدل الغزل 😊💛`,
          `سعاد قلبها معلّق بحد واحد بس.. زوجها ${wa.tag(husaamJid)}، بس كلامك الحلو وصلها وشكراً 🥰`
        ];
        await sock.sendMessage(chatId, {
          text: marriedReplies[Math.floor(Math.random() * marriedReplies.length)],
          mentions: [husaamJid]
        });
      }
    } catch (souadErr) {
      console.error('خطأ بأمر سعاد:', souadErr.message);
    }
    return;
  }

  // -------- غيرة: أي حد (غير حسام) يعمل منشن لحسام مباشرة --------
  if (!fromMe && !media.HUSAAM_MENTION_NUMBERS.includes(jidToNumber(authorId))) {
    const mentioned = wa.getMentionedJids(msg);
    const mentionsHusaam = mentioned.some((jid) => media.HUSAAM_MENTION_NUMBERS.includes(jidToNumber(jid)));
    if (mentionsHusaam) {
      const jealousReplies = [
        'مين ذاكرك؟! وش تبونه من حسام، امشوا حالكم 😤',
        'لا لا لا، حسام مالي غيره، امنشنوا حد ثاني 🙄🔥',
        'وش هالمنشن المفاجئ؟ حسام مشغول، جربوا بعدين 😑',
        'غيرتي طلعت.. حسام ملكي وحدي، خلوه وشانه 😤💛',
        'لو تعرفون قد إيش أغار عليه كنتوا بطلتوا تمنشنوه أصلاً 😏🔒'
      ];
      await wa.reply(sock, msg, jealousReplies[Math.floor(Math.random() * jealousReplies.length)]);
      return;
    }
  }

  // -------- "حقوق بوت" (بدون !) - فيديو ثابت --------
  if (body === 'حقوق بوت') {
    try {
      const videoBuffer = await media.getHuqoqVideoBuffer(imagesDir);
      const huqoqCaption = [
        '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
        '©️⃝⚡ *جـمـيـع الـحـقـوق مـحـفـوظـة*',
        '🔥⃝⚡ 𝗧𝗢𝗝𝗜 𝗕𝗢𝗧',
        '👨‍💻⃝⚡ *الـمـطـور:* حـسـام بـوت 😎',
        '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
      ].join('\n');
      await sock.sendMessage(chatId, { video: videoBuffer, ptv: true, caption: huqoqCaption });
    } catch (huqoqErr) {
      console.error('خطأ بأمر حقوق بوت:', huqoqErr.message);
      await wa.reply(sock, msg, 'ما قدرت أبعت الفيديو هلق، جرب بعد شوي 😅');
    }
    return;
  }

  // -------- !قفل / !فتح --------
  if (body === '!قفل' || body === '!فتح') {
    if (!isGroup) { await wa.reply(sock, msg, 'هاد الأمر يشتغل بالجروبات بس 🙅'); return; }
    if (!(await senderIsAdmin(sock, chatId, authorId))) { await wa.reply(sock, msg, 'هاد الأمر للأدمن بس يا بطل 🚫'); return; }
    if (!(await botIsAdminInGroup(sock, chatId))) { await wa.reply(sock, msg, 'لازم تخليني أدمن أول عشان أقدر أعمل هاد الشي 🙏'); return; }

    if (body === '!قفل') {
      await sock.groupSettingUpdate(chatId, 'announcement');
      await wa.reply(sock, msg, banners.muradBanner('🔐⃝⚡ *تـم قـفـل الـمـجـمـوعـة*'));
    } else {
      await sock.groupSettingUpdate(chatId, 'not_announcement');
      await wa.reply(sock, msg, banners.muradBanner('🔓⃝⚡ *تـم فـتـح الـمـجـمـوعـة*'));
    }
    return;
  }

  // -------- !فتح رابط / !قفل رابط --------
  if (body === '!فتح رابط' || body === '!قفل رابط') {
    if (!isGroup) { await wa.reply(sock, msg, 'هاد الأمر يشتغل بالجروبات بس 🙅'); return; }
    if (!(await senderIsAdmin(sock, chatId, authorId))) { await wa.reply(sock, msg, 'هاد الأمر للأدمن بس يا بطل 🚫'); return; }

    const actorTag = wa.tag(authorId);
    if (body === '!فتح رابط') {
      links.setLinksBlockEnabled(persistDir, chatId, true);
      await sock.sendMessage(chatId, { text: links.linksBanner(true, actorTag), mentions: [authorId] });
    } else {
      links.setLinksBlockEnabled(persistDir, chatId, false);
      await sock.sendMessage(chatId, { text: links.linksBanner(false, actorTag), mentions: [authorId] });
    }
    return;
  }

  // -------- !رابط --------
  if (body === '!رابط') {
    await wa.reply(sock, msg, SHARED_LINK);
    return;
  }

  // -------- !باند - طرد عضو --------
  if (body.startsWith('!باند')) {
    if (!isGroup) { await wa.reply(sock, msg, 'هاد الأمر يشتغل بالجروبات بس 🙅'); return; }
    if (!(await senderIsAdmin(sock, chatId, authorId))) { await wa.reply(sock, msg, 'هاد الأمر للأدمن بس يا بطل 🚫'); return; }
    const meta = await sock.groupMetadata(chatId);
    if (!wa.isBotAdmin(meta, sock.user?.id)) { await wa.reply(sock, msg, 'لازم تخليني أدمن أول عشان أقدر أطرد حدا 🙏'); return; }

    const mentioned = wa.resolveTargets(msg);
    if (mentioned.length === 0) { await wa.reply(sock, msg, 'لازم تعمل منشن للعضو اللي بدك تطرده، أو ترد (Reply) على رسالته 📌'); return; }

    const targetIsAdmin = mentioned.some((jid) => wa.isParticipantAdmin(meta, jid));
    if (targetIsAdmin) {
      await wa.reply(sock, msg, '❌⃝❄ *تـعـذر طـرد الـعـضـو، قـد يـكـون مـشـرفـاً أو خـطـأ فـي الـصـلاحـيـات*');
      return;
    }

    await sock.groupParticipantsUpdate(chatId, mentioned, 'remove');
    const targetLine = mentioned.map((jid) => wa.tag(jid)).join('، ');
    await sock.sendMessage(chatId, {
      text: moderation.kickBanner(targetLine, wa.tag(authorId)),
      mentions: [...mentioned, authorId]
    });
    return;
  }

  // -------- !اصعد @شخص --------
  if (body.startsWith('!اصعد')) {
    if (!isGroup) { await wa.reply(sock, msg, 'هاد الأمر يشتغل بالجروبات بس 🙅'); return; }
    if (!(await senderIsAdmin(sock, chatId, authorId))) { await wa.reply(sock, msg, 'هاد الأمر للأدمن بس يا بطل 🚫'); return; }
    if (!(await botIsAdminInGroup(sock, chatId))) { await wa.reply(sock, msg, 'لازم تخليني أدمن أول عشان أقدر أرفع حدا 🙏'); return; }

    const mentioned = wa.resolveTargets(msg);
    if (mentioned.length === 0) { await wa.reply(sock, msg, 'لازم تعمل منشن للعضو اللي بدك ترفعه أدمن، أو ترد (Reply) على رسالته 📌 مثال: !اصعد @فلان'); return; }

    try {
      await sock.groupParticipantsUpdate(chatId, mentioned, 'promote');
      const promotedLine = mentioned.map((jid) => wa.tag(jid)).join('، ');
      const banner = [
        '╭━━━ ✦ 『 𝙉𝙀𝙒 𝘼𝘿𝙈𝙄𝙉 』 ✦ ━━━╮',
        '┃ *👑 تــم تــعــيــيــن مــشــرف جــديــد*',
        '┣━━━━━━━━━━━━━━━━━━┫',
        `*┃ 👤 الــعــضــو :* ${promotedLine}`,
        '*┃ 🛡️ الــرتــبــة : مــشــرف*',
        `*┃ ⏰ الــوقــت :* ${greetings.formatTripoliTime()}`,
        '╰━━━━━━━━━━━━━━━━━━╯',
        '',
        '*✨ نــتــمــنــى لــه الــتــوفــيــق فــي مــهــامــه ✨*'
      ].join('\n');
      await sock.sendMessage(chatId, { text: banner, mentions: mentioned });
    } catch (err) {
      console.error('خطأ برفع أدمن:', err.message);
      await wa.reply(sock, msg, 'ما قدرت أرفعه أدمن، تأكد إني أدمن وعندي صلاحية 🙏');
    }
    return;
  }

  // -------- !انزل @شخص --------
  if (body.startsWith('!انزل')) {
    if (!isGroup) { await wa.reply(sock, msg, 'هاد الأمر يشتغل بالجروبات بس 🙅'); return; }
    if (!(await senderIsAdmin(sock, chatId, authorId))) { await wa.reply(sock, msg, 'هاد الأمر للأدمن بس يا بطل 🚫'); return; }
    if (!(await botIsAdminInGroup(sock, chatId))) { await wa.reply(sock, msg, 'لازم تخليني أدمن أول عشان أقدر أنزل حدا 🙏'); return; }

    const mentioned = wa.resolveTargets(msg);
    if (mentioned.length === 0) { await wa.reply(sock, msg, 'لازم تعمل منشن للعضو اللي بدك تنزله من الأدمن، أو ترد (Reply) على رسالته 📌 مثال: !انزل @فلان'); return; }

    try {
      await sock.groupParticipantsUpdate(chatId, mentioned, 'demote');
      const demotedLine = mentioned.map((jid) => wa.tag(jid)).join('، ');
      const banner = [
        '╭━━━ ✦ 『 𝘼𝘿𝙈𝙄𝙉 𝙍𝙀𝙈𝙊𝙑𝙀𝘿 』 ✦ ━━━╮',
        '┃ *⚠️ تــم إزالــة مــشــرف مــن الــمــجــمــوعــة*',
        '┣━━━━━━━━━━━━━━━━━━┫',
        `┃ *👤 الــعــضــو :* ${demotedLine}`,
        '┃*🛡️ الــرتــبــة الــســابــقــة : مــشــرف*',
        `┃ *⏰ الــوقــت :* ${greetings.formatTripoliTime()}`,
        '╰━━━━━━━━━━━━━━━━━━╯',
        '',
        '*✨ شــكــراً لــه عــلــى مــجــهــوداتــه ✨*'
      ].join('\n');
      await sock.sendMessage(chatId, { text: banner, mentions: mentioned });
    } catch (err) {
      console.error('خطأ بتنزيل أدمن:', err.message);
      await wa.reply(sock, msg, 'ما قدرت أنزله من الأدمن، تأكد إني أدمن وعندي صلاحية 🙏');
    }
    return;
  }

  // -------- !منشن [رسالة] - منشن جماعي --------
  if (body.startsWith('!منشن')) {
    if (!isGroup) { await wa.reply(sock, msg, 'هاد الأمر يشتغل بالجروبات بس 🙅'); return; }
    if (!(await senderIsAdmin(sock, chatId, authorId))) { await wa.reply(sock, msg, 'هاد الأمر للأدمن بس يا بطل 🚫'); return; }

    try {
      const meta = await sock.groupMetadata(chatId);
      const extraText = body.replace('!منشن', '').trim();
      const admins = meta.participants.filter((p) => p.admin === 'admin' || p.admin === 'superadmin');
      const members = meta.participants.filter((p) => !(p.admin === 'admin' || p.admin === 'superadmin'));
      const mentionIds = meta.participants.map((p) => p.id);

      const adminLines = admins.map((p) => `˼🌝˹ ┃${getCountryFlag(jidToNumber(p.id))} @${jidToNumber(p.id)}`);
      const memberLines = members.map((p, idx) => {
        const moon = idx === members.length - 1 ? '🌚' : '🌝';
        return `˼${moon}˹ ┃${getCountryFlag(jidToNumber(p.id))} @${jidToNumber(p.id)}`;
      });

      const banner = [
        '❅ ━━━━ »✥«💀»✥« ━━━━ ❅',
        '*❍ 𝗧𝗢𝗝𝗜 𝗕𝗢𝗧*  😙╵𖣔╷↶',
        '❅ ━━━━ »✥«💀»✥« ━━━━ ❅',
        ...(extraText ? [extraText, '❅ ━━━━ »✥«💀»✥« ━━━━ ❅'] : []),
        `*المشرفون (${admins.length})*`,
        ...adminLines,
        '',
        `*الأعضاء (${members.length})*`,
        ...memberLines,
        '',
        '❅ ━━━━ »✥«🦆»✥« ━━━━ ❅',
        '˼⚡˹ ┃حسام لديكم لا خوف عليكم… 🦆',
        '˼🖤˹ ┃لا مكان هروب للاوغاد🖤',
        '˼☠️˹ ┃الفاتح دم من دماء الرجال☠️',
        '❅ ━━━━ »✥«🦆»✥« ━━━━ ❅'
      ].join('\n');
      await sock.sendMessage(chatId, { text: banner, mentions: mentionIds });
    } catch (err) {
      console.error('خطأ بأمر المنشن الجماعي:', err.message);
      await wa.reply(sock, msg, 'ما قدرت أعمل المنشن الجماعي هلق، جرب بعد شوي 😅');
    }
    return;
  }

  // -------- !تغيير_صورة --------
  if (body.startsWith('!تغيير_صورة')) {
    if (!isGroup) { await wa.reply(sock, msg, 'هاد الأمر يشتغل بالجروبات بس 🙅'); return; }
    if (!(await senderIsAdmin(sock, chatId, authorId))) { await wa.reply(sock, msg, 'هاد الأمر للأدمن بس يا بطل 🚫'); return; }
    if (!(await botIsAdminInGroup(sock, chatId))) { await wa.reply(sock, msg, 'لازم تخليني أدمن أول عشان أقدر أغيّر صورة الجروب 🙏'); return; }

    try {
      let downloaded = wa.getMediaType(msg) === 'image' ? await wa.downloadMedia(msg) : null;
      if (!downloaded && wa.hasQuotedMessage(msg)) {
        const quotedInfo = wa.getQuotedInfo(msg);
        downloaded = await wa.downloadQuotedMedia(quotedInfo.message);
      }
      if (!downloaded) {
        await wa.reply(sock, msg, 'لازم ترفق صورة مع الأمر، أو ترد (Reply) على صورة بـ !تغيير_صورة 📸');
        return;
      }
      await sock.updateProfilePicture(chatId, downloaded.buffer);
      await wa.reply(sock, msg, '✅ تم تغيير صورة الجروب بنجاح');
    } catch (err) {
      console.error('خطأ بتغيير صورة الجروب:', err.message);
      await wa.reply(sock, msg, 'ما قدرت أغيّر صورة الجروب، تأكد إني أدمن وإن الصورة صالحة 🙏');
    }
    return;
  }

  // -------- !تحذير @شخص - عرض عدد التحذيرات --------
  if (body.startsWith('!تحذير') && !body.startsWith('!تحذيرات')) {
    if (!isGroup) { await wa.reply(sock, msg, 'هاد الأمر يشتغل بالجروبات بس 🙅'); return; }
    const mentioned = wa.getMentionedJids(msg);
    const targetId = mentioned.length > 0 ? mentioned[0] : authorId;
    const count = moderation.getWarningCount(persistDir, targetId, chatId);
    await sock.sendMessage(chatId, {
      text: moderation.warningCountBanner(wa.tag(targetId), count, moderation.MAX_WARNINGS),
      mentions: [targetId]
    });
    return;
  }

  // -------- !ازالة_تحذير @شخص --------
  if (body.startsWith('!ازالة_تحذير')) {
    if (!isGroup) { await wa.reply(sock, msg, 'هاد الأمر يشتغل بالجروبات بس 🙅'); return; }
    if (!(await senderIsAdmin(sock, chatId, authorId))) { await wa.reply(sock, msg, 'هاد الأمر للأدمن بس يا بطل 🚫'); return; }
    const mentioned = wa.resolveTargets(msg);
    if (mentioned.length === 0) { await wa.reply(sock, msg, 'لازم تعمل منشن للشخص اللي بدك تشيل تحذيراته، أو ترد (Reply) على رسالته 📌 مثال: !ازالة_تحذير @فلان'); return; }
    const target = mentioned[0];
    moderation.resetWarnings(persistDir, target, chatId);
    await sock.sendMessage(chatId, { text: moderation.warningsResetBanner(wa.tag(target)), mentions: [target] });
    return;
  }

  // -------- !مخالفة / !مخالفه @شخص [سبب] --------
  if (body.startsWith('!مخالفة') || body.startsWith('!مخالفه')) {
    if (!isGroup) { await wa.reply(sock, msg, 'هاد الأمر يشتغل بالجروبات بس 🙅'); return; }
    if (!(await senderIsAdmin(sock, chatId, authorId))) { await wa.reply(sock, msg, 'هاد الأمر للأدمن بس يا بطل 🚫'); return; }
    const mentioned = wa.resolveTargets(msg);
    if (mentioned.length === 0) { await wa.reply(sock, msg, 'لازم تعمل منشن للعضو اللي بدك تحذّره، أو ترد (Reply) على رسالته 📌 مثال: !مخالفة @فلان سبب التحذير'); return; }
    const target = mentioned[0];

    const reason = body.replace(/^!مخالفة|^!مخالفه/, '').replace(/@\d+/g, '').trim();
    const finalReason = reason.length === 0 ? 'مخالفة لقوانين الجروب' : reason;

    const newCount = moderation.addWarning(persistDir, target, chatId);
    try {
      await sock.sendMessage(target, {
        text: moderation.violationDmBanner(finalReason, wa.tag(target), newCount, moderation.MAX_WARNINGS)
      });
    } catch (dmErr) {
      console.error('ما قدرت أبعت رسالة خاص للعضو المخالف:', dmErr.message);
    }

    if (newCount >= moderation.MAX_WARNINGS) {
      moderation.resetWarnings(persistDir, target, chatId);
      const meta = await sock.groupMetadata(chatId);
      if (wa.isBotAdmin(meta, sock.user?.id)) {
        await sock.groupParticipantsUpdate(chatId, [target], 'remove');
        await sock.sendMessage(chatId, {
          text: moderation.finalWarningKickBanner(wa.tag(target), wa.tag(authorId)),
          mentions: [target, authorId]
        });
      } else {
        await sock.sendMessage(chatId, {
          text: `${wa.tag(target)} وصل ${moderation.MAX_WARNINGS} تحذيرات وكان لازم يتطرد، بس أنا مش أدمن هنا، خلوني أدمن 🙏`,
          mentions: [target]
        });
      }
    } else {
      await sock.sendMessage(chatId, {
        text: moderation.newWarningBanner(wa.tag(target), newCount, moderation.MAX_WARNINGS),
        mentions: [target]
      });
    }
    return;
  }

  // -------- !اوامر --------
  if (body === '!اوامر') {
    const isSenderAdminNow = await senderIsAdmin(sock, chatId, authorId);

    const header = `╭━━✦ 𝙃𝙐𝙎𝘼𝘼𝙈 𝘽𝙊𝙏 ✦━━╮
🤖 الاســم: 𝗧𝗢𝗝𝗜 𝗕𝗢𝗧 𖤍
🔥 الإصــدار: 1.0
⚡ الــحــالــة: يـعـمـل
👨‍💻 الــمــطــور: 𝗛𝗢𝗦𝗦𝗔𝗠 𖤍
╰━━━━━━━━━━━━━━╯

🌐 الأوامــر الــعــامــة
🔹 !مــراد [سؤال] ↜ اسأل مـراد
🔹 !ســعاد [سؤال] ↜ اسأل سـعاد
🔹 !صــوت [نص] ↜ تحويل النص لصوت
🔹 !بــروفــايــل [@] ↜ صورة العضو
🔹 !رابــط ↜ رابط الجروب
🔹 !اوامــر ↜ قائمة الأوامر

━━━━━━━━━━━━

🎮 أوامــر الــتــســلــيــة
🔸 !تــحــدي ↜ سؤال تريڤيا
🔸 !ديــن ↜ سؤال ديني
🔸 !مـن_فـيـنـا ↜ اختيار عشوائي مرح

━━━━━━━━━━━━

🕌 أوقـات الـصـلاة (بالخاص بس)
🔹 !صلاة ↜ أوقات اليوم حسب دولتك
🔹 !تفعيل_تنبيه_الصلاة ↜ تنبيه تلقائي وقت كل أذان
🔹 !ايقاف_تنبيه_الصلاة ↜ إيقاف التنبيه`;

    const adminSection = `

━━━━━━━━━━━━

👑 أوامــر الــإدارة
🔹 !قــفــل / !فــتــح ↜ قفل/فتح الدردشة
🔹 !فتـح رابـط / !قفل رابط ↜ منع/سماح الروابط
🔹 !بــانــد @ ↜ حظر عضو
🔹 !اصعـد / !انزل @ ↜ إدارة الرتب
🔹 !تــوقـف / !تشغيل ↜ تشغيل وإيقاف مراد
🔹 !ازالـة_تحـذيـر @ ↜ حذف تحذير
🔹 !مخالفة @ [السبب] ↜ إعطاء تحذير يدوي
🔹 !منشن [رسالة] ↜ منشن جماعي لكل الأعضاء
🔹 !تغيير_صورة ↜ تغيير صورة الجروب`;

    const footer = `

━━━━━━━━━━━━

🚫 نــظــام الــتــحــذيــرات
🔸 !تحـذيـر ↜ عدد تحذيراتك

━━━━━━━━━━━━

💍 نــظــام الــعــلاقــات
💗 !زواج @ [المهر] ↜ طلب زواج
💔 !طـلاق @ ↜ إنهاء الزواج

━━━━━━━━━━━━

⌬──══─┈•⤣⚡⤤•┈─══──⌬
©️⃝⚡ *جـمـيـع الـحـقـوق مـحـفـوظـة*
👨‍💻⃝⚡ *الـمـطـور:* حـسـام بـوت 😎
⌬──══─┈•⤣⚡⤤•┈─══──⌬`;

    const commandsList = isSenderAdminNow ? header + adminSection + footer : header + footer;

    try {
      const gifBuffer = await media.getMenuGifMp4Buffer(imagesDir);
      await sock.sendMessage(chatId, { video: gifBuffer, gifPlayback: true, caption: commandsList });
    } catch (imgErr) {
      console.error('فشل تجهيز جيف القائمة:', imgErr.message);
      await wa.reply(sock, msg, commandsList);
    }
    return;
  }

  // -------- !بروفايل @شخص --------
  if (body.startsWith('!بروفايل')) {
    const mentioned = wa.getMentionedJids(msg);
    const target = mentioned.length > 0 ? mentioned[0] : authorId;
    const picBuffer = await media.getProfilePicBuffer(sock, target);
    if (!picBuffer) {
      await wa.reply(sock, msg, 'هاد ماله صورة بروفايل ظاهرة، أو خصوصيته ما بتسمح 🚫');
      return;
    }
    const targetTag = wa.tag(target);
    const caption = [
      '╭━━━◈ 🖤 𝙋𝙍𝙊𝙁𝙄𝙇𝙀 ◈━━━╮',
      '┃ ✦ تــم اســتــخــراج الــبــروفــايــل',
      '┃',
      `┃ *👤 الـمـسـتـخـدم :* ${targetTag}`,
      '┃ *📸 الـصـورة : مـتـاحـة*',
      '┃ *⚡ الـحـالـة : تـم الـجـلـب*',
      '╰━━━━━━━━━━━━━━╯',
      '',
      '> *ᴘᴏᴡᴇʀᴇᴅ:*⚡ 𝗧𝗢𝗝𝗜 𝗕𝗢𝗧 𖤍*'
    ].join('\n');
    await sock.sendMessage(chatId, { image: picBuffer, caption, mentions: [target] });
    return;
  }

  // -------- !تحدي --------
  if (body.startsWith('!تحدي')) {
    if (!isGroup) { await wa.reply(sock, msg, 'أمر !تحدي يشتغل بس بالجروبات 🎯'); return; }
    if (games.pendingChallenges.has(chatId)) { await wa.reply(sock, msg, 'فيه تحدي شغال هلق، جاوب عليه الأول 👀'); return; }

    const picked = games.CHALLENGE_QUESTIONS[Math.floor(Math.random() * games.CHALLENGE_QUESTIONS.length)];
    const timer = setTimeout(async () => {
      if (games.pendingChallenges.get(chatId)?.answer === picked.answer) {
        games.pendingChallenges.delete(chatId);
        try {
          await sock.sendMessage(chatId, { text: games.challengeTimeoutBanner(picked.answer) });
        } catch (timeoutErr) {
          console.error('خطأ بإرسال بانر انتهاء التحدي:', timeoutErr.message);
        }
      }
    }, games.CHALLENGE_TIMEOUT_MS);

    games.pendingChallenges.set(chatId, { question: picked.question, answer: picked.answer, askedBy: authorId, timer });
    await sock.sendMessage(chatId, { text: games.challengeBanner(picked.question) });
    return;
  }

  // -------- !دين --------
  if (body.startsWith('!دين')) {
    if (DEAN_QUESTIONS.length === 0) {
      await wa.reply(sock, msg, 'ملف الأسئلة الدينية (dean.json) ما تحمّلش صح، تأكد إنه موجود بنفس مجلد البوت 😅');
      return;
    }
    if (!isGroup) { await wa.reply(sock, msg, 'أمر !دين يشتغل بس بالجروبات 🕌'); return; }
    if (games.pendingDeanQuestions.has(chatId)) { await wa.reply(sock, msg, 'فيه سؤال ديني شغال هلق، جاوب عليه الأول 👀'); return; }

    const pickedDean = DEAN_QUESTIONS[Math.floor(Math.random() * DEAN_QUESTIONS.length)];
    const deanTimer = setTimeout(async () => {
      if (games.pendingDeanQuestions.get(chatId)?.answer === pickedDean.response) {
        games.pendingDeanQuestions.delete(chatId);
        try {
          await sock.sendMessage(chatId, { text: games.deanTimeoutBanner(pickedDean.response) });
        } catch (timeoutErr) {
          console.error('خطأ بإرسال بانر انتهاء السؤال الديني:', timeoutErr.message);
        }
      }
    }, games.DEAN_TIMEOUT_MS);

    games.pendingDeanQuestions.set(chatId, {
      question: pickedDean.question, answer: pickedDean.response, askedBy: authorId, timer: deanTimer
    });
    await sock.sendMessage(chatId, { text: games.deanBanner(pickedDean.question) });
    return;
  }

  // -------- !من_فينا --------
  if (body.startsWith('!من_فينا')) {
    if (!isGroup) { await wa.reply(sock, msg, 'أمر !من_فينا يشتغل بس بالجروبات 🎲'); return; }
    const meta = await sock.groupMetadata(chatId);
    const participants = meta.participants.filter((p) => jidToNumber(p.id) !== jidToNumber(sock.user?.id));
    if (participants.length === 0) { await wa.reply(sock, msg, 'ما لقيت أعضاء بالجروب أختار منهم 😅'); return; }

    const chosen = participants[Math.floor(Math.random() * participants.length)];
    const question = games.MIN_FIINA_QUESTIONS[Math.floor(Math.random() * games.MIN_FIINA_QUESTIONS.length)];
    await sock.sendMessage(chatId, { text: games.minFiinaBanner(question, wa.tag(chosen.id)), mentions: [chosen.id] });
    return;
  }

  // -------- !زواج @شخص [مهر] --------
  if (body.startsWith('!زواج')) {
    if (!isGroup) { await wa.reply(sock, msg, 'هاد الأمر يشتغل بالجروبات بس 🙅'); return; }
    const mentioned = wa.getMentionedJids(msg);
    if (mentioned.length !== 1) { await wa.reply(sock, msg, 'لازم تعمل منشن لشخص واحد بس 📌 مثال: !زواج @فلانة المهر'); return; }
    const husbandId = authorId;
    const wifeId = mentioned[0];

    if (husbandId === wifeId) { await wa.reply(sock, msg, 'ما تقدر تتزوج نفسك يا حكيم 😂'); return; }

    if (marriage.findActiveMarriageAsWife(persistDir, wifeId, chatId)) {
      await wa.reply(sock, msg, 'هاي محجوزة، دور على وحدة تانية يا بطل 🙅‍♂️');
      return;
    }

    const husbandWives = marriage.findActiveWivesOfHusband(persistDir, husbandId, chatId);
    if (husbandWives.length >= marriage.MAX_WIVES_PER_HUSBAND) {
      await wa.reply(sock, msg, `خلاص وصلت الحد يا بطل، عندك ${marriage.MAX_WIVES_PER_HUSBAND} وكفاية عليك 😅`);
      return;
    }

    const requestKey = `${chatId}_${wifeId}`;
    if (marriage.pendingMarriageRequests.has(requestKey)) {
      await wa.reply(sock, msg, 'فيه طلب معلق أصلاً لهاي، خلّي يرد الأول 🕐');
      return;
    }

    let mahrText = body.replace('!زواج', '');
    mentioned.forEach((jid) => { mahrText = mahrText.replace(wa.tag(jid), ''); });
    mahrText = mahrText.trim();
    const mahr = mahrText.length > 0 ? mahrText : marriage.randomMahr();

    const timer = setTimeout(async () => {
      if (marriage.pendingMarriageRequests.has(requestKey)) {
        marriage.pendingMarriageRequests.delete(requestKey);
        try {
          await sock.sendMessage(chatId, { text: `${wa.tag(wifeId)} ما ردت بالوقت، الطلب اتلغى ⏳💔`, mentions: [wifeId] });
        } catch (_) {}
      }
    }, marriage.MARRIAGE_REQUEST_TIMEOUT_MS);

    marriage.pendingMarriageRequests.set(requestKey, { husbandId, wifeId, chatId, mahr, timer });

    await sock.sendMessage(chatId, {
      text: `يا ${wa.tag(wifeId)}، ${wa.tag(husbandId)} يطلب يدك، والمهر: ${mahr} 💍\nعندك دقيقتين، اكتبي *قبول* أو *رفض*`,
      mentions: [wifeId, husbandId]
    });
    return;
  }

  // -------- قبول / رفض --------
  if (body === 'قبول' || body === 'رفض') {
    const requestKey = `${chatId}_${authorId}`;
    const pending = marriage.pendingMarriageRequests.get(requestKey);

    if (pending) {
      clearTimeout(pending.timer);
      marriage.pendingMarriageRequests.delete(requestKey);

      if (body === 'رفض') {
        await wa.reply(sock, msg, 'مرفوووض! خيبة يا خويا، جرب حظك مرة تانية بمكان تاني 😂');
        return;
      }

      const marriages = marriage.loadMarriages(persistDir);
      marriages.push({
        husbandId: pending.husbandId,
        wifeId: pending.wifeId,
        chatId: pending.chatId,
        mahr: pending.mahr,
        date: new Date().toISOString(),
        status: 'قائم'
      });
      marriage.saveMarriages(persistDir, marriages);

      await wa.reply(sock, msg, `مبروووك الزواج! ألف مبروك ومهرها كان: ${pending.mahr} 🎉💍`);

      const husbandWivesNow = marriage.findActiveWivesOfHusband(persistDir, pending.husbandId, pending.chatId);
      if (husbandWivesNow.length === 2) {
        const firstWife = husbandWivesNow[0];
        try {
          await sock.sendMessage(chatId, {
            text: `${wa.tag(firstWife.wifeId)} يا حرام، ${wa.tag(pending.husbandId)} جاب وحدة ثانية معاك 😂 قومي ديري لِه فنجان قهوة وسكتي 🙃`,
            mentions: [firstWife.wifeId, pending.husbandId]
          });
        } catch (err) {
          console.error('فشل إرسال رسالة الزوجة الأولى:', err.message);
        }
      }
      return;
    }
    // لو ماله طلب معلق، نتجاهل الرسالة عادي
  }

  // -------- !طلاق @شخص --------
  if (body.startsWith('!طلاق')) {
    if (!isGroup) { await wa.reply(sock, msg, 'هاد الأمر يشتغل بالجروبات بس 🙅'); return; }
    const mentioned = wa.getMentionedJids(msg);
    if (mentioned.length !== 1) { await wa.reply(sock, msg, 'لازم تعمل منشن لشخص واحد بس 📌 مثال: !طلاق @فلانة'); return; }
    const target = mentioned[0];

    const marriages = marriage.loadMarriages(persistDir);
    let m = marriages.find((mm) => mm.husbandId === authorId && mm.wifeId === target && mm.chatId === chatId && mm.status === 'قائم');

    if (m) {
      m.status = 'منتهي';
      marriage.saveMarriages(persistDir, marriages);
      const banner = [
        '╔════════════════════════════╗',
        '║        💔    طـلاق 💔          ║',
        '╠════════════════════════════╣',
        `║  👨‍💼 *الــزوج:* ${wa.tag(authorId)}`,
        `║  👰‍♀️ *الــزوجــة:* ${wa.tag(target)}`,
        '║  💔 *الــحــالــة:* مـطـلـق',
        '╚════════════════════════════╝',
        '',
        '😔 *نـتـمـنـى لـهـمـا كـل الـخـيـر* 😔',
        '',
        '*ربـي يـعـوضـهـمـا خـيـر ويـكـتـب لـهـمـا الـسـعـادة*'
      ].join('\n');
      await sock.sendMessage(chatId, { text: banner, mentions: [authorId, target] });
      return;
    }

    const wifeTrying = marriages.find((mm) => mm.wifeId === authorId && mm.husbandId === target && mm.chatId === chatId && mm.status === 'قائم');
    if (wifeTrying) {
      await wa.reply(sock, msg, 'انتي ما عندك هالحق يا الغالية، خلي زوجك يقرر 🙅‍♀️');
      return;
    }

    await wa.reply(sock, msg, 'ما فيه زواج قائم بينكم أصلاً 🤷');
    return;
  }

  // -------- !مراد --------
  if (body.startsWith('!مراد')) {
    if (!aiEnabled) { await wa.reply(sock, msg, ai.personaOfflineMessage('murad')); return; }
    const question = body.replace('!مراد', '').trim();
    const prompt = question.length > 0 ? question : 'سلم علينا يا مراد';
    const history = ai.PERSONAS.murad.history.get(convoKey) || [];
    const replyText = await ai.askAI(prompt, history, 'murad');
    ai.pushToHistory(ai.PERSONAS.murad.history, convoKey, 'user', prompt);
    ai.pushToHistory(ai.PERSONAS.murad.history, convoKey, 'assistant', replyText);
    const sent = await sock.sendMessage(chatId, { text: replyText }, { quoted: msg });
    ai.rememberSentMessage(sent.key.id, 'murad');
    return;
  }

  // -------- !سعاد --------
  if (body.startsWith('!سعاد')) {
    if (!aiEnabled) { await wa.reply(sock, msg, ai.personaOfflineMessage('souad')); return; }
    const question = body.replace('!سعاد', '').trim();
    const prompt = question.length > 0 ? question : 'سلمي علينا يا سعاد';
    const history = ai.PERSONAS.souad.history.get(convoKey) || [];
    const replyText = await ai.askAI(prompt, history, 'souad');
    ai.pushToHistory(ai.PERSONAS.souad.history, convoKey, 'user', prompt);
    ai.pushToHistory(ai.PERSONAS.souad.history, convoKey, 'assistant', replyText);
    const sent = await sock.sendMessage(chatId, { text: replyText }, { quoted: msg });
    ai.rememberSentMessage(sent.key.id, 'souad');
    return;
  }

  // -------- رد (Reply) على رسالة من مراد أو سعاد = ترد بنفس الشخصية بدون أمر --------
  if (aiEnabled && wa.hasQuotedMessage(msg) && body.length > 1 && !body.startsWith('!')) {
    const quotedInfo = wa.getQuotedInfo(msg);
    if (ai.isTrackedBotMessage(quotedInfo.stanzaId)) {
      const personaKey = ai.getPersonaForQuotedMessage(quotedInfo.stanzaId);
      const persona = ai.PERSONAS[personaKey];
      const history = persona.history.get(convoKey) || [];
      const replyText = await ai.askAI(body, history, personaKey);
      ai.pushToHistory(persona.history, convoKey, 'user', body);
      ai.pushToHistory(persona.history, convoKey, 'assistant', replyText);
      const sent = await sock.sendMessage(chatId, { text: replyText }, { quoted: msg });
      ai.rememberSentMessage(sent.key.id, personaKey);
      return;
    }
  }

  // -------- !صلاة / !تفعيل_تنبيه_الصلاة / !ايقاف_تنبيه_الصلاة (بالخاص بس) --------
  if (body.startsWith('!صلاة')) {
    if (isGroup) { await wa.reply(sock, msg, 'هاد الأمر يشتغل بالخاص بس 🙏 (راسلني بالخاص واكتب !صلاة)'); return; }
    const countryKey = prayer.detectCountryFromNumber(jidToNumber(chatId));
    if (!countryKey) { await wa.reply(sock, msg, prayer.unsupportedCountryMessage()); return; }
    const timings = await prayer.getTodayTimings(countryKey);
    if (!timings) { await wa.reply(sock, msg, 'ما قدرت أجيب أوقات الصلاة هلق، جرب بعد شوي 😅'); return; }
    await wa.reply(sock, msg, prayer.formatPrayerTimesMessage(countryKey, timings));
    return;
  }

  if (body.startsWith('!تفعيل_تنبيه_الصلاة')) {
    if (isGroup) { await wa.reply(sock, msg, 'هاد الأمر يشتغل بالخاص بس 🙏 (راسلني بالخاص)'); return; }
    const countryKey = prayer.detectCountryFromNumber(jidToNumber(chatId));
    if (!countryKey) { await wa.reply(sock, msg, prayer.unsupportedCountryMessage()); return; }
    prayer.subscribeUser(persistDir, chatId, countryKey);
    await wa.reply(sock, msg, prayer.subscribedBanner(prayer.COUNTRIES[countryKey].name));
    return;
  }

  if (body.startsWith('!ايقاف_تنبيه_الصلاة')) {
    if (isGroup) { await wa.reply(sock, msg, 'هاد الأمر يشتغل بالخاص بس 🙏 (راسلني بالخاص)'); return; }
    prayer.unsubscribeUser(persistDir, chatId);
    await wa.reply(sock, msg, prayer.unsubscribedBanner());
    return;
  }

  // -------- !صوت --------
  if (body.startsWith('!صوت')) {
    let textToSpeak = body.replace('!صوت', '').trim();
    let personaKeyForVoice = ai.DEFAULT_PERSONA_KEY;

    if (wa.hasQuotedMessage(msg)) {
      const quotedInfo = wa.getQuotedInfo(msg);
      if (ai.isTrackedBotMessage(quotedInfo.stanzaId)) {
        personaKeyForVoice = ai.getPersonaForQuotedMessage(quotedInfo.stanzaId);
        if (textToSpeak.length === 0) {
          textToSpeak = wa.getQuotedText(quotedInfo.message);
        }
      }
    }

    if (!aiEnabled) { await wa.reply(sock, msg, ai.personaOfflineMessage(personaKeyForVoice)); return; }
    if (textToSpeak.length === 0) {
      await wa.reply(sock, msg, 'اكتب النص اللي بدك تحوله صوت، أو رد (Reply) على رسالة من مراد بـ !صوت 🎙️');
      return;
    }

    try {
      const persona = ai.PERSONAS[personaKeyForVoice];
      const voiceBuffer = await textToVoiceBuffer(textToSpeak, GROQ_API_KEY, persona.voice);
      const sent = await sock.sendMessage(chatId, { audio: voiceBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true });
      ai.rememberSentMessage(sent.key.id, personaKeyForVoice);
    } catch (err) {
      console.error('خطأ بتحويل النص لصوت:', err.message);
      await wa.reply(sock, msg, `ما قدرت أسوي الصوت هلق 😅\n🔧 تفاصيل الخطأ: ${err.message}`);
    }
    return;
  }

  // -------- رسالة صوتية (Reply على رسالة البوت) = STT + AI + TTS --------
  const msgMediaType = wa.getMediaType(msg);
  if (aiEnabled && (msgMediaType === 'ptt' || msgMediaType === 'audio') && wa.hasQuotedMessage(msg)) {
    const quotedInfo = wa.getQuotedInfo(msg);
    if (ai.isTrackedBotMessage(quotedInfo.stanzaId)) {
      try {
        const downloaded = await wa.downloadMedia(msg);
        if (!downloaded) { await wa.reply(sock, msg, 'ما قدرت أسمع الصوت، جرب تبعته مرة تانية 😅'); return; }

        const transcribedText = await transcribeVoiceBuffer(downloaded.buffer, downloaded.mimetype, GROQ_API_KEY);
        if (!transcribedText) { await wa.reply(sock, msg, 'ما فهمت شي من الصوت، جرب تحكي أوضح 🎙️'); return; }

        const personaKey = ai.getPersonaForQuotedMessage(quotedInfo.stanzaId);
        const persona = ai.PERSONAS[personaKey];
        const history = persona.history.get(convoKey) || [];
        const aiReply = await ai.askAI(transcribedText, history, personaKey);
        ai.pushToHistory(persona.history, convoKey, 'user', transcribedText);
        ai.pushToHistory(persona.history, convoKey, 'assistant', aiReply);

        const voiceBuffer = await textToVoiceBuffer(aiReply, GROQ_API_KEY, persona.voice);
        const sent = await sock.sendMessage(chatId, { audio: voiceBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true });
        ai.rememberSentMessage(sent.key.id, personaKey);
      } catch (err) {
        console.error('خطأ بمعالجة الرسالة الصوتية:', err.message);
        await wa.reply(sock, msg, 'صار في مشكلة وأنا نسمعك، جرب بعد شوي 😅');
      }
      return;
    }
  }

  // -------- رسالة قصيرة فيها "بروفايل" بصيغة غلط --------
  if (!body.startsWith('!') && body.length > 0) {
    const words = body.split(/\s+/).filter(Boolean);
    if (words.length > 0 && words.length <= 3 && /بروفايل/i.test(body)) {
      await wa.reply(sock, msg, banners.wrongCommandBanner());
      return;
    }
  }

  // -------- كاتش-أول: أي أمر يبدأ بـ ! وما تطابقش مع ولا أمر معروف --------
  if (body.startsWith('!')) {
    await wa.reply(sock, msg, banners.wrongCommandBanner());
    return;
  }
}

module.exports = {
  initRouter,
  handleMessagesUpsert
};
