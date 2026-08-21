import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site';

/**
 * 전부 허용한다. 색인을 막고 싶어도 여기서 막으면 안 된다.
 *
 * 슬랙의 링크 펼치기 봇(Slackbot-LinkExpanding)은 robots.txt를 지킨다. `Disallow: /`를
 * 두면 색인만 막히는 게 아니라 **공유 카드 자체가 안 뜬다.** 색인 차단은 layout.tsx의
 * meta robots가 맡는다 — 스크래퍼는 그 태그를 보지 않으므로 카드는 그대로 뜬다.
 *
 * sitemap은 두지 않는다. 페이지가 하나뿐이고 그마저 noindex다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    host: SITE_URL,
  };
}
