// ============ التاريخ والوقت المحلي حسب دولة رقم الهاتف (مفتاح الاتصال الدولي) ============
// نفس قائمة مفاتيح الدول الموجودة بـ util.js (getCountryFlag)، بس بدل العلم برجع منطقة زمنية حقيقية.

const DIAL_CODE_TIMEZONES = [
  ['218', 'Africa/Tripoli'], ['213', 'Africa/Algiers'], ['216', 'Africa/Tunis'], ['212', 'Africa/Casablanca'], ['227', 'Africa/Niamey'],
  ['966', 'Asia/Riyadh'], ['971', 'Asia/Dubai'], ['974', 'Asia/Qatar'], ['973', 'Asia/Bahrain'], ['965', 'Asia/Kuwait'],
  ['968', 'Asia/Muscat'], ['964', 'Asia/Baghdad'], ['963', 'Asia/Damascus'], ['962', 'Asia/Amman'], ['961', 'Asia/Beirut'],
  ['970', 'Asia/Gaza'], ['967', 'Asia/Aden'], ['249', 'Africa/Khartoum'], ['222', 'Africa/Nouakchott'], ['252', 'Africa/Mogadishu'],
  ['253', 'Africa/Djibouti'], ['269', 'Indian/Comoro'], ['20', 'Africa/Cairo'], ['90', 'Europe/Istanbul'], ['44', 'Europe/London'],
  ['49', 'Europe/Berlin'], ['33', 'Europe/Paris'], ['1', 'America/New_York']
].sort((a, b) => b[0].length - a[0].length);

function getTimezoneForNumber(numberDigits) {
  const clean = (numberDigits || '').replace(/\D/g, '');
  for (const [code, tz] of DIAL_CODE_TIMEZONES) {
    if (clean.startsWith(code)) return tz;
  }
  return 'UTC'; // دولة مو معروفة بالقائمة
}

// بيرجع تاريخ حقيقي (يوم الأسبوع + رقم + شهر + سنة) ووقت محلي، حسب دولة الرقم
function formatLocalDateTime(numberDigits) {
  const tz = getTimezoneForNumber(numberDigits);
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-EG', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('ar-EG', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  return { dateStr, timeStr, tz };
}

module.exports = {
  getTimezoneForNumber,
  formatLocalDateTime
};
