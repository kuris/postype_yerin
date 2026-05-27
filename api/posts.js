const { fetchPostsFromRss, fetchPosts, CHANNEL_HANDLE, BASE_URL } = require('./_postype');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  try {
    const size = Math.min(parseInt(req.query.size) || 20, 50);
    const sortType = req.query.sort === 'popular' ? 'POPULAR' : 'RECENT';
    const page = parseInt(req.query.page) || 0;

    let posts = [];
    let source = '';

    // 1차: RSS 피드로 시도 (가장 안정적)
    try {
      posts = await fetchPostsFromRss({ size });
      source = 'rss';
    } catch (rssErr) {
      // 2차: HTML 스크래핑 시도
      try {
        const { data } = await fetchPosts({ size, sortType, page });
        posts = Array.isArray(data) ? data : [];
        source = 'html';
      } catch (htmlErr) {
        throw new Error(`RSS: ${rssErr.message} | HTML: ${htmlErr.message}`);
      }
    }

    // 인기순은 클라이언트에서 필터 (RSS는 최신순만 제공)
    if (sortType === 'POPULAR') {
      // 간단히: 뷰 수 없으면 그냥 원래 순서 유지
      posts = posts.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    }

    res.status(200).json({
      posts: posts.slice(0, size),
      _debug: { source, postCount: posts.length }
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      detail: err.detail || null
    });
  }
};
