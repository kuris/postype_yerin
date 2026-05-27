const { fetchPosts, fetchPostsFromRss, CHANNEL_HANDLE, BASE_URL } = require('./_postype');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  try {
    const size = Math.min(parseInt(req.query.size) || 100, 150); // 한도를 150개로 대폭 확대
    const sortType = req.query.sort === 'popular' ? 'POPULAR' : 'RECENT';
    const page = parseInt(req.query.page) || 0;

    let posts = [];
    let source = '';

    // 1차 시도: HTML 스크래핑 (페이지네이션 및 50개 이상 포스트 로드 지원)
    try {
      const { data } = await fetchPosts({ size, sortType, page });
      posts = Array.isArray(data) ? data : [];
      source = 'html';
    } catch (htmlErr) {
      // 2차 시도: HTML 실패 시 RSS 피드 폴백 (최대 20~50개)
      try {
        posts = await fetchPostsFromRss({ size });
        source = 'rss';
      } catch (rssErr) {
        throw new Error(`HTML Scraper: ${htmlErr.message} | RSS Fallback: ${rssErr.message}`);
      }
    }

    // 인기순 정렬 추가 보정 (RSS이거나 데이터상 정렬이 꼬인 경우)
    if (sortType === 'POPULAR') {
      posts = posts.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    }

    res.status(200).json({
      posts: posts.slice(0, size),
      _debug: { source, postCount: posts.length, requestedSize: size }
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      detail: err.detail || null
    });
  }
};
