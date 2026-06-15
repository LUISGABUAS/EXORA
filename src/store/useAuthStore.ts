import { create } from 'zustand';
import { Platform } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from '../lib/supabase';
import { clearAllUserData } from '../utils/clearUserData';
import { pullFromSupabase } from '../services/syncService';

// Lazy-load Apple Auth — iOS only, crashes on Android if imported unconditionally
const getAppleAuth = () =>
  Platform.OS === 'ios'
    ? require('@invertase/react-native-apple-authentication').appleAuth
    : null;

interface AuthState {
  session: Session | null;
  loading: boolean;
  initialize: () => Promise<void>;
  signInWithGoogle: () => Promise<string | null>;
  signInWithApple: () => Promise<string | null>;
  signInWithPhone: (phone: string) => Promise<string | null>;
  verifyOtp: (phone: string, code: string) => Promise<string | null>;
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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ session, loading: false });
    } catch {
      set({ session: null, loading: false });
    }

    supabase.auth.onAuthStateChange((_event, newSession) => {
      set({ session: newSession });
      // Al recibir una sesión nueva (login), jalar datos de la nube
      if (newSession?.user?.id) {
        pullFromSupabase().catch(() => {});
      }
    });
  },

  signInWithGoogle: async () => {
    try {
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signIn();
      let idToken: string | null = null;
      try {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens?.idToken ?? null;
      } catch {
        // signIn() resolved but no session exists — user cancelled
        return null;
      }
      if (!idToken) return null;
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      return error ? error.message : null;
    } catch (err: any) {
      if (
        err?.code === statusCodes.SIGN_IN_CANCELLED ||
        err?.code === '12501' ||
        err?.message?.toLowerCase().includes('cancel')
      ) return null;
      return err?.message ?? 'Error al iniciar sesión con Google.';
    }
  },

  signInWithApple: async () => {
    const appleAuth = getAppleAuth();
    if (!appleAuth) return 'Apple Sign-In solo está disponible en iOS.';
    try {
      const appleAuthRequest = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });
      const { identityToken } = appleAuthRequest;
      if (!identityToken) return 'No se obtuvo el token de Apple.';
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
      });
      return error ? error.message : null;
    } catch (err: any) {
      if (err?.code === '1001') return null; // user cancelled
      return err?.message ?? 'Error al iniciar sesión con Apple.';
    }
  },

  signInWithPhone: async (phone) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    return error ? error.message : null;
  },

  verifyOtp: async (phone, code) => {
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
    return error ? error.message : null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    await clearAllUserData();
    set({ session: null });
  },
}));