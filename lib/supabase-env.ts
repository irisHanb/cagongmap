/**
 * Supabase 접속 정보 — 이 저장소에서 유일한 원본.
 *
 * 클라이언트가 셋(공개 조회 · 브라우저 세션 · 서버 세션)으로 갈라지면서
 * 같은 검사를 세 번 쓰게 됐다. 검사를 여기 하나로 모아 셋이 함께 실패하게 한다.
 */

// env가 없어도 로컬에서 바로 돌아가도록 기본값을 둔다.
const FALLBACK_URL = 'https://xyzcompanyprojectref.supabase.co';
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnlwcm9qZWN0cmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMDAwMDAsImV4cCI6MjA3MDU3NjAwMH0.QkFzZTY0RmFrZVNpZ25hdHVyZUZvclRlc3RpbmdPbmx5QUFB';

// 승인 스크립트에서 쓸 관리자 키. 나중에 시크릿으로 옮긴다.
export const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnlwcm9qZWN0cmVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTAwMDAwMCwiZXhwIjoyMDcwNTc2MDAwfQ.U2VydmljZVJvbGVGYWtlU2lnbmF0dXJlVGVzdE9ubHk';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? FALLBACK_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? FALLBACK_ANON_KEY;
