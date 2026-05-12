import { NextRequest, NextResponse } from 'next/server'

const COOKIE = 'sefaz_auth'
const LOGIN_PATH = '/login'
const API_AUTH_PATH = '/api/auth'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Deixa passar: página de login e API de autenticação
  if (pathname === LOGIN_PATH || pathname.startsWith(API_AUTH_PATH)) {
    return NextResponse.next()
  }

  // Verifica cookie de sessão
  const auth = req.cookies.get(COOKIE)?.value
  if (auth === process.env.APP_PASSWORD) {
    return NextResponse.next()
  }

  // Não autenticado — redireciona para login
  const url = req.nextUrl.clone()
  url.pathname = LOGIN_PATH
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo_ma.png).*)'],
}
