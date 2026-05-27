const { fetchPosts, fetchChannelInfo, CHANNEL_HANDLE, BASE_URL } = require('./_postype');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  try {
    const size = Math.min(parseInt(req.query.size) || 100, 150);
    const sortType = req.query.sort === 'popular' ? 'POPULAR' : 'RECENT';

    // 1. 채널 정보(구독자 수, 포스트 수 등)와 전체 포스트 목록 병렬 로딩
    const [channelInfo, { data: posts }] = await Promise.all([
      fetchChannelInfo().catch(() => null),
      fetchPosts({ size, sortType })
    ]);

    res.status(200).json({
      posts: posts || [],
      raw: channelInfo, // 헤더 통계 표시에 사용
      _debug: { source: 'postype_api', postCount: posts?.length || 0 }
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      detail: err.stack || null
    });
  }
};
