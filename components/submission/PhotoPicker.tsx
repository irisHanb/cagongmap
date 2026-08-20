'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { ALLOWED_MIME, checkPhotos, MAX_PHOTOS } from '@/lib/submissions';

/**
 * 사진 고르기. 파일은 부모가 들고, 여기서는 고르고 지우고 미리 보여주기만 한다.
 *
 * 업로드는 하지 않는다 — 제출 버튼을 누를 때 lib/submissions.ts가 한 번에 올린다.
 * 고르는 즉시 올리면 폼을 닫고 마음을 바꾼 사람의 파일이 버킷에 남는다.
 *
 * 브라우저 기본 파일 입력을 그대로 쓰지 않는다. 회색 `파일 선택` 버튼과 영문
 * `No file chosen`이 이 화면에서 유일하게 OS 위젯처럼 보이기 때문이다. 입력은
 * 숨기고 label을 눌러 여는 방식으로 바꿔, 나머지 필드와 같은 규격(48px·pill·
 * outline-variant)을 따르게 했다. 접근성은 그대로다 — label의 htmlFor가 입력을
 * 가리키고, 입력은 숨겨도 포커스를 받는다.
 *
 * 미리보기는 카카오 avatar와 같은 이유로 next/image를 쓰지 않는다. 이쪽은
 * blob: URL이라 remotePatterns로 열 수 있는 대상도 아니다.
 */
export default function PhotoPicker({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled: boolean;
}) {
  const inputId = useId();
  /** 드래그가 영역 위에 올라와 있는가 — 테두리 하나만 바뀐다 */
  const [over, setOver] = useState(false);

  // 파일이 바뀔 때만 새로 만들고, 바뀌면 이전 것을 반드시 놓아준다.
  // revoke를 빠뜨리면 사진을 고를 때마다 blob이 메모리에 쌓인다.
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  const reason = checkPhotos(files);
  const accept = Object.keys(ALLOWED_MIME);

  const add = (picked: File[]) => {
    if (picked.length > 0) onChange([...files, ...picked]);
  };

  return (
    <div className="photo-picker">
      <span className="field__label">
        사진
        <span className="field__hint">
          {files.length > 0 ? `${files.length} / ${MAX_PHOTOS}장` : `최대 ${MAX_PHOTOS}장 · 5MB까지`}
        </span>
      </span>

      {/* 입력이 label보다 앞에 있어야 :focus-visible + 형제 선택자가 닿는다 */}
      <input
        id={inputId}
        type="file"
        className="photo-picker__input"
        accept={accept.join(',')}
        multiple
        disabled={disabled}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          // 같은 파일을 다시 고를 수 있게 input을 비운다. 비우지 않으면 지웠다가
          // 같은 사진을 다시 고를 때 change 이벤트가 오지 않는다.
          e.target.value = '';
          add(picked);
        }}
      />

      {/* 드롭도 받는다. 놓을 수 있게 생긴 영역이 놓이지 않으면 그게 더 나쁘다. */}
      <label
        className={`photo-picker__drop${over ? ' photo-picker__drop--over' : ''}`}
        htmlFor={inputId}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (disabled) return;
          // 이미지가 아닌 파일은 여기서 조용히 걸러낸다. 브라우저 파일 선택창은
          // accept로 이미 걸러 주지만 드롭에는 그 필터가 없다.
          add(Array.from(e.dataTransfer.files).filter((file) => accept.includes(file.type)));
        }}
      >
        <PhotoIcon />
        <span>{files.length > 0 ? '사진 더 고르기' : '사진 고르기'}</span>
      </label>

      {files.length > 0 && (
        <ul className="photo-picker__list">
          {files.map((file, index) => (
            <li key={previews[index]} className="photo-picker__item">
              {/* eslint-disable-next-line @next/next/no-img-element -- blob: 미리보기라 next/image 대상이 아니다 */}
              <img src={previews[index]} alt="" />
              <button
                type="button"
                className="photo-picker__remove"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                disabled={disabled}
                aria-label={`${file.name} 빼기`}
              >
                <RemoveIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      {reason && <p className="form-error">{reason}</p>}
    </div>
  );
}

/**
 * QuickCheckIcons와 같은 규격이다 — 16x16, currentColor stroke, 라이브러리 없음.
 * 색은 부모가 정한다.
 */
function PhotoIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="1.8" y="3.2" width="12.4" height="9.6" rx="2" />
      <circle cx="5.6" cy="6.6" r="1.1" />
      <path d="M2.4 11.2 5.8 8.4l2.6 2.2 2.2-1.8 2.8 2.4" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4.8 4.8l6.4 6.4M11.2 4.8l-6.4 6.4" />
    </svg>
  );
}
