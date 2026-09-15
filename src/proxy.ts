import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files, API routes, Next internals y los assets públicos de la PWA
  // (ícono, apple-icon, manifest). Estos los pide el navegador/SO sin sesión, así que
  // NO deben pasar por la verificación de auth ni redirigir a /login.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico' ||
    pathname === '/icon' ||
    pathname === '/apple-icon' ||
    pathname === '/manifest.webmanifest'
  ) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without Supabase configured there is no session to verify; let requests through.
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('tu-proyecto')) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  // Validates the JWT against Supabase Auth and refreshes it when needed.
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  if (pathname === '/login') {
    return isAuthenticated ? NextResponse.redirect(new URL('/', request.url)) : response;
  }

  if (!isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest).*)']
};
