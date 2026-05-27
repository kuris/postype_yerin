// 포스타입 내부 API 호출 공통 모듈
// 채널 ID: 2007798 (@yasulfactory)

const CHANNEL_ID = '2007798';
const CHANNEL_HANDLE = 'yasulfactory';
const BASE_URL = 'https://www.postype.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer': `https://www.postype.com/@${CHANNEL_HANDLE}`,
  'x-requested-with': 'XMLHttpRequest',
};

async function fetchPosts({ size = 20, sortType = 'RECENT', page = 0 } = {}) {
  const url = `${BASE_URL}/@${CHANNEL_HANDLE}/posts?size=${size}&sortType=${sortType}&page=${page}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`postype API error: ${res.status}`);
  return res.json();
}

async function fetchChannelInfo() {
  const url = `${BASE_URL}/@${CHANNEL_HANDLE}/channel-home?size=3&sort=TIME_LEFT&page=0&channelId=${CHANNEL_ID}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`postype channel API error: ${res.status}`);
  return res.json();
}

module.exports = { fetchPosts, fetchChannelInfo, CHANNEL_HANDLE, CHANNEL_ID, BASE_URL };
