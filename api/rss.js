const { fetchPosts, CHANNEL_HANDLE, BASE_URL } = require('./_postype');

function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildRss(posts) {
  const items = posts.map(p => {
    const link = `${BASE_URL}/@${CHANNEL_HANDLE}/post/${p.id}`;
    const pubDate = p.publishedAt
      ? new Date(p.publishedAt).toUTCString()
      : new Date().toUTCString();
    const desc = escapeXml(p.summary || p.excerpt || '');
    const title = escapeXml(p.title || '(제목 없음)');
    const thumb = p.thumbnail || p.coverImage || '';
    const enclosure = thumb
      ? `<enclosure url="${escapeXml(thumb)}" type="image/jpeg" length="0"/>`
      : '';
    const tags = (p.tags || []).map(t => `<category>${escapeXml(t)}</category>`).join('');
    return `
    <item>
      <title>${title}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${desc}</description>
      ${enclosure}
      ${tags}
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>금기된 관능의 서사</title>
    <link>https://www.postype.com/@${CHANNEL_HANDLE}</link>
    <description>TS·NTR·조교·하드코어 등 다양한 장르의 금기된 관능의 서사</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;
}

module.exports = async function handler(req, res) {
  try {
    const data = await fetchPosts({ size: 50, sortType: 'RECENT' });

    // 포스타입 응답 구조에 맞게 포스트 배열 추출
    const posts = data?.posts || data?.content || data?.data || data || [];

    const xml = buildRss(Array.isArray(posts) ? posts : []);

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    res.status(200).send(xml);
  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: err.message });
  }
};
