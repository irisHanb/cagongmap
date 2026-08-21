'use client';

import { useState } from 'react';
import type { Cafe } from '@/types/cafe';
import { getCafeByNaverUrl } from '@/lib/cafes';
import { checkPhotos, isNaverPlaceUrl, submitNewPlace } from '@/lib/submissions';
import PhotoPicker from './PhotoPicker';
import SubmissionModal from './SubmissionModal';

/**
 * 새 장소 제보 (place_reports).
 *
 * 받는 것은 네이버 URL·가게 이름·사진·메모다. 주소·좌표·영업시간은 받지 않는다 —
 * places는 그 넷이 not null이라 이 제보만으로는 승인이 되지 않지만, 그 값들을
 * 채우는 것은 검수하는 사람의 일로 정했다 (수기 큐레이션, docs/mvp-decisions.md).
 * 그래서 폼에서 "확인 후 올라간다"를 분명히 말해야 한다. 안 그러면 제보한 사람은
 * 지도에서 자기 카페를 찾다가 고장으로 읽는다.
 *
 * **가게 이름은 2026-08-21에 들어왔고 선택 입력이다.** 네이버 링크에서 상호를 뽑을
 * 방법이 없어서(naver.me는 장소 ID만 담은 주소로 리다이렉트하고, 그 페이지는 이름을
 * 클라이언트에서 렌더한다) 제보자에게 직접 받는다. 링크를 복사하는 사람은 이미 그
 * 카페 페이지를 보고 있으므로 아는 값이다. **필수로 만들지 않는다** — 문턱만 올라가고,
 * 비면 검수하는 사람이 링크를 열어 확인하던 예전 흐름 그대로다.
 */
export default function NewPlaceModal({
  onClose,
  onSelectCafe,
}: {
  onClose: () => void;
  /** 이미 등록된 카페였을 때 그 카페 상세를 열어준다 */
  onSelectCafe: (cafe: Cafe) => void;
}) {
  const [naverUrl, setNaverUrl] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  /** 이미 등록된 카페. 제보 대신 그쪽을 열어준다 */
  const [existing, setExisting] = useState<Cafe | null>(null);

  const url = naverUrl.trim();
  const canSubmit = url.length > 0 && checkPhotos(files) === null;

  const submit = () => {
    if (!isNaverPlaceUrl(url)) {
      // 네트워크를 타기 전에 여기서 끊는다.
      setError('네이버 지도 링크를 넣어주세요');
      return;
    }

    setPending(true);
    setError(null);

    // 같은 URL이 이미 있으면 제보해도 승인 시점에 places_naver_place_url_key가
    // 막는다. 접수된 줄 알았다가 조용히 버려지는 것보다 지금 알려주는 편이 낫다.
    getCafeByNaverUrl(url)
      .then((found) => {
        if (found) {
          setExisting(found);
          return;
        }
        return submitNewPlace({ naverUrl: url, placeName, files, note }).then(() => setDone(true));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setPending(false));
  };

  if (existing) {
    return (
      <SubmissionModal
        title="이미 등록된 카페예요"
        description={`${existing.name}은 지도에 이미 있어요. 정보가 다르면 상세에서 수정 요청을 보내주세요.`}
        submitLabel="카페 보기"
        canSubmit
        pending={false}
        error={null}
        onSubmit={() => {
          onSelectCafe(existing);
          onClose();
        }}
        onClose={onClose}
      >
        <></>
      </SubmissionModal>
    );
  }

  if (done) {
    return (
      <SubmissionModal
        title="보냈어요"
        description="확인한 뒤 지도에 올릴게요. 바로 보이지 않아도 접수된 것이 맞아요."
        submitLabel="확인"
        canSubmit
        pending={false}
        error={null}
        onSubmit={onClose}
        onClose={onClose}
      >
        <></>
      </SubmissionModal>
    );
  }

  return (
    <SubmissionModal
      title="카페 제보하기"
      description="작업하기 좋았던 카페를 알려주세요. 확인 후 지도에 올라갑니다."
      submitLabel="보내기"
      canSubmit={canSubmit}
      pending={pending}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <label className="field">
        <span className="field__label">
          네이버 지도 링크 <span className="field__hint">필수</span>
        </span>
        <input
          className="field__input"
          type="url"
          inputMode="url"
          value={naverUrl}
          onChange={(e) => setNaverUrl(e.target.value)}
          disabled={pending}
          placeholder="https://naver.me/..."
        />
      </label>

      <label className="field">
        <span className="field__label">
          가게 이름 <span className="field__hint">몰라도 괜찮아요</span>
        </span>
        <input
          className="field__input"
          value={placeName}
          onChange={(e) => setPlaceName(e.target.value)}
          disabled={pending}
          maxLength={100}
          placeholder="나루터"
        />
      </label>

      <PhotoPicker files={files} onChange={setFiles} disabled={pending} />

      <label className="field">
        <span className="field__label">메모</span>
        <textarea
          className="field__input field__input--area"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={pending}
          rows={3}
          placeholder="콘센트가 자리마다 있어요"
        />
      </label>
    </SubmissionModal>
  );
}
