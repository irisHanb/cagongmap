'use server';

import { revalidatePath } from 'next/cache';
import { rejectSubmission } from '@/lib/admin/reports';
import type { SubmissionKind } from '@/lib/admin/submission';

/**
 * 반려.
 *
 * `requireCurator()`는 `rejectSubmission()` 안에서 부른다 — 이 파일의 액션이 늘어도
 * 판정을 빠뜨릴 자리가 생기지 않게 이음매 쪽에 붙여 두었다.
 *
 * 성공/실패를 던지지 않고 돌려주는 이유: 서버 액션이 던지면 프로덕션 빌드에서
 * 메시지가 지워지고 클라이언트는 "An error occurred in the Server Components render"만
 * 받는다. 반려 실패는 사용자가 이유를 알아야 하는 실패다.
 */
export async function rejectSubmissionAction(
  kind: SubmissionKind,
  id: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await rejectSubmission(kind, id, reason);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '반려하지 못했습니다' };
  }

  revalidatePath('/admin/reports');
  return { ok: true };
}
