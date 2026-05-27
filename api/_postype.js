const CHANNEL_HANDLE = 'yasulfactory';
const CHANNEL_ID = '2007798';
const BASE_URL = 'https://www.postype.com';

const HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.postype.com/',
};

/**
 * 포스타입 공식 비동기 API로 모든 포스트를 병렬 일괄 스크래핑 (최대 개수 완전 제한 없음)
 */
async function fetchPosts({ size = 100, sortType = 'RECENT' } = {}) {
  try {
    // 1. 첫 페이지를 호출하여 전체 페이지 수(totalPages) 및 첫 페이지 아이템 획득
    const firstPageUrl = `https://api.postype.com/api/v2/channel/${CHANNEL_ID}/activity/all?page=1`;
    const res = await fetch(firstPageUrl, { headers: HEADERS });
    if (!res.ok) throw new Error(`Postype API status: ${res.status}`);
    
    const data = await res.json();
    const totalPages = data.totalPages || 1;
    const allItems = [...(data.content || [])];

    // 2. 만약 페이지가 더 있다면, Vercel 시간 초과 방지를 위해 병렬(Promise.all)로 모든 페이지 한꺼번에 fetch
    if (totalPages > 1) {
      const promises = [];
      // 2페이지부터 끝페이지까지 병렬 요청 생성
      for (let p = 2; p <= totalPages; p++) {
        promises.push(
          fetch(`https://api.postype.com/api/v2/channel/${CHANNEL_ID}/activity/all?page=${p}`, { headers: HEADERS })
            .then(r => r.ok ? r.json() : { content: [] })
            .catch(() => ({ content: [] }))
        );
      }
      const results = await Promise.all(promises);
      for (const result of results) {
        if (result && result.content) {
          allItems.push(...result.content);
        }
      }
    }

    // 3. 포스트 타입("POST")인 요소들만 필터링하여 데이터 매핑
    const posts = allItems
      .filter(item => item.type === 'POST' && item.feedItem)
      .map(item => normalizePost(item.feedItem));

    // 정렬 (인기순 요청 시 추가 정렬 가능)
    if (sortType === 'POPULAR') {
      // 뷰 카운트가 API에 있으면 사용, 없으면 좋아요/후원 통계 등 순서 유지
      posts.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    }

    return { data: posts.slice(0, size), url: firstPageUrl };
  } catch (err) {
    console.error('fetchPosts via internal API error:', err);
    throw err;
  }
}

/**
 * 포스타입 API의 feedItem 구조를 앱 표준 데이터 포맷으로 정규화
 */
function normalizePost(p) {
  // 타임스탬프가 초 단위(Unix timestamp)로 내려오므로 밀리초 단위로 보정
  const pubDate = p.publishedAt 
    ? new Date(p.publishedAt * 1000).toISOString() 
    : new Date().toISOString();

  // 해시태그 파싱 (#상식개변 #남존여비 등 subTitle에 해시태그가 있는 경우 태그 배열 추출)
  const tags = [];
  if (p.subTitle) {
    const hashTags = p.subTitle.match(/#([^\s#]+)/g);
    if (hashTags) {
      hashTags.forEach(t => tags.push(t.replace('#', '')));
    }
  }

  return {
    id: String(p.postId || p.id || ''),
    title: p.title || '',
    summary: p.excerpt || p.subTitle || '',
    publishedAt: pubDate,
    thumbnail: p.thumbnailUrl || p.coverImage || '',
    tags: tags.length > 0 ? tags : (p.tags || []),
    link: `${BASE_URL}/@${CHANNEL_HANDLE}/post/${p.postId || p.id}`,
    price: p.price || 0,
    viewCount: p.viewCount || 0,
  };
}

async function fetchPostsFromRss() {
  // RSS는 포스타입 자체에 원래 없으므로 빈 배열 폴백
  return [];
}

async function fetchChannelInfo() {
  const url = `https://api.postype.com/api/v1/channels/by/channel-name/${CHANNEL_HANDLE}`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

module.exports = { fetchPosts, fetchPostsFromRss, fetchChannelInfo, CHANNEL_HANDLE, CHANNEL_ID, BASE_URL };
