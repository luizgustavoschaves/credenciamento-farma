import { NextRequest, NextResponse } from 'next/server'

const COOKIE = 'sefaz_auth'
// Cookie dura 8 horas (em segundos)
const MAX_AGE = 60 * 60 * 8

export async function POST(req: NextRequest) {
  const { senha } = await req.json()

  if (!process.env.APP_PASSWORD) {
    return NextResponse.json({ erro: 'APP_PASSWORD não configurada no servidor.' }, { status: 500 })
  }

  if (senha !== process.env.APP_PASSWORD) {
    return NextResponse.json({ erro: 'Senha incorreta.' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, process.env.APP_PASSWORD, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('sefaz_auth')
  return res
}
