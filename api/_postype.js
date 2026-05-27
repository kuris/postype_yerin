const CHANNEL_HANDLE = 'yasulfactory';
const CHANNEL_ID = '2007798';
const BASE_URL = 'https://www.postype.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

/**
 * HTML 스크래핑으로 여러 페이지에 걸쳐 포스트를 긁어옴 (50개 이상 완벽 지원)
 */
async function fetchPosts({ size = 100, sortType = 'RECENT', page = 0 } = {}) {
  const posts = [];
  const sort = sortType === 'POPULAR' ? 'popular' : 'recent';
  
  // 50개 이상을 원활히 지원하기 위해 서버에서 여러 페이지(1~5페이지)를 순회하며 긁어옴
  const startPage = page > 0 ? page : 1;
  const maxPagesToScrap = 5; // 최대 5페이지까지 순회하여 약 100~150개 확보
  
  let fetchedCount = 0;
  
  for (let p = startPage; p < startPage + maxPagesToScrap; p++) {
    const url = `${BASE_URL}/@${CHANNEL_HANDLE}/posts?sort=${sort}&page=${p}`;
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) break;
      const html = await res.text();
      const pagePosts = parsePostsFromHtml(html);
      
      if (!pagePosts || pagePosts.length === 0) break;
      
      posts.push(...pagePosts);
      fetchedCount += pagePosts.length;
      
      // 이미 충분한 양을 확보했다면 순회 종료
      if (posts.length >= size) break;
    } catch (e) {
      console.error(`Page ${p} scraping failed:`, e);
      break;
    }
  }

  // 중복 아이템 제거
  const uniquePosts = [];
  const seenIds = new Set();
  for (const post of posts) {
    if (!seenIds.has(post.id)) {
      seenIds.add(post.id);
      uniquePosts.push(post);
    }
  }

  return { data: uniquePosts.slice(0, size), url: `${BASE_URL}/@${CHANNEL_HANDLE}/posts` };
}

/**
 * HTML의 __NEXT_DATA__ 스크립트 태그에서 포스트 정보 완벽 추출
 */
function parsePostsFromHtml(html) {
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!nextDataMatch) return [];

  try {
    const nextData = JSON.parse(nextDataMatch[1]);
    const pageProps = nextData?.props?.pageProps;
    if (!pageProps) return [];

    // 포스타입 NextProps 내의 다양한 포스트 배열 경로 탐색
    const candidates = [
      pageProps.posts,
      pageProps.channelPosts,
      pageProps.channelHome?.posts,
      pageProps.channelHome?.channelPosts,
      pageProps.channelHome?.recentPosts,
      pageProps.channelHome?.popularPosts,
      pageProps.channelHome?.tabPosts?.posts,
      pageProps.channelHome?.tabPosts?.content,
      pageProps.initialData?.posts,
      pageProps.postList,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length > 0) {
        return candidate.map(normalizePost);
      }
    }
  } catch (e) {
    console.error('Error parsing JSON from __NEXT_DATA__:', e);
  }
  return [];
}

/**
 * RSS 피드에서 포스트 파싱 (최종 폴백용, 20개 내외 제한 있음)
 */
async function fetchPostsFromRss({ size = 100 } = {}) {
  const url = `${BASE_URL}/@${CHANNEL_HANDLE}/rss`;
  const res = await fetch(url, {
    headers: { ...HEADERS, 'Accept': 'application/rss+xml, application/xml, text/xml, */*' }
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();
  return parseRss(xml, size);
}

function parseRss(xml, limit = 100) {
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
      price: 0,
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
    price: p.price || 0,
  };
}

async function fetchChannelInfo() {
  return null;
}

module.exports = { fetchPosts, fetchPostsFromRss, fetchChannelInfo, CHANNEL_HANDLE, CHANNEL_ID, BASE_URL };
