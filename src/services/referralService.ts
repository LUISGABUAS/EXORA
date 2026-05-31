import { supabase } from '../lib/supabase';

function generateCode(userId: string): string {
  const base = userId.replace(/-/g, '').toUpperCase().slice(0, 6);
  return `EXP-${base}`;
}

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', userId)
    .single();

  if (data?.referral_code) return data.referral_code;

  const code = generateCode(userId);
  await supabase
    .from('profiles')
    .update({ referral_code: code })
    .eq('id', userId);

  return code;
}

export type ApplyReferralResult =
  | { ok: true }
  | { ok: false; error: 'invalid_code' | 'own_code' | 'already_used' | 'not_authenticated' | 'unknown' };

export async function applyReferralCode(code: string): Promise<ApplyReferralResult> {
  const { data, error } = await supabase.rpc('apply_referral', {
    p_code: code.trim().toUpperCase(),
  });

  if (error) return { ok: false, error: 'unknown' };
  if (data?.ok) return { ok: true };
  return { ok: false, error: data?.error ?? 'unknown' };
}

export async function getTrialEndsAt(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('trial_ends_at')
    .eq('id', userId)
    .single();

  return data?.trial_ends_at ?? null;
}

export const REFERRAL_ERROR_MESSAGES: Record<string, string> = {
  invalid_code: 'El código no existe. Verifica que esté bien escrito.',
  own_code: 'No puedes usar tu propio código.',
  already_used: 'Ya usaste un código de referido anteriormente.',
  not_authenticated: 'Debes iniciar sesión para usar un código.',
  unknown: 'Ocurrió un error. Intenta de nuevo.',
};
