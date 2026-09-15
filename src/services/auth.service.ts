/**
 * FINTRACK - AUTH SERVICE
 * Username + password authentication backed entirely by Supabase Auth (JWT + RLS).
 * No credentials are ever stored on the client.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  role?: string;
  createdAt: string;
}

const STORAGE_SESSION_KEY = 'fintrack_current_user';
const MIN_PASSWORD_LENGTH = 8;
const MIN_USERNAME_LENGTH = 3;

export class AuthService {
  // Cached non-sensitive profile of the signed-in user (UI convenience only).
  public static getCurrentUser(): UserProfile | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(STORAGE_SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error('Error al recuperar sesión:', e);
      return null;
    }
  }

  public static isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  /**
   * Usuario derivado de la SESIÓN real de Supabase (fuente de verdad), no del
   * localStorage. Necesario porque en una PWA instalada (contenedor aislado en iOS)
   * la cookie de sesión puede existir sin que el perfil esté en localStorage, lo que
   * antes provocaba un loop de redirección /→/login→/. Rehidrata y cachea el perfil.
   * Si Supabase no responde (offline), cae al perfil cacheado.
   */
  public static async getSessionUser(): Promise<UserProfile | null> {
    if (typeof window === 'undefined') return null;
    if (!supabase || !isSupabaseConfigured) return this.getCurrentUser();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const sUser = session?.user;
      if (!sUser) return null;

      const cached = this.getCurrentUser();
      if (cached && cached.id === sUser.id) return cached;

      let username = sUser.email ? sUser.email.split('@')[0] : 'usuario';
      let fullName = username.charAt(0).toUpperCase() + username.slice(1);
      try {
        const { data: profData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sUser.id)
          .single();
        if (profData) {
          username = profData.username || username;
          fullName = profData.full_name || fullName;
        }
      } catch {
        // sin perfil en BD: usar los valores derivados del email
      }

      const profile: UserProfile = {
        id: sUser.id,
        username,
        fullName,
        role: 'Propietario',
        createdAt: sUser.created_at || new Date().toISOString()
      };
      this.persistSession(profile);
      return profile;
    } catch {
      // Error de red: usar el perfil cacheado si existe (no desloguear por estar offline).
      return this.getCurrentUser();
    }
  }

  // The Supabase browser client owns the auth session cookies; here we only
  // cache the non-sensitive profile for synchronous UI reads.
  private static persistSession(profile: UserProfile) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(profile));
  }

  // Map an app username to the synthetic email used by Supabase Auth.
  private static emailFor(username: string): string {
    return `${username}@fintrack.app`;
  }

  public static async login(usernameInput: string, passwordInput: string): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
    const cleanUsername = usernameInput.trim().toLowerCase();

    if (!cleanUsername || !passwordInput) {
      return { success: false, error: 'Por favor, ingresa tu usuario y contraseña.' };
    }
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'El servicio de autenticación no está disponible en este momento.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: this.emailFor(cleanUsername),
        password: passwordInput
      });

      if (error || !data.user || !data.session) {
        return { success: false, error: 'Usuario o contraseña incorrectos. Verifica e intenta de nuevo.' };
      }

      const { data: profData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      const profile: UserProfile = {
        id: data.user.id,
        username: profData?.username || cleanUsername,
        fullName: profData?.full_name || cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1),
        role: 'Propietario',
        createdAt: data.user.created_at || new Date().toISOString()
      };

      this.persistSession(profile);
      return { success: true, user: profile };
    } catch (err) {
      console.warn('Supabase Auth login error:', err);
      return { success: false, error: 'No se pudo conectar con el servicio. Revisa tu conexión e intenta de nuevo.' };
    }
  }

  public static async register(usernameInput: string, passwordInput: string, fullNameInput?: string): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
    const cleanUsername = usernameInput.trim().toLowerCase();

    if (!cleanUsername) {
      return { success: false, error: 'Ingresa un nombre de usuario.' };
    }
    if (cleanUsername.length < MIN_USERNAME_LENGTH) {
      return { success: false, error: `El nombre de usuario debe tener al menos ${MIN_USERNAME_LENGTH} caracteres.` };
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      return { success: false, error: 'El usuario solo puede contener letras, números, guiones y puntos.' };
    }
    if (!passwordInput || passwordInput.length < MIN_PASSWORD_LENGTH) {
      return { success: false, error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` };
    }
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'El servicio de registro no está disponible en este momento.' };
    }

    const finalFullName = fullNameInput?.trim() || cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: this.emailFor(cleanUsername),
        password: passwordInput,
        options: { data: { username: cleanUsername, full_name: finalFullName } }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          return { success: false, error: `El usuario "${cleanUsername}" ya existe en el sistema. Inicia sesión.` };
        }
        return { success: false, error: 'No se pudo crear la cuenta. Intenta nuevamente.' };
      }
      if (!data.user) {
        return { success: false, error: 'No se pudo crear la cuenta. Intenta nuevamente.' };
      }

      await supabase.from('profiles').upsert({
        id: data.user.id,
        username: cleanUsername,
        full_name: finalFullName
      });

      const profile: UserProfile = {
        id: data.user.id,
        username: cleanUsername,
        fullName: finalFullName,
        role: 'Propietario',
        createdAt: data.user.created_at || new Date().toISOString()
      };

      this.persistSession(profile);
      return { success: true, user: profile };
    } catch (err) {
      console.warn('Supabase Auth signUp error:', err);
      return { success: false, error: 'No se pudo conectar con el servicio. Revisa tu conexión e intenta de nuevo.' };
    }
  }

  public static async logout(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    } catch (e) {
      console.warn('Error al limpiar sesión local en logout:', e);
    }

    if (supabase && isSupabaseConfigured) {
      try {
        // Cap the network call so navigation is never blocked.
        await Promise.race([
          supabase.auth.signOut(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 800))
        ]);
      } catch (e) {
        // Ignore timeout or network failure; local state is already cleared.
      }
    }
  }
}
