import { create } from 'zustand';
import { Platform } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from '../lib/supabase';
import { clearAllUserData } from '../utils/clearUserData';

// Nombre capturado de Apple en el primer sign-in (disponible antes de que updateUser complete)
export let pendingAppleName = '';

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
  deleteAccount: () => Promise<string | null>;
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

    // Registrar listener SIEMPRE antes de cualquier return temprano
    supabase.auth.onAuthStateChange((_event, newSession) => {
      set({ session: newSession });
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        set({ session: null, loading: false });
        return;
      }

      // Si el token es válido por al menos 5 minutos más, abrir la app inmediatamente
      // y refrescar en background para no bloquear el arranque sin internet
      const expiresAt = (session.expires_at ?? 0) * 1000;
      if (expiresAt > Date.now() + 5 * 60 * 1000) {
        set({ session, loading: false });
        supabase.auth.refreshSession()
          .then(({ data }) => { if (data.session) set({ session: data.session }); })
          .catch(() => {});
        return;
      }

      // Token expirado o a punto de expirar — necesita red para refrescar
      const { data: refreshed, error } = await supabase.auth.refreshSession();
      if (error || !refreshed.session) {
        await supabase.auth.signOut();
        set({ session: null, loading: false });
        return;
      }
      set({ session: refreshed.session, loading: false });
    } catch {
      set({ session: null, loading: false });
    }
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
      const rawNonce = Array.from({length: 32}, () =>
        Math.floor(Math.random() * 36).toString(36)).join('');
      const appleAuthRequest = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
        nonce: rawNonce,
      });
      const { identityToken, fullName } = appleAuthRequest;
      if (!identityToken) return 'No se obtuvo el token de Apple.';
      // Guardar nombre ANTES del sign-in para que OnboardingScreen lo lea al instante
      const displayName = [fullName?.givenName, fullName?.familyName]
        .filter(Boolean)
        .join(' ');
      pendingAppleName = displayName;
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
        nonce: rawNonce,
      });
      if (error) return error.message;
      if (displayName) {
        supabase.auth.updateUser({ data: { full_name: displayName } }).catch(() => {});
      }
      return null;
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

  deleteAccount: async () => {
    try {
      const { error } = await supabase.rpc('delete_user_account');
      if (error) return error.message;
      await supabase.auth.signOut();
      await clearAllUserData();
      set({ session: null });
      return null;
    } catch (err: any) {
      return err?.message ?? 'Error al eliminar la cuenta.';
    }
  },
}));