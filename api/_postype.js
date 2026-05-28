const CHANNEL_HANDLE = 'yasulfactory';
const CHANNEL_ID = '2007798';
const BASE_URL = 'https://www.postype.com';

const HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.postype.com/',
};

/**
 * 포스타입 공식 비동기 API + 채널 홈 HTML 파싱 하이브리드 수집 (50개 이상 누락 건 완전 해결)
 */
async function fetchPosts({ size = 100, sortType = 'RECENT' } = {}) {
  try {
    // 1. 채널 홈 HTML에서 가장 최신 포스트들(약 12개)을 먼저 실시간 수집
    const htmlPosts = await fetchPostsFromHtml();

    // 2. 비공개 API 피드에서 전체 아이템 획득 (stale/cached로 인한 최신 누락 보완용)
    const firstPageUrl = `https://api.postype.com/api/v2/channel/${CHANNEL_ID}/activity/all?page=1`;
    const res = await fetch(firstPageUrl, { headers: HEADERS });
    let apiPosts = [];

    if (res.ok) {
      const data = await res.json();
      const totalPages = data.totalPages || 1;
      const allItems = [...(data.content || [])];

      if (totalPages > 1) {
        const promises = [];
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

      apiPosts = allItems
        .filter(item => item.type === 'POST' && item.feedItem)
        .map(item => normalizePost(item.feedItem));
    }

    // 3. HTML 파싱 데이터와 API 피드 데이터를 병합 및 중복 제거
    const combinedPosts = [];
    const seenIds = new Set();

    // 최신 순서 유지를 위해 HTML 데이터를 우선 삽입
    for (const post of htmlPosts) {
      if (!seenIds.has(post.id)) {
        seenIds.add(post.id);
        combinedPosts.push(post);
      }
    }

    // 그 다음 API 데이터를 순차 병합
    for (const post of apiPosts) {
      if (!seenIds.has(post.id)) {
        seenIds.add(post.id);
        combinedPosts.push(post);
      }
    }

    // 4. 발행일 기준 내림차순 정렬 (최신순 정렬 기본 보장)
    combinedPosts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // 인기순 요청인 경우 정렬 분기
    if (sortType === 'POPULAR') {
      combinedPosts.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    }

    return { data: combinedPosts.slice(0, size), url: `https://www.postype.com/@${CHANNEL_HANDLE}` };
  } catch (err) {
    console.error('fetchPosts via hybrid pipeline error:', err);
    throw err;
  }
}

/**
 * 채널 홈 HTML의 self.__next_f.push 스트림에서 포스트 객체 직접 추출
 */
async function fetchPostsFromHtml() {
  const posts = [];
  try {
    const res = await fetch(`https://www.postype.com/@${CHANNEL_HANDLE}`, { headers: HEADERS });
    if (!res.ok) return [];
    const html = await res.text();

    const scriptRegex = /<script([^>]*)>([\s\S]*?)<\/script>/g;
    let match;
    let combinedText = '';
    while ((match = scriptRegex.exec(html)) !== null) {
      const content = match[2];
      if (content.includes('self.__next_f.push')) {
        combinedText += content;
      }
    }

    // 직렬화된 JSON 문자열 역직렬화 및 디코딩
    let unescaped = combinedText;
    unescaped = unescaped.replace(/\\"/g, '"');
    unescaped = unescaped.replace(/\\\\/g, '\\');

    const seenIds = new Set();
    let pos = 0;

    while ((pos = unescaped.indexOf('"postId":', pos)) !== -1) {
      let startIdx = -1;
      let braceCount = 0;
      for (let i = pos; i >= 0; i--) {
        if (unescaped[i] === '}') braceCount--;
        if (unescaped[i] === '{') {
          braceCount++;
          if (braceCount === 1) {
            startIdx = i;
            break;
          }
        }
      }

      if (startIdx !== -1) {
        let endIdx = -1;
        braceCount = 1;
        for (let i = startIdx + 1; i < unescaped.length; i++) {
          if (unescaped[i] === '{') braceCount++;
          if (unescaped[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              endIdx = i;
              break;
            }
          }
        }

        if (endIdx !== -1) {
          const jsonStr = unescaped.slice(startIdx, endIdx + 1);
          try {
            const obj = JSON.parse(jsonStr);
            if (obj.postId && obj.title && !seenIds.has(obj.postId)) {
              seenIds.add(obj.postId);
              posts.push(normalizePost(obj));
            }
          } catch (e) {
            // 구문 오류 건 무시
          }
        }
      }
      pos += 9;
    }
  } catch (err) {
    console.error('fetchPostsFromHtml parsing failed:', err);
  }
  return posts;
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

  // 썸네일 URL을 다각적으로 파싱하여 에셋 누락 방지
  const thumb = p.thumbnailUrl || p.coverImage || (p.thumbnails && p.thumbnails[0] ? p.thumbnails[0].url : '');

  return {
    id: String(p.postId || p.id || ''),
    title: p.title || '',
    summary: p.summary || p.excerpt || p.subTitle || '',
    publishedAt: pubDate,
    thumbnail: thumb || '',
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
