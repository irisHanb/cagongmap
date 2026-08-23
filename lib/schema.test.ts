import { describe, expect, it } from 'vitest';
import { cafeListSchema, jsonLdText } from '@/lib/schema';
import { makeCafe } from '@/test/fixtures';

/**
 * `<script>` 탈출만 본다. 스키마의 모양(어떤 필드를 넣고 뺐는지)은 문서가 정하는
 * 것이라 테스트로 굳히지 않는다 — 여기 관심사는 **값이 마크업이 되지 않는가** 하나다.
 *
 * ⚠️ 이스케이프 시퀀스를 그대로 찾을 때는 `'\\u003c'`로 적는다. `'<'`는
 *    TS 문자열 리터럴 안에서 그냥 `'<'`가 되어 정반대를 단언하게 된다.
 */
describe('jsonLdText', () => {
  it('script 블록을 닫을 수 있는 <를 남기지 않는다', () => {
    const cafe = makeCafe({ name: '</script><script>alert(1)</script>' });
    const text = jsonLdText(cafeListSchema([cafe], 'https://example.com/cafes'));

    expect(text).not.toContain('<');
    expect(text).toContain('\\u003c');
  });

  it('바꿔 놓아도 JSON으로는 같은 값이다', () => {
    const cafe = makeCafe({ name: '<카페>' });
    const text = jsonLdText(cafeListSchema([cafe], 'https://example.com/cafes'));

    // 이스케이프한 것은 JSON에서 <와 같은 값이라 파서가 읽는 결과는 바뀌지 않는다.
    expect(JSON.parse(text).itemListElement[0].item.name).toBe('<카페>');
  });
});
