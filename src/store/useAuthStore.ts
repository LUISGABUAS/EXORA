import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  initialize: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUpWithEmail: (email: string, password: string) => Promise<string | null>;
  signInWithPhone: (phone: string) => Promise<string | null>;
  verifyOtp: (phone: string, code: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  loading: true,

  initialize: async () => {
    GoogleSignin.configure({
      webClientId: '477633387004-3ggdouudj4r8dmucrub5amltdvbbg28b.apps.googleusercontent.com',
      iosClientId: '477633387004-ko4n5u2uonbndkaetpp91geib16g38m2.apps.googleusercontent.com',
      offlineAccess: true,
      forceCodeForRefreshToken: true,
    });

    const {
      data: { session },
    } = await supabase.auth.getSession();
    set({ session, loading: false });

    supabase.auth.onAuthStateChange((_event, newSession) => {
      set({ session: newSession });
    });
  },

  signInWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  },

  signUpWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? error.message : null;
  },

  signInWithPhone: async (phone) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    return error ? error.message : null;
  },

  verifyOtp: async (phone, code) => {
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
    return error ? error.message : null;
  },

  signInWithGoogle: async () => {
    try {
      await GoogleSignin.hasPlayServices();

      // Inicia sesión con Google
      await GoogleSignin.signIn();

      // Obtiene idToken
      const { idToken } = await GoogleSignin.getTokens();

      if (!idToken) return 'No se obtuvo el token de Google.';

      // Envía token a Supabase
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      return error ? error.message : null;
    } catch (err: any) {
      return err?.message ?? 'Error al iniciar sesión con Google.';
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null });
  },
}));