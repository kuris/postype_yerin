const CHANNEL_ID = '2007798';
const CHANNEL_HANDLE = 'yasulfactory';
const BASE_URL = 'https://www.postype.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
  'Referer': `https://www.postype.com/@${CHANNEL_HANDLE}`,
  'x-requested-with': 'XMLHttpRequest',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
};

async function fetchPosts({ size = 20, sortType = 'RECENT', page = 0 } = {}) {
  const urls = [
    `${BASE_URL}/@${CHANNEL_HANDLE}/posts?size=${size}&sortType=${sortType}&page=${page}`,
    `${BASE_URL}/api/v2/channels/${CHANNEL_HANDLE}/posts?size=${size}&sortType=${sortType}&page=${page}`,
    `${BASE_URL}/api/channels/${CHANNEL_ID}/posts?size=${size}&sortType=${sortType}&page=${page}`,
  ];

  let lastErr;
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { continue; }
      if (res.ok) return { data: json, url };
      lastErr = { status: res.status, url, body: text.slice(0, 200) };
    } catch(e) {
      lastErr = { error: e.message, url };
    }
  }
  throw Object.assign(new Error('All postype endpoints failed'), { detail: lastErr });
}

async function fetchChannelInfo() {
  const url = `${BASE_URL}/@${CHANNEL_HANDLE}/channel-home?size=3&sort=TIME_LEFT&page=0&channelId=${CHANNEL_ID}`;
  const res = await fetch(url, { headers: HEADERS });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return null; }
}

module.exports = { fetchPosts, fetchChannelInfo, CHANNEL_HANDLE, CHANNEL_ID, BASE_URL };
