const CHANNEL_HANDLE = 'yasulfactory';
const CHANNEL_ID = '2007798';
const BASE_URL = 'https://www.postype.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9',
};

/**
 * 포스타입 공개 채널 페이지 HTML에서 포스트 목록을 스크래핑
 */
async function fetchPosts({ size = 20, sortType = 'RECENT', page = 0 } = {}) {
  // 포스타입 공개 채널 페이지 (HTML)
  const sort = sortType === 'POPULAR' ? 'popular' : 'recent';
  const url = `${BASE_URL}/@${CHANNEL_HANDLE}?sort=${sort}&page=${page}`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`postype fetch failed: ${res.status}`);

  const html = await res.text();
  const posts = parsePostsFromHtml(html, size);

  return { data: posts, url };
}

/**
 * HTML에서 포스트 데이터 파싱
 */
function parsePostsFromHtml(html, limit = 20) {
  const posts = [];

  // 포스트 카드 패턴 매칭 (포스타입 HTML 구조 기반)
  // data-post-id 또는 post id 추출
  const postIdPattern = /\/post\/(\d+)/g;
  const titlePattern = /<[^>]*class="[^"]*post[^"]*title[^"]*"[^>]*>([^<]+)<\/[^>]+>/gi;

  // JSON-LD 구조화 데이터가 있으면 우선 파싱
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      try {
        const inner = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        const data = JSON.parse(inner);
        if (Array.isArray(data) || data['@type'] === 'ItemList') {
          // JSON-LD 기반 파싱 가능하면 사용
        }
      } catch {}
    }
  }

  // __NEXT_DATA__ 또는 window.__STATE__ 등 Next.js 내장 데이터 파싱
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const pageProps = nextData?.props?.pageProps;

      // 다양한 키 경로 시도
      const candidates = [
        pageProps?.posts,
        pageProps?.channelPosts,
        pageProps?.data?.posts,
        pageProps?.initialData?.posts,
        pageProps?.postList,
      ];

      for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length > 0) {
          return candidate.slice(0, limit).map(normalizePost);
        }
      }
    } catch {}
  }

  // 폴백: RSS 피드 파싱 시도
  return [];
}

/**
 * 포스타입 RSS 피드에서 포스트 파싱
 */
async function fetchPostsFromRss({ size = 20 } = {}) {
  const url = `${BASE_URL}/@${CHANNEL_HANDLE}/rss`;
  const res = await fetch(url, {
    headers: { ...HEADERS, 'Accept': 'application/rss+xml, application/xml, text/xml, */*' }
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();
  return parseRss(xml, size);
}

function parseRss(xml, limit = 20) {
  const posts = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && posts.length < limit) {
    const item = match[1];
    const get = (tag) => {
      const m = item.match(new RegExp(`<${tag}(?:[^>]*)><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}(?:[^>]*)>([^<]*)<\\/${tag}>`));
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    const link = get('link') || '';
    const idMatch = link.match(/\/post\/(\d+)/);
    posts.push({
      id: idMatch ? idMatch[1] : String(posts.length),
      title: get('title'),
      summary: get('description'),
      publishedAt: get('pubDate') ? new Date(get('pubDate')).toISOString() : null,
      thumbnail: (() => {
        const m = item.match(/url="([^"]+\.(jpg|jpeg|png|webp|gif))"/i);
        return m ? m[1] : '';
      })(),
      link,
      tags: [...item.matchAll(/<category>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/category>/g)].map(m => m[1].trim()),
    });
  }
  return posts;
}

function normalizePost(p) {
  return {
    id: String(p.id || p.postId || ''),
    title: p.title || p.postTitle || '',
    summary: p.summary || p.excerpt || p.description || '',
    publishedAt: p.publishedAt || p.createdAt || p.regDate || null,
    thumbnail: p.thumbnail || p.coverImage || p.mainImage || '',
    tags: p.tags || p.categories || [],
    link: `${BASE_URL}/@${CHANNEL_HANDLE}/post/${p.id || p.postId}`,
  };
}

async function fetchChannelInfo() {
  return null;
}

module.exports = { fetchPosts, fetchPostsFromRss, fetchChannelInfo, CHANNEL_HANDLE, CHANNEL_ID, BASE_URL };
