'use client'
// app/login/page.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [modo, setModo] = useState<'login' | 'cadastro'>('login')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSucesso('')
    setLoading(true)

    try {
      if (modo === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (error) throw error
        router.push('/agendar')
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { data: { nome, telefone } },
        })
        if (error) throw error
        setSucesso('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
      }
    } catch (err: any) {
      const msgs: Record<string, string> = {
        'Invalid login credentials': 'E-mail ou senha incorretos.',
        'User already registered': 'Este e-mail já está cadastrado.',
        'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
      }
      setErro(msgs[err.message] || 'Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 70%), #0A0A0A' }}>

      {/* Logo */}
      <div className="w-full max-w-sm animate-fadeup">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}>
            <span className="text-2xl">💈</span>
          </div>
          <h1 className="font-serif text-2xl font-bold" style={{ color: 'var(--gold)' }}>
            Valtinho Bizarri
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Barbearia</p>
        </div>

        {/* Card */}
        <div className="card">
          {/* Tabs */}
          <div className="flex rounded-lg p-1 mb-6" style={{ background: 'var(--dark3)' }}>
            {(['login', 'cadastro'] as const).map(m => (
              <button key={m} onClick={() => setModo(m)}
                className="flex-1 py-2 rounded-md text-sm font-medium transition-all"
                style={modo === m
                  ? { background: 'var(--gold)', color: '#0A0A0A' }
                  : { color: 'var(--text-muted)' }}>
                {m === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {modo === 'cadastro' && (
              <>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Nome completo</label>
                  <input className="input-dark" type="text" placeholder="Seu nome"
                    value={nome} onChange={e => setNome(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>WhatsApp</label>
                  <input className="input-dark" type="tel" placeholder="(11) 99999-9999"
                    value={telefone} onChange={e => setTelefone(e.target.value)} />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>E-mail</label>
              <input className="input-dark" type="email" placeholder="seu@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Senha</label>
              <input className="input-dark" type="password" placeholder="••••••••"
                value={senha} onChange={e => setSenha(e.target.value)} required />
            </div>

            {erro && (
              <div className="rounded-lg px-4 py-3 text-sm"
                style={{ background: 'rgba(226,75,74,0.08)', border: '1px solid rgba(226,75,74,0.2)', color: '#E24B4A' }}>
                {erro}
              </div>
            )}

            {sucesso && (
              <div className="rounded-lg px-4 py-3 text-sm"
                style={{ background: 'rgba(45,122,107,0.08)', border: '1px solid rgba(45,122,107,0.2)', color: '#5DCAA5' }}>
                {sucesso}
              </div>
            )}

            <button type="submit" className="btn-gold py-3 text-sm mt-2" disabled={loading}>
              {loading ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          {/* Agendar sem login */}
          <div className="mt-4 text-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ou</p>
            <button onClick={() => router.push('/agendar?guest=true')}
              className="mt-2 text-sm underline underline-offset-2"
              style={{ color: 'var(--text-muted)' }}>
              Agendar sem criar conta
            </button>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          Terça a sábado • 07:30 – 19:00
        </p>
      </div>
    </div>
  )
}
