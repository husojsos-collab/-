// ============ !بن - بحث صور بنترست ============
// يستخدم نفس نقطة الاتصال العامة اللي موقع بنترست نفسه يستخدمها
// بالمتصفح للبحث (BaseSearchResource) - ما فيه توثيق رسمي، ممكن
// ينكسر لو بنترست غيّروا هيكلة الـ API عندهم.

async function searchPinterest(query, count = 10) {
  const q = (query || '').trim();
  if (!q) return [];

  const data = {
    options: { query: q, scope: 'pins', page_size: count },
    context: {}
  };

  const url =
    'https://www.pinterest.com/resource/BaseSearchResource/get/' +
    `?source_url=${encodeURIComponent('/search/pins/?q=' + q)}` +
    `&data=${encodeURIComponent(JSON.stringify(data))}`;

  let json;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'application/json, text/javascript, */*, q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Pinterest-AppState': 'active'
      }
    });
    if (!res.ok) return [];
    json = await res.json();
  } catch (err) {
    console.error('خطأ بالبحث ببنترست:', err.message);
    return [];
  }

  const results = (json && json.resource_response && json.resource_response.data) || [];

  return results
    .filter((pin) => pin && pin.images && (pin.images.orig || pin.images['736x']))
    .map((pin) => ({
      imageUrl: (pin.images.orig || pin.images['736x']).url,
      pinUrl: `https://www.pinterest.com/pin/${pin.id}/`,
      title: pin.grid_title || pin.description || 'صورة بنترست'
    }));
}

module.exports = { searchPinterest };
