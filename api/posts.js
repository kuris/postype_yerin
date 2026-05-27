const { fetchPosts } = require('./_postype');

module.exports = async function handler(req, res) {
  try {
    const size = Math.min(parseInt(req.query.size) || 20, 50);
    const sortType = req.query.sort === 'popular' ? 'POPULAR' : 'RECENT';
    const page = parseInt(req.query.page) || 0;

    const data = await fetchPosts({ size, sortType, page });
    const posts = data?.posts || data?.content || data?.data || data || [];

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.status(200).json({
      posts: Array.isArray(posts) ? posts : [],
      raw: data,  // 디버그용: 실제 응답 구조 확인
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
