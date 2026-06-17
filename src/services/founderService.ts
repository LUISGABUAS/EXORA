import { supabase } from '../lib/supabase';

export type RedeemResult = 'success' | 'already_used' | 'invalid' | 'error';

export async function redeemFounderCodeInSupabase(
  code: string,
): Promise<RedeemResult> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 'error';

    // Verify code exists and is unredeemed
    const { data: row, error: fetchError } = await supabase
      .from('founder_codes')
      .select('code, redeemed_by')
      .eq('code', code)
      .single();

    if (fetchError || !row) return 'invalid';
    if (row.redeemed_by !== null) return 'already_used';

    // Claim the code
    const { error: updateError } = await supabase
      .from('founder_codes')
      .update({
        redeemed_by: user.id,
        redeemed_at: new Date().toISOString(),
      })
      .eq('code', code)
      .is('redeemed_by', null); // prevent race condition

    if (updateError) return 'already_used';

    // Mark user as founder in profiles
    await supabase
      .from('profiles')
      .update({ is_founder: true })
      .eq('id', user.id);

    return 'success';
  } catch {
    return 'error';
  }
}

export async function checkIsFounderInSupabase(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from('profiles')
      .select('is_founder')
      .eq('id', user.id)
      .single();
    return data?.is_founder === true;
  } catch {
    return false;
  }
}
