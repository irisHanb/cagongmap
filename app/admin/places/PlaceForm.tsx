'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import EnumSelect from '@/components/admin/EnumSelect';
import {
  missingForPublished,
  PLACE_STATUS_LABEL,
  type PhotoSlot,
  type PlaceFormValues,
  type PlaceStatus,
} from '@/lib/admin/place-form';
import {
  NOISE_LABEL,
  OUTLET_LABEL,
  WORK_FIT_LABEL,
  WORK_POLICY_LABEL,
} from '@/types/cafe';
import LocationPicker from './LocationPicker';
import PhotoManager from './PhotoManager';
import { savePlaceAction, type PhotoPlanItem } from './actions';

/** 검수 참고 자료. 폼 위에 읽기 전용으로 놓인다 */
export interface SubmissionReference {
  kind: 'report' | 'edit';
  /** 공개 URL */
  photos: string[];
  note: string | null;
  naverPlaceUrl: string | null;
  /** 제보자가 적은 가게 이름. 확인된 상호가 아니라 검수의 출발점이다 */
  placeName: string | null;
  /** 이 저장으로 승인까지 할 것인가. 이미 처리된 건이면 false다 */
  approvable: boolean;
}

const asOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

const STATUS_OPTIONS = asOptions(PLACE_STATUS_LABEL);
const WIFI_OPTIONS = [
  { value: 'true', label: '있음' },
  { value: 'false', label: '없음' },
];

/**
 * 장소 추가·수정 공용 폼.
 *
 * 하나로 두는 이유는 다루는 컬럼이 같아서다. 갈리는 것은 "저장이 insert냐 update냐"
 * 하나뿐이고 그것은 `placeId`의 유무로 표현된다.
 */
export default function PlaceForm({
  placeId,
  initialValues,
  initialPhotos,
  reference,
  reportId,
  requestId,
}: {
  placeId?: string;
  initialValues: PlaceFormValues;
  initialPhotos: { path: string; url: string }[];
  reference?: SubmissionReference;
  reportId?: string;
  requestId?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [slots, setSlots] = useState<PhotoSlot[]>(
    initialPhotos.map((photo) => ({ kind: 'existing', path: photo.path, url: photo.url })),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const originalPhotos = initialPhotos.map((photo) => photo.path);
  /**
   * 공개까지 남은 것. 저장할 때가 아니라 **지금** 보여준다.
   *
   * 2026-08-21에 실제로 밟았다 — 제보를 승인해 카페를 만들었는데 status가 폼
   * 기본값(`작성 중`)이라 지도에 뜨지 않았고, 화면 어디에도 그 사실이 없어서
   * "제보한 카페가 안 나온다"로 돌아왔다. 저장 뒤에 알려주면 이미 늦다.
   */
  const missing = missingForPublished(values);
  const set = <K extends keyof PlaceFormValues>(key: K, value: PlaceFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const save = () => {
    setErrors([]);
    setWarning(null);

    // 슬롯 배열을 "순서(plan) + 파일(files)"로 가른다. 서버 액션 인자를 지나며
    // 어느 파일이 몇 번째 칸인지가 흐려지지 않게 index로 잇는다.
    const files: File[] = [];
    const photoPlan: PhotoPlanItem[] = slots.map((slot) => {
      if (slot.kind === 'existing') return { kind: 'existing', path: slot.path };
      files.push(slot.file);
      return { kind: 'new', index: files.length - 1 };
    });

    startSave(async () => {
      const result = await savePlaceAction({
        id: placeId,
        values,
        photoPlan,
        files,
        originalPhotos,
        reportId,
        requestId,
      });

      if (!result.ok) {
        setErrors(result.errors);
        // 목록은 폼 아래에 그대로 남는다. 토스트는 "저장이 안 됐다"는 사실만 알린다 —
        // 버튼을 누른 뒤 화면이 그대로면 눌리지 않은 줄 안다.
        toast('저장하지 못했어요', {
          description:
            result.errors.length > 1 ? `${result.errors[0]} 외 ${result.errors.length - 1}건` : result.errors[0],
        });
        return;
      }
      if (result.warning) {
        // 장소는 저장됐고 승인만 실패했다. 목록으로 보내면 이 사실이 묻힌다.
        setWarning(result.warning);
        toast('장소는 저장했어요', { description: result.warning });
        router.refresh();
        return;
      }

      /**
       * ★ 지도에 뜨는지를 여기서 말한다.
       *
       * 2026-08-21에 "제보한 카페가 지도에 안 나온다"로 돌아온 적이 있다. 원인은
       * status가 폼 기본값(`작성 중`)이었던 것인데, 저장하고 목록으로 넘어가는
       * 순간에는 아무도 그 말을 하지 않았다. 폼 안의 안내는 떠나면 사라지므로
       * **결과를 말해야 할 그 순간**에 한 번 더 말한다.
       */
      const published = values.status === 'published';
      toast.success(reportId || requestId ? '저장하고 승인했어요' : '저장했어요', {
        description: published
          ? '지도에 올라갑니다.'
          : `상태가 «${PLACE_STATUS_LABEL[values.status]}»라 아직 지도에 뜨지 않아요.`,
      });

      router.push('/admin/places');
      router.refresh();
    });
  };

  return (
    // 폼은 목록보다 좁은 기둥으로 세운다. 입력 한 줄이 화면 폭만큼 길어지면
    // 라벨과 값이 멀어져 어느 칸을 채우는 중인지 놓친다.
    <div className="mx-auto w-full max-w-3xl space-y-8">
      {reference && <ReferenceBlock reference={reference} />}

      <Section title="식별">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="name" label="이름" required>
            <Input
              id="name"
              value={values.name}
              onChange={(event) => set('name', event.target.value)}
              disabled={saving}
            />
          </Field>
          <Field id="slug" label="slug" hint="URL 키. 비워 두면 uuid로 버팁니다">
            <Input
              id="slug"
              value={values.slug}
              onChange={(event) => set('slug', event.target.value)}
              disabled={saving}
              placeholder="naruteo"
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
          <Field id="address" label="주소" required>
            <Input
              id="address"
              value={values.address}
              onChange={(event) => set('address', event.target.value)}
              disabled={saving}
            />
          </Field>
          <Field id="district" label="자치구">
            <Input
              id="district"
              value={values.district}
              onChange={(event) => set('district', event.target.value)}
              disabled={saving}
              placeholder="송파구"
            />
          </Field>
        </div>
        <Field id="naver" label="네이버 링크">
          <Input
            id="naver"
            value={values.naver_place_url}
            onChange={(event) => set('naver_place_url', event.target.value)}
            disabled={saving}
            placeholder="https://naver.me/…"
          />
        </Field>
      </Section>

      <Section title="위치" hint="가게 이름으로 검색해 고르면 좌표와 주소가 채워집니다. 좌표는 직접 쓰는 칸이 아니라 검색이나 지도 클릭으로 정합니다">
        <LocationPicker
          value={{ lat: values.lat, lng: values.lng }}
          address={values.address}
          onChange={(next) => setValues((current) => ({ ...current, ...next }))}
          onAddressFound={(found) => set('address', found)}
          disabled={saving}
        />
      </Section>

      <Section title="영업">
        <div className="flex items-center gap-2">
          <Checkbox
            id="is_24h"
            checked={values.is_24h}
            onCheckedChange={(checked) => set('is_24h', checked === true)}
            disabled={saving}
          />
          <Label htmlFor="is_24h">24시간 영업</Label>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field id="open_time" label="여는 시각">
            <Input
              id="open_time"
              type="time"
              value={values.open_time}
              onChange={(event) => set('open_time', event.target.value)}
              disabled={saving || values.is_24h}
            />
          </Field>
          <Field id="close_time" label="닫는 시각" hint="자정 마감은 00:00">
            <Input
              id="close_time"
              type="time"
              value={values.close_time}
              onChange={(event) => set('close_time', event.target.value)}
              disabled={saving || values.is_24h}
            />
          </Field>
          <Field id="price" label="아이스 아메리카노">
            <Input
              id="price"
              inputMode="numeric"
              value={values.iced_americano_price}
              onChange={(event) => set('iced_americano_price', event.target.value)}
              disabled={saving}
              placeholder="4500"
            />
          </Field>
        </div>
      </Section>

      <Section title="Quick Check" hint="공개하려면 콘센트 · 와이파이 · 소음 · 작업 적합도가 채워져 있어야 합니다">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <EnumSelect
            id="outlet"
            label="콘센트"
            value={values.outlet}
            options={asOptions(OUTLET_LABEL)}
            onChange={(next) => set('outlet', next)}
            disabled={saving}
          />
          <EnumSelect
            id="wifi"
            label="와이파이"
            value={values.wifi}
            options={WIFI_OPTIONS}
            onChange={(next) => set('wifi', next)}
            disabled={saving}
          />
          <EnumSelect
            id="noise"
            label="소음"
            value={values.noise}
            options={asOptions(NOISE_LABEL)}
            onChange={(next) => set('noise', next)}
            disabled={saving}
          />
          <EnumSelect
            id="work_fit"
            label="작업 적합도"
            value={values.work_fit}
            options={asOptions(WORK_FIT_LABEL)}
            onChange={(next) => set('work_fit', next)}
            disabled={saving}
          />
        </div>
        <EnumSelect
          id="work_policy"
          label="카공 정책"
          value={values.work_policy}
          options={asOptions(WORK_POLICY_LABEL)}
          onChange={(next) => set('work_policy', next)}
          disabled={saving}
          emptyLabel="모름 (가 보지 않았음)"
        />
        {/* 값은 9곳 전부 null이다. 매장에 가 봐야 아는 값이라 추측으로 채우지 않는다 */}
        <p className="text-meta text-on-surface-variant">
          카공 정책은 매장에 가 봐야 아는 값입니다. 확인하지 않았으면 비워 두세요.
        </p>
      </Section>

      <Section title="사진">
        <PhotoManager slots={slots} onChange={setSlots} disabled={saving} />
        {reference && reference.photos.length > 0 && reference.approvable && (
          <p className="text-meta text-on-surface-variant">
            제보 사진 {reference.photos.length}장은 승인할 때 자동으로 붙습니다. 여기서 다시 고르지 마세요.
          </p>
        )}
      </Section>

      <Section title="운영" hint="지도에 뜨는 것은 상태가 «공개»인 카페뿐입니다">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <EnumSelect
            id="status"
            label="상태"
            value={values.status}
            options={STATUS_OPTIONS}
            onChange={(next) => set('status', next as PlaceStatus)}
            disabled={saving}
            required
          />
          <Field
            id="last_verified"
            label="확인일"
            hint={requestId ? '승인하면 오늘로 바뀝니다' : undefined}
          >
            <Input
              id="last_verified"
              type="date"
              value={values.last_verified}
              onChange={(event) => set('last_verified', event.target.value)}
              disabled={saving}
            />
          </Field>
          <Field id="tags" label="태그" hint="쉼표로 구분">
            <Input
              id="tags"
              value={values.tags}
              onChange={(event) => set('tags', event.target.value)}
              disabled={saving}
              placeholder="조용함, 넓은책상"
            />
          </Field>
        </div>

        {/* 색을 주지 않는다. 경고가 아니라 안내다 (DESIGN.md) */}
        {values.status !== 'published' && (
          <p className="rounded-md bg-surface-low px-4 py-2 text-meta text-on-surface-variant">
            지금 상태(<strong className="text-on-surface">{PLACE_STATUS_LABEL[values.status]}</strong>)
            로는 <strong className="text-on-surface">지도에 뜨지 않습니다.</strong>{' '}
            {missing.length > 0
              ? `공개하려면 ${missing.join(' · ')}을(를) 채우고 상태를 «공개»로 바꾸세요.`
              : '상태를 «공개»로 바꾸면 바로 올라갑니다.'}
          </p>
        )}
      </Section>

      <div className="flex flex-col-reverse gap-2 border-t border-outline-variant pt-6 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="ghost" onClick={() => router.push('/admin/places')} disabled={saving}>
          취소
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? '저장하는 중…' : reportId || requestId ? '저장하고 승인' : '저장'}
        </Button>
      </div>

      {/* 실패 문구는 12px 회색이다. 실패에 색을 주지 않는다 (DESIGN.md) */}
      {errors.length > 0 && (
        <ul className="space-y-1 sm:text-right text-meta text-on-surface-variant">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      {warning && (
        <p className="rounded-md bg-surface-low px-4 py-2 text-meta text-on-surface-variant">{warning}</p>
      )}
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-section-title text-on-surface">{title}</h2>
        {hint && <p className="text-meta text-on-surface-variant">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-1 text-on-surface-variant">*</span>}
        {hint && <span className="ml-2 text-meta text-on-surface-variant">{hint}</span>}
      </Label>
      {children}
    </div>
  );
}

/**
 * 제보에서 온 참고 자료. **읽기 전용이다.**
 *
 * 제보에는 이름·주소·좌표가 없다(URL·사진·메모뿐). 그래서 폼을 자동으로 채워 줄 수
 * 없고, 사람이 이것을 보면서 직접 채운다. 그 사실이 화면에 드러나야 한다.
 */
function ReferenceBlock({ reference }: { reference: SubmissionReference }) {
  return (
    <aside className="space-y-4 rounded-lg border border-outline-variant bg-warm-cream p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h2 className="text-section-title text-on-surface">
          {reference.kind === 'report' ? '제보 내용' : '수정 요청 내용'}
        </h2>
        {!reference.approvable && (
          <span className="text-meta text-on-surface-variant">
            이미 처리된 건이라 승인 없이 저장만 합니다
          </span>
        )}
      </div>

      {reference.placeName && (
        <p className="text-body">
          <span className="font-bold">{reference.placeName}</span>
          <span className="ml-2 text-meta text-on-surface-variant">제보자가 적은 이름</span>
        </p>
      )}

      {reference.naverPlaceUrl && (
        <p className="text-body">
          <a
            href={reference.naverPlaceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="break-all underline underline-offset-4 hover:text-primary"
          >
            {reference.naverPlaceUrl}
          </a>
        </p>
      )}

      {/* 읽기 전용 메모를 Textarea로 그리지 않는다. 고칠 수 없는 값에 입력칸 모양을
          주면 눌러보게 되고, 무엇보다 "둥근 카드 안에 또 카드"가 된다 (DESIGN.md — Don't) */}
      <p className="whitespace-pre-wrap text-body text-on-surface-variant">
        {reference.note?.trim() || '메모 없음'}
      </p>

      {reference.photos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {reference.photos.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer noopener" title="원본 열기">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="size-16 rounded-md border border-outline-variant object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
