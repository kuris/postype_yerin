

function decodeHtml(html = '') {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  try {
    const rssRes = await fetch('https://chatgpts.kr/rss', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!rssRes.ok) {
      throw new Error(`Tistory RSS fetch failed: ${rssRes.status}`);
    }

    const xml = await rssRes.text();
    const posts = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const content = match[1];
      
      const titleMatch = content.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
      const linkMatch = content.match(/<link>([\s\S]*?)<\/link>/);
      const descMatch = content.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
      const pubDateMatch = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      
      const title = titleMatch ? decodeHtml(titleMatch[1].trim()) : '';
      const link = linkMatch ? linkMatch[1].trim() : '';
      const description = descMatch ? decodeHtml(descMatch[1].trim()) : '';
      const pubDate = pubDateMatch ? new Date(pubDateMatch[1].trim()).toISOString() : new Date().toISOString();
      
      const categories = [];
      const catRegex = /<category>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/category>/g;
      let catMatch;
      while ((catMatch = catRegex.exec(content)) !== null) {
        categories.push(decodeHtml(catMatch[1].trim()));
      }
      
      const imgRegex = /<img[^>]+src=["']([^"']+)["']/i;
      const imgMatch = description.match(imgRegex);
      const thumbnail = imgMatch ? imgMatch[1] : '';
      
      // Clean summary by stripping HTML tags and decoding entities
      let summary = description
        .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
        .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (summary.length > 180) {
        summary = summary.slice(0, 180) + '...';
      }

      posts.push({
        id: link.split('/').pop(),
        title,
        summary,
        publishedAt: pubDate,
        thumbnail,
        tags: categories.length > 0 ? categories : ['영어공부'],
        link,
        price: 0,
        viewCount: 0,
        isTistory: true
      });
    }

    const size = Math.min(parseInt(req.query.size) || 100, 100);
    const sortedPosts = posts.slice(0, size);

    res.status(200).json({
      posts: sortedPosts,
      _debug: { source: 'tistory_rss', postCount: sortedPosts.length }
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      detail: err.stack || null
    });
  }
};
