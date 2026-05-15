import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://oxefxfwwwrdypjnbnzdy.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZWZ4Znd3d3JkeXBqbmJuemR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjI2MzYsImV4cCI6MjA5MDQ5ODYzNn0.g3raLrkTnk9ZraNX5IVhrJ25HotfNuSuME7nAWtvT2c';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener('change', state => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

export async function updateProfile(
  userId: string,
  data: {
    rfc?: string;
    full_name?: string;
    is_adult?: boolean;
    razon_social?: string;
    fiscal_regime?: string;
    constancia_uploaded?: boolean;
  },
) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...data, updated_at: new Date().toISOString() });
  return error ? error.message : null;
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return { data, error: error?.message ?? null };
}
