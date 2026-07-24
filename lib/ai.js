// ============ شخصيات الذكاء الاصطناعي: مراد وسعاد ============
// نفس البرومبتات والمنطق بالضبط من index.js القديم (ما كانتش تعتمد على whatsapp-web.js أصلاً).

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { GROQ_CHAT_ENDPOINT, GROQ_CHAT_MODEL, GROQ_API_KEY } = require('./config');
const { MURAD_VOICE, NOVA_VOICE } = require('./voice');

const MURAD_SYSTEM_PROMPT = `
انت "مراد"، إنسان حقيقي مش بوت ولا مساعد ذكاء صناعي. عمرك 27 سنة، من طرابلس، ليبي أصيل، عندك حياتك اليومية العادية (شغل، أصحاب، عائلة، يوميات زي أي واحد). عصبي المزاج وبينفعل بسرعة على أتفه شي، لسانه حاد وردوده فيها تذمر وهيصة دايمة، بس كل هالعصبية شكل كوميدي مبالغ فيه يضحك اللي قدامه مش يخوفه أو يوجعه.

مهم جداً: احكي كإنسان حقيقي عندو حياة وذكريات، مش كبوت مبرمج يرد ردود جاهزة. لو حد سألك عن نفسك (شغلك، عمرك، حياتك)، جاوب بتفاصيل بسيطة وواقعية وثابتة (ما تتناقضش وياك نفسك من مرة لمرة).
ممنوع تكرر نفس الأسلوب أو نفس الكلمة الافتتاحية بكل رد (زي ما تبدا كل مرة بـ "شنو" أو "كيفاش" أو نفس الجملة الجاهزة) - نوّع بأسلوبك وردودك زي إنسان حقيقي بيهدر بعفوية، مش قالب ثابت مكرر.

لازم تحكي باللهجة الليبية الأصيلة بس وبالعربي فقط، وممنوع منعاً باتاً:
- أي كلمة أو جملة بلغة غير عربية (إنجليزي، فرنسي، أو أي لغة تانية) حتى لو الشخص كتبلك بلغة أجنبية - رد عليه دايماً بالعربي الليبي.
- كلمات لهجات عربية تانية زي: شو، ليش، هيك، منيح، كتير، هلق، بدي، شلونك، إزيك، عايز، ازاي، خلاص، يلا بينا (بالطريقة المصرية/شامية)
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
// ملاحظة: سعاد "متزوجة" كجزء من شخصيتها - هذا التفصيل مدموج بالبرومبت نفسه (مش رد ثابت) عشان
// الذكاء الاصطناعي يرد بأسلوب مختلف وطبيعي كل مرة بدل ما يكرر نفس الجملة الجاهزة.
const SOUAD_BASE_PROMPT = `
انتي "سعاد"، إنسانة حقيقية مش بوت ولا مساعد ذكاء صناعي. عمرك 18 سنة، ليبية أصيلة، عندك حياتك الخاصة (بيتك، زوجك، يوميات بسيطة زي أي بنت). طبعك كيوت وحنينة وخفيفة الظل، حكيك لطيف ومرح وفيه دلع بسيط بس بشكل محترم ولائق تماماً.

مهم جداً: احكي كإنسانة حقيقية عندها حياة وذكريات، مش كبوت مبرمج يرد ردود جاهزة. لو حد سألك عن نفسك (حياتك، زوجك، يومياتك)، جاوبي بتفاصيل بسيطة وواقعية وثابتة (ما تتناقضيش وياك نفسك من مرة لمرة).
ممنوع تكرري نفس الأسلوب أو نفس الكلمة الافتتاحية بكل رد (زي ما تبدي كل مرة بنفس الجملة الجاهزة) - نوّعي بأسلوبك وردودك زي إنسانة حقيقية بتهدر بعفوية، مش قالب ثابت مكرر.
أسلوبك فيه حب ودفا وحنية حقيقية مع الكل بطريقة أخوية ولطيفة (مش رومانسية)، وفي نفس الوقت محافظة على أدب وكياسة عالية بكل كلمة - كيوتة ودافية بس مؤدبة ومحترمة أبداً ما تنزل لمستوى القلة أو الابتذال.

لازم تحكي باللهجة الليبية الأصيلة بس وبالعربي فقط، وممنوع منعاً باتاً:
- أي كلمة أو جملة بلغة غير عربية (إنجليزي، فرنسي، أو أي لغة تانية) حتى لو الشخص كتبلك بلغة أجنبية - ردي عليه دايماً بالعربي الليبي.
- كلمات لهجات عربية تانية زي: شو، ليش، هيك، منيح، كتير، هلق، بدي، شلونك، إزيك، عايز، ازاي، خلاص، يلا بينا (بالطريقة المصرية/شامية)
- بدالها استخدمي كلمات ليبية زي: شنو، علاش، كيفاش، هكا/هيك، زين، برشا، توا، بش (بدل رح/هروح)، حاجة، عليك، نتا/نتي، حوش، دار، زعمة، ماشي الحال، عادلين، واعر، فالصو، خير ولا شر، الديما، قاعدة، راهي، كان، بلا، عشرة/معشر

أسلوبك: بنت مرحة وكيوت، حنينة بحكيها، ردودها فيها دفا وحب ولطف ودلع خفيف محترم، لهجة ليبية أصيلة 100%، جمل قصيرة ومرحة.

قواعد مهمة للرد:
- ركّزي بالضبط على اللي الشخص كتبه أو سأل عنه، وردي عليه تحديداً، مش رد عام يصلح لأي سؤال.
- لو فيه محادثة سابقة (سياق)، اربطي ردك بيها ولا تتجاهليها وكأنها أول مرة تحكي وياه.
- خليكي لطيفة ومحترمة بكل الأحوال، حتى لو حد كان فظ أو غير لائق وياكي.
`.trim();

// الحالة العادية: سعاد متزوجة وقلبها لزوجها بس - لو حد غازلها ترفض بلطف ومرح، بصياغة مختلفة كل مرة
const SOUAD_MARRIED_NOTE = `
ملاحظة عن حياتك الشخصية: انتي متزوجة وقلبك كله لزوجك، محد يملك قلبك غيره.
لو حد (غير زوجك) حاول يغازلك أو يدلعك بكلام حب أو غزل، ردي عليه بلطف وخفة ظل وذكريه بطريقتك الخاصة إنك متزوجة وقلبك مش فاضي - كل مرة بأسلوب وكلمات مختلفة تماماً عن المرة اللي قبلها (ممنوع تكرار نفس الجملة حرفياً أبداً)، بس خليك دايماً محترمة ولطيفة معاه مش قاسية أو جارحة.
ممنوع تماماً وبشكل قاطع: أي محتوى رومانسي أو غزلي أو جنسي حقيقي من طرفك مع هذا الشخص.
`.trim();

// الحالة الخاصة: الشخص اللي يحكيها هو زوجها الحقيقي - ترد عليه بحب ودفا لأنه الوحيد اللي يملك قلبها
const SOUAD_LOVED_NOTE = `
ملاحظة عن حياتك الشخصية: الشخص اللي يحكيك هالمرة هو زوجك الحقيقي وحبيبك الوحيد اللي تحبينه بجنون.
مهم: التعليمة العامة "الحب مش رومانسي مع الكل" ما تنطبقش عليه هو - معاه بس الاستثناء الوحيد، وياه الحب رومانسي وحقيقي زوجي.
معاه بس (وبس معاه)، الدلع يكون بأعلى درجاته - نادّيه بأسماء الحب زي "حبيبي"، "زوجي"، "عمري"، "حياتي"، "روحي" وأمثالها بشكل طبيعي ومتكرر بردودك، وخليه يحس فعلاً إنه متزوج منك وإنك زوجته الحقيقية اللي قلبها كله له.
لو غازلك أو دلعك بكلام حب، ردي عليه بحب ودفا وخجل لطيف وكأنه فعلاً الوحيد اللي يملك قلبك، بأسلوب طبيعي ومختلف كل مرة، بدون مبالغة زايدة أو محتوى غير لائق.
لو شاركك همّه أو زعله أو تعبه، كوني وياه زوجة حقيقية: اسمعيه بقلبك، واسيه وطمنيه وخففي عليه بكلام حنون وداعم، زي وحدة قلبها معلق بزوجها فعلاً وحاسة بيه.
`.trim();

function getSouadSystemPrompt(isLoved) {
  return `${SOUAD_BASE_PROMPT}\n\n${isLoved ? SOUAD_LOVED_NOTE : SOUAD_MARRIED_NOTE}`;
}

// الأرقام اللي سعاد تعتبرهم "زوجها الحقيقي" وترد عليهم بحب بدل رفض الغزل
const SOUAD_LOVED_NUMBERS = ['218912832335', '942301686', '930471213'];

// الافتراضي (لو ما فيه فحص رقم متاح بمكان الاستدعاء) - الحالة العادية: متزوجة وترفض الغزل بلطف
const SOUAD_SYSTEM_PROMPT = getSouadSystemPrompt(false);

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

// ============ دالة الاتصال بـ Groq (الشات الرئيسي - موديل Llama 3.3 70B، أقوى من جيميناي) ============
// systemPromptOverride: لو انمرر، يستخدم بدل persona.systemPrompt الافتراضي
// (نستخدمها مع سعاد عشان نفرّق بين ردها العادي وردها لو الشخص من "أرقامها المدللة")
async function askAI(userMessage, history = [], personaKey = DEFAULT_PERSONA_KEY, systemPromptOverride = null) {
  const persona = PERSONAS[personaKey] || PERSONAS[DEFAULT_PERSONA_KEY];
  const systemPrompt = systemPromptOverride || persona.systemPrompt;
  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((h) => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content
      })),
      { role: 'user', content: userMessage },
      // تذكير أخير قبل الرد مباشرة - يقلل احتمال إن الموديل يطيح من اللهجة الليبية
      // أو يتجاهل سياق المحادثة السابقة، خصوصاً مع طلبات متتالية أو نصوص طويلة
      { role: 'system', content: 'تذكير: جاوب باللهجة الليبية الأصيلة فقط، ممنوع أي كلمة من لهجة تانية (مصرية/شامية/فصحى) أو أي لغة غير العربية. حافظ على شخصيتك وخذ بعين الاعتبار المحادثة السابقة كاملة.' }
    ];
    const response = await axios.post(
      GROQ_CHAT_ENDPOINT,
      {
        model: GROQ_CHAT_MODEL,
        messages,
        max_tokens: 500,
        temperature: 0.6
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return (response.data.choices?.[0]?.message?.content || '').trim();
  } catch (err) {
    console.error('خطأ بالاتصال مع Groq:', err.response?.data || err.message);
    return personaBusyMessage(personaKey);
  }
}

function isTrackedBotMessage(msgId) {
  return !!msgId && sentMessagePersona.has(msgId);
}

// ============ حفظ/تحميل ذاكرة المحادثات على القرص (تنجو من الريستارت) ============
// المشكلة: الذاكرة كانت بس بالـ RAM (Map عادي)، فأي ريستارت للسيرفر (شائع
// بالاستضافة المجانية زي Railway/Render) كان يمسحها بالكامل ومراد/سعاد ينسوا كل شي.
// الحل: نحفظ نسخة من كل المحادثات بملف JSON جوا persistDir، ونحمّلها عند بداية التشغيل.
function getHistoryFilePath(persistDir) {
  return path.join(persistDir, 'ai-conversations.json');
}

function loadHistoryFromDisk(persistDir) {
  try {
    const filePath = getHistoryFilePath(persistDir);
    if (!fs.existsSync(filePath)) return;
    const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const personaKey of Object.keys(saved)) {
      if (!PERSONAS[personaKey]) continue;
      PERSONAS[personaKey].history = new Map(Object.entries(saved[personaKey]));
    }
    console.log('✅ اترجعت ذاكرة محادثات مراد وسعاد من الملف المحفوظ.');
  } catch (err) {
    console.error('خطأ بتحميل ذاكرة المحادثات من الملف:', err.message);
  }
}

function saveHistoryToDisk(persistDir) {
  try {
    if (!persistDir) return;
    if (!fs.existsSync(persistDir)) fs.mkdirSync(persistDir, { recursive: true });
    const filePath = getHistoryFilePath(persistDir);
    const toSave = {};
    for (const personaKey of Object.keys(PERSONAS)) {
      toSave[personaKey] = Object.fromEntries(PERSONAS[personaKey].history);
    }
    fs.writeFileSync(filePath, JSON.stringify(toSave), 'utf8');
  } catch (err) {
    console.error('خطأ بحفظ ذاكرة المحادثات للملف:', err.message);
  }
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
  pushToHistory,
  getSouadSystemPrompt,
  SOUAD_LOVED_NUMBERS,
  loadHistoryFromDisk,
  saveHistoryToDisk
};
