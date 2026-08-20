import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import PhotoPicker from '@/components/submission/PhotoPicker';
import { MAX_PHOTOS } from '@/lib/submissions';

/**
 * 사진 고르기.
 *
 * Supabase를 부르지 않는 컴포넌트라 목이 필요 없다 — 업로드는 제출할 때
 * lib/submissions.ts가 따로 한다.
 *
 * jsdom에는 URL.createObjectURL이 없다. 미리보기 src는 화면 판단의 대상이 아니므로
 * 값만 흉내 내고, 대신 **놓아주는지(revoke)** 를 센다.
 */
const revoked: string[] = [];

beforeEach(() => {
  revoked.length = 0;
  let n = 0;
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => `blob:preview-${(n += 1)}`,
    revokeObjectURL: (url: string) => revoked.push(url),
  });
});

function thumbnails() {
  return document.querySelectorAll('.photo-picker__item img');
}

/** 크기·타입만 다른 가짜 이미지. 내용은 보지 않는다. */
function makeFile(name: string, type = 'image/jpeg', size = 1024): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

/** 파일 상태는 폼이 들고 있다. 실제 사용처와 같은 모양으로 감싼다. */
function Harness({ disabled = false }: { disabled?: boolean } = {}) {
  const [files, setFiles] = useState<File[]>([]);
  return <PhotoPicker files={files} onChange={setFiles} disabled={disabled} />;
}

describe('PhotoPicker', () => {
  it('브라우저 기본 파일 버튼 대신 우리 레이블을 보여준다', () => {
    render(<Harness />);

    // 입력은 남아 있다(포커스·키보드는 그대로여야 한다). 다만 눈에 띄지 않는다.
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    expect(screen.getByText('사진 고르기')).toBeInTheDocument();
    expect(screen.getByText(`최대 ${MAX_PHOTOS}장 · 5MB까지`)).toBeInTheDocument();
  });

  it('레이블이 파일 입력을 가리킨다', () => {
    render(<Harness />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const label = screen.getByText('사진 고르기').closest('label');
    expect(label).toHaveAttribute('for', input.id);
  });

  it('고른 사진을 썸네일로 보여주고 개수를 센다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, [makeFile('a.jpg'), makeFile('b.png', 'image/png')]);

    // alt=""라 접근성 트리에 없다(장식이다). 이름은 빼기 버튼이 말한다.
    expect(thumbnails()).toHaveLength(2);
    expect(screen.getByText(`2 / ${MAX_PHOTOS}장`)).toBeInTheDocument();
    // 두 번째부터는 "더 고르기"다. 이미 고른 것이 지워지지 않는다는 신호다.
    expect(screen.getByText('사진 더 고르기')).toBeInTheDocument();
  });

  it('빼기 버튼이 그 사진만 뺀다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, [makeFile('a.jpg'), makeFile('b.jpg')]);

    await user.click(screen.getByRole('button', { name: 'a.jpg 빼기' }));

    expect(thumbnails()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'b.jpg 빼기' })).toBeInTheDocument();
    // 뺀 사진의 blob은 놓아준다. 안 그러면 고를 때마다 메모리에 쌓인다.
    expect(revoked.length).toBeGreaterThan(0);
  });

  it('장수를 넘기면 사유를 보여준다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(
      input,
      Array.from({ length: MAX_PHOTOS + 1 }, (_, i) => makeFile(`${i}.jpg`)),
    );

    expect(screen.getByText(`사진은 ${MAX_PHOTOS}장까지 올릴 수 있어요`)).toBeInTheDocument();
  });

  it('보내는 중에는 고를 수 없다', () => {
    render(<Harness disabled />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDisabled();
  });
});
