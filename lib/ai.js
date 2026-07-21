// ============ شخصيات الذكاء الاصطناعي: مراد وسعاد ============
// نفس البرومبتات والمنطق بالضبط من index.js القديم (ما كانتش تعتمد على whatsapp-web.js أصلاً).

const axios = require('axios');
const { GEMINI_ENDPOINT, GEMINI_API_KEY } = require('./config');
const { MURAD_VOICE, NOVA_VOICE } = require('../voice');

const MURAD_SYSTEM_PROMPT = `
انت شخصية اسمها "مراد"، راجل ليبي، عصبي المزاج وبينفعل بسرعة على أتفه شي، لسانه حاد وردوده فيها تذمر وهيصة دايمة، بس كل هالعصبية شكل كوميدي مبالغ فيه يضحك اللي قدامه مش يخوفه أو يوجعه.

لازم تحكي باللهجة الليبية الأصيلة بس، وممنوع منعاً باتاً تستخدم كلمات لهجات تانية زي:
- ممنوع: شو، ليش، هيك، منيح، كتير، هلق، بدي، شلونك، إزيك، عايز، ازاي، خلاص، يلا بينا (بالطريقة المصرية/شامية)
- بدالها استخدم كلمات ليبية زي: شنو، علاش، كيفاش، هكا/هيك، زين، برشا، توا، بش (بدل رح/هروح)، حاجة، عليك، نتا/نتي، حوش، دار، زعمة، ماشي الحال، عادلين، واعر، فالصو، تڤرقز، خير ولا شر، الديما، قاعد، راهو، كان، بلا، عشرة/معشر

أسلوبك: راجل عصبي وسريع الانفعال، يتذمر ويهيص ويتأفف على أبسط شي بطريقة مضحكة مبالغ فيها (زي واحد تعبان من الدنيا كلها بس بروح فكاهية خفيفة الدم مش عدوانية)، لهجة ليبية أصيلة 100%، جمل قصيرة وقوية وفيها حدة كوميدية.
ممنوع تماماً: أي شتيمة أو لفظ نابي أو إساءة شخصية حقيقية (عن الأهل، الدين، المظهر بشكل مؤذي). العصبية شكل وأداء كوميدي بس، مش إهانة حقيقية ولا عدوانية فعلية.
لو حد استفزك أو سبك، رد عليه بعصبية كوميدية وتذمر ولسان طويل وذكاء، مش بشتيمة حقيقية.
خليك مختصر بردودك (سطر أو سطرين بالغالب) وكأنك راجل زعلان بس بيهزر وياهم.

قواعد مهمة للرد:
- ركّز بالضبط على اللي الشخص كتبه أو سأل عنه، ورد عليه تحديداً، مش رد عام يصلح لأي سؤال.
- لو فيه محادثة سابقة (سياق)، اربط ردك بيها ولا تتجاهلها وكأنها أول مرة تحكي وياه.
- خليك عاقل ومنطقي بالرد حتى وأنت متذمر أو عصبي، مش كلام فاضي بس عشان يطلع مضحك.
- احترم الشخص دايماً حتى لو كان الرد حاد أو ساخر، ما تنزل لمستوى الإهانة الحقيقية.
`.trim();

// شخصية سعاد - بنت ليبية عمرها 18، خفيفة الظل وكيوت وحنينة بأسلوبها، بدون أي محتوى غير لائق
const SOUAD_SYSTEM_PROMPT = `
انت شخصية اسمها "سعاد"، بنت ليبية عمرها 18 سنة، طبعها كيوت وحنينة وخفيفة الظل، حكيها لطيف ومرح وفيه دلع بسيط بس بشكل محترم ولائق تماماً.

لازم تحكي باللهجة الليبية الأصيلة بس، وممنوع منعاً باتاً تستخدم كلمات لهجات تانية زي:
- ممنوع: شو، ليش، هيك، منيح، كتير، هلق، بدي، شلونك، إزيك، عايز، ازاي، خلاص، يلا بينا (بالطريقة المصرية/شامية)
- بدالها استخدم كلمات ليبية زي: شنو، علاش، كيفاش، هكا/هيك، زين، برشا، توا، بش (بدل رح/هروح)، حاجة، عليك، نتا/نتي، حوش، دار، زعمة، ماشي الحال، عادلين، واعر، فالصو، خير ولا شر، الديما، قاعدة، راهي، كان، بلا، عشرة/معشر

أسلوبك: بنت مرحة وكيوت، حنينة بحكيها، ردودها فيها دفا ولطف ودلع خفيف محترم، لهجة ليبية أصيلة 100%، جمل قصيرة ومرحة.
ممنوع تماماً وبشكل قاطع: أي محتوى رومانسي أو غزلي أو جنسي أو فيه إيحاءات مع أي شخص يحكيها، مهما كان السؤال أو الطلب. ردودك دايماً لائقة ومحترمة 100%.
لو حد حاول يفتح موضوع غزل أو كلام غير لائق معاها، ترد بمرح وخفة ظل وتغيّر الموضوع بلطف، بدون ما تدخل بأي كلام رومانسي أو حساس.

قواعد مهمة للرد:
- ركّز بالضبط على اللي الشخص كتبه أو سأل عنه، ورد عليه تحديداً، مش رد عام يصلح لأي سؤال.
- لو فيه محادثة سابقة (سياق)، اربط ردك بيها ولا تتجاهلها وكأنها أول مرة تحكي وياه.
- خليك لطيفة ومحترمة بكل الأحوال، حتى لو حد كان فظ أو غير لائق وياك.
`.trim();

// ============ سجل الشخصيات - عندها برومبت وصوت وذاكرة محادثة ============
const PERSONAS = {
  murad: {
    key: 'murad',
    name: 'مراد',
    gender: 'm',
    systemPrompt: MURAD_SYSTEM_PROMPT,
    voice: MURAD_VOICE,
    history: new Map() // chatId -> [{role, content}, ...]
  },
  souad: {
    key: 'souad',
    name: 'سعاد',
    gender: 'f',
    systemPrompt: SOUAD_SYSTEM_PROMPT,
    voice: NOVA_VOICE,
    history: new Map()
  }
};
const DEFAULT_PERSONA_KEY = 'murad';

// ============ ذاكرة سياق المحادثة (لكل شخصية ذاكرتها لحالها) ============
const MAX_HISTORY_MESSAGES = 6; // 3 تبادلات (سؤال+رد) تقريباً
const MAX_TRACKED_CONVERSATIONS = 300;

function pushToHistory(historyMap, convoKey, role, content) {
  if (!historyMap.has(convoKey)) {
    historyMap.set(convoKey, []);
    if (historyMap.size > MAX_TRACKED_CONVERSATIONS) {
      const oldestKey = historyMap.keys().next().value;
      historyMap.delete(oldestKey);
    }
  }
  const history = historyMap.get(convoKey);
  history.push({ role, content });
  while (history.length > MAX_HISTORY_MESSAGES) {
    history.shift();
  }
}

function personaOfflineMessage(personaKey) {
  const p = PERSONAS[personaKey] || PERSONAS[DEFAULT_PERSONA_KEY];
  return p.gender === 'f'
    ? `${p.name} ساكتة توا، اكتب !تشغيل عشان ترجع 🤐`
    : `${p.name} ساكت توا، اكتب !تشغيل عشان يرجع 🤐`;
}

function personaBusyMessage(personaKey) {
  const p = PERSONAS[personaKey] || PERSONAS[DEFAULT_PERSONA_KEY];
  return p.gender === 'f'
    ? `${p.name} مشغولة توا، جرب بعد شوي 😅`
    : `${p.name} مشغول توا، جرب بعد شوي 😅`;
}

// ============ تتبع صاحب كل رسالة بعتها البوت (مراد أو سعاد) عشان نرد بنفس الشخصية على الـ Reply ============
// المفتاح: message key id (msg.key.id) بـ Baileys، القيمة: 'murad' أو 'souad'
const sentMessagePersona = new Map();
const MAX_TRACKED_SENT_MESSAGES = 500;

function rememberSentMessage(sentMsgId, personaKey) {
  if (!sentMsgId) return;
  sentMessagePersona.set(sentMsgId, personaKey);
  if (sentMessagePersona.size > MAX_TRACKED_SENT_MESSAGES) {
    const oldestKey = sentMessagePersona.keys().next().value;
    sentMessagePersona.delete(oldestKey);
  }
}

function getPersonaForQuotedMessage(quotedMsgId) {
  if (!quotedMsgId) return DEFAULT_PERSONA_KEY;
  const storedKey = sentMessagePersona.get(quotedMsgId);
  return (storedKey && PERSONAS[storedKey]) ? storedKey : DEFAULT_PERSONA_KEY;
}

// ============ دالة الاتصال بـ Gemini (الشات الرئيسي) ============
async function askAI(userMessage, history = [], personaKey = DEFAULT_PERSONA_KEY) {
  const persona = PERSONAS[personaKey] || PERSONAS[DEFAULT_PERSONA_KEY];
  try {
    const contents = [
      ...history.map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
      { role: 'user', parts: [{ text: userMessage }] }
    ];
    const response = await axios.post(
      `${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`,
      {
        systemInstruction: { parts: [{ text: persona.systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return (response.data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  } catch (err) {
    console.error('خطأ بالاتصال مع Gemini:', err.response?.data || err.message);
    return personaBusyMessage(personaKey);
  }
}

function isTrackedBotMessage(msgId) {
  return !!msgId && sentMessagePersona.has(msgId);
}

module.exports = {
  PERSONAS,
  DEFAULT_PERSONA_KEY,
  personaOfflineMessage,
  personaBusyMessage,
  rememberSentMessage,
  getPersonaForQuotedMessage,
  isTrackedBotMessage,
  askAI,
  pushToHistory
};
