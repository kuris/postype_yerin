const { fetchPosts } = require('./_postype');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  try {
    const size = Math.min(parseInt(req.query.size) || 20, 50);
    const sortType = req.query.sort === 'popular' ? 'POPULAR' : 'RECENT';
    const page = parseInt(req.query.page) || 0;

    const { data, url } = await fetchPosts({ size, sortType, page });

    // 포스타입 응답 구조 후보들 전부 시도
    const posts =
      data?.posts ||
      data?.content ||
      data?.data?.posts ||
      data?.result?.posts ||
      (Array.isArray(data) ? data : null) ||
      [];

    res.status(200).json({
      posts,
      raw: data,
      _debug: { url, postCount: posts.length }
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      detail: err.detail || null
    });
  }
};
