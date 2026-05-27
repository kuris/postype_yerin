# 서예린의 은밀한 실험실 — RSS & 채널 대시보드

포스타입 채널(@yasulfactory)의 RSS 피드 + 커스텀 대시보드 페이지.

## 구조

```
/api/rss.js      → GET /rss.xml   (RSS 2.0 피드)
/api/posts.js    → GET /posts     (JSON API, 프론트용)
/api/_postype.js → 포스타입 API fetcher 공통 모듈
/public/index.html → 채널 대시보드
vercel.json      → 라우팅 설정
```

## Vercel 배포

```bash
npm i -g vercel
vercel --prod
```

끝. 도메인은 `your-project.vercel.app` 형태로 자동 생성됨.

## RSS 구독 주소

```
https://your-project.vercel.app/rss.xml
```

Feedly, Inoreader, NetNewsWire 등 아무 RSS 리더에 붙여넣으면 됨.

## 트러블슈팅

포스트가 안 나오면 브라우저 콘솔에서 `[postype raw]` 로그 확인.
포스타입이 API 구조를 바꿨을 때 `_postype.js`의 응답 파싱 부분 수정:
```js
const posts = data?.posts || data?.content || data?.data || data || [];
```

## 포스타입 내부 API 엔드포인트 (확인됨)

- 포스트 목록: `https://www.postype.com/@yasulfactory/posts?size=N&sortType=RECENT|POPULAR&page=N`
- 채널 홈: `https://www.postype.com/@yasulfactory/channel-home?size=3&sort=TIME_LEFT&page=0&channelId=2007798`
