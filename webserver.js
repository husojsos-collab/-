// ============ سيرفر ويب صغير (لازم لـ Render/Railway + لعرض QR وكود الربط) ============
// نفس فكرة السيرفر القديم بالضبط، بس بيقرا الحالة من whatsapp.js (state) بدل متغيرات
// عامة كانت متعرفة فوق بنفس index.js القديم.

const express = require('express');
const qrcode = require('qrcode');

function startWebServer({ port, state, requestPairingCode }) {
  const app = express();

  app.get('/', async (req, res) => {
    if (state.clientReady) {
      return res.send(`
        <html dir="rtl"><body style="font-family:sans-serif;text-align:center;padding-top:50px;">
        <h1>✅ البوت شغال ومتصل بواتساب</h1>
        </body></html>
      `);
    }

    // لو عندنا كود ربط جاهز، نعرضه
    if (state.lastPairingCode) {
      return res.send(`
        <html dir="rtl"><body style="font-family:sans-serif;text-align:center;padding-top:40px;">
        <h2>افتح واتساب > الإعدادات > الأجهزة المرتبطة > ربط جهاز > ربط برقم الهاتف</h2>
        <h1 style="letter-spacing:6px;font-size:42px;background:#111;color:#0f0;display:inline-block;padding:15px 25px;border-radius:10px;">${state.lastPairingCode}</h1>
        <p>الكود بينتهي بسرعة، لو ما وصلك بالوقت اعمل ريفريش وجيب كود جديد</p>
        <p><a href="/">🔄 رجوع</a></p>
        </body></html>
      `);
    }

    // نموذج لإدخال الرقم وتوليد كود الربط
    const errorHtml = state.pairingError
      ? `<p style="color:red;">${state.pairingError}</p>`
      : '';

    return res.send(`
      <html dir="rtl"><body style="font-family:sans-serif;text-align:center;padding-top:30px;">
      <h2>اختر طريقة الربط</h2>

      <h3>1) كود ربط برقم الهاتف</h3>
      <form action="/pair" method="get">
        <input name="number" placeholder="مثال: 9665xxxxxxxx (بدون + وبدون صفر)" style="padding:8px;width:260px;" required />
        <button type="submit" style="padding:8px 16px;">توليد الكود</button>
      </form>
      ${errorHtml}

      <hr style="margin:30px auto;width:300px;" />

      <h3>2) أو امسح QR</h3>
      ${state.lastQr ? `<img src="${await qrcode.toDataURL(state.lastQr)}" style="width:260px;height:260px;" />` : '<p>QR لسا ما جهز...</p>'}

      <p>الصفحة بتتحدث تلقائياً كل 5 ثواني</p>
      <script>setTimeout(()=>location.reload(), 5000);</script>
      </body></html>
    `);
  });

  // نقطة توليد كود الربط برقم الهاتف
  app.get('/pair', async (req, res) => {
    const number = req.query.number;
    if (!number || state.clientReady) {
      return res.redirect('/');
    }
    try {
      await requestPairingCode(number);
    } catch (err) {
      // الخطأ محفوظ بـ state.pairingError وبينعرض بالصفحة الرئيسية
    }
    return res.redirect('/');
  });

  // نقطة فحص صحة السيرفر (يطلبها Render/Railway أحياناً)
  app.get('/health', (req, res) => res.send('OK'));

  app.listen(port, () => {
    console.log(`🌐 سيرفر الويب شغال على البورت ${port}`);
  });

  return app;
}

module.exports = { startWebServer };
