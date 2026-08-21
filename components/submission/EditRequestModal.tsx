'use client';

import { useState } from 'react';
import type { Cafe } from '@/types/cafe';
import { checkPhotos, submitEdit } from '@/lib/submissions';
import PhotoPicker from './PhotoPicker';
import SubmissionModal from './SubmissionModal';

/**
 * 기존 카페 수정 요청 (place_edit_requests).
 *
 * 받는 것은 사진과 메모뿐이다. 콘센트·소음 같은 구조화된 필드를 폼에 늘어놓지
 * 않는 이유는, 그 값들이 운영자가 직접 확인해 매기는 핵심 자산이기 때문이다
 * (docs/scope.md). 사용자가 알려줄 것은 "무엇이 달라졌는지"이고 판단은 검수에서 한다.
 */
export default function EditRequestModal({ cafe, onClose }: { cafe: Cafe; onClose: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // 사진도 메모도 없으면 보낼 내용이 없다.
  const canSubmit = (files.length > 0 || note.trim().length > 0) && checkPhotos(files) === null;

  const submit = () => {
    setPending(true);
    setError(null);

    submitEdit(cafe.id, { files, note })
      .then(() => setDone(true))
      .catch((e: Error) => setError(e.message))
      .finally(() => setPending(false));
  };

  if (done) {
    return (
      <SubmissionModal
        title="보냈어요"
        description={`${cafe.name} 정보를 확인한 뒤 지도에 반영할게요.`}
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
      title="정보가 다른가요?"
      description={`${cafe.name}에서 달라진 점을 알려주세요. 확인 후 반영합니다.`}
      submitLabel="보내기"
      canSubmit={canSubmit}
      pending={pending}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <PhotoPicker files={files} onChange={setFiles} disabled={pending} />

      <label className="field">
        <span className="field__label">메모</span>
        <textarea
          className="field__input field__input--area"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={pending}
          rows={4}
          placeholder="영업시간이 바뀌었어요"
        />
      </label>
    </SubmissionModal>
  );
}
