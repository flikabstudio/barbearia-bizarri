'use client'
// app/agendar/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient, getTenant, getServicos, getSlotsLivres, criarAgendamento, getUser, getAgendamentosCliente } from '@/lib/supabase'
import type { Tenant, Servico, Agendamento } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
const DIAS_LABEL  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function formatarData(data: string) {
  const [y, m, d] = data.split('-')
  return `${d}/${m}/${y}`
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function AgendarPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isGuest = searchParams.get('guest') === 'true'

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [servicos, setServicos] = useState<Servico[]>([])
  const [agendamentosCliente, setAgendamentosCliente] = useState<Agendamento[]>([])
  const [user, setUser] = useState<any>(null)

  // Seleções
  const [servicoSelecionado, setServicoSelecionado] = useState<Servico | null>(null)
  const [semanaOffset, setSemanaOffset] = useState(0)
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)
  const [slots, setSlots] = useState<{ horario: string; disponivel: boolean }[]>([])
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null)

  // Guest
  const [nomeGuest, setNomeGuest] = useState('')
  const [telefoneGuest, setTelefoneGuest] = useState('')

  // UX
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [loadingConfirm, setLoadingConfirm] = useState(false)
  const [etapa, setEtapa] = useState<'agendar' | 'confirmado' | 'meus-agendamentos'>('agendar')
  const [agendamentoFeito, setAgendamentoFeito] = useState<any>(null)
  const [aba, setAba] = useState<'agendar' | 'meus'>('agendar')

  const SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG || 'valtinho-bizarri'

  // Carrega dados iniciais
  useEffect(() => {
    async function init() {
      const [t, u] = await Promise.all([getTenant(SLUG), getUser()])
      setTenant(t)
      setUser(u)
      if (t) {
        const s = await getServicos(t.id)
        setServicos(s)
      }
      if (u) {
        const ag = await getAgendamentosCliente(u.id)
        setAgendamentosCliente(ag as Agendamento[])
      }
    }
    init()
  }, [])

  // Carrega slots ao selecionar dia + serviço
  useEffect(() => {
    if (!diaSelecionado || !servicoSelecionado || !tenant) return
    async function carregarSlots() {
      setLoadingSlots(true)
      setHorarioSelecionado(null)
      const s = await getSlotsLivres(tenant!.id, diaSelecionado!, servicoSelecionado!.duracao_min)
      setSlots(s)
      setLoadingSlots(false)
    }
    carregarSlots()
  }, [diaSelecionado, servicoSelecionado, tenant])

  // Gera dias da semana atual + offset
  function getDiasSemana() {
    const hoje = new Date()
    const inicio = new Date(hoje)
    inicio.setDate(hoje.getDate() - hoje.getDay() + semanaOffset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicio)
      d.setDate(inicio.getDate() + i)
      return d
    })
  }

  function isDiaFuncionamento(data: Date) {
    const dia = DIAS_SEMANA[data.getDay()]
    return tenant?.dias_funcionamento.includes(dia) ?? false
  }

  function isDiaPassado(data: Date) {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    return data < hoje
  }

  function formatarDataISO(data: Date) {
    return data.toISOString().split('T')[0]
  }

  async function confirmarAgendamento() {
    if (!tenant || !servicoSelecionado || !diaSelecionado || !horarioSelecionado) return
    if (isGuest && !nomeGuest) return

    setLoadingConfirm(true)
    const { data, error } = await criarAgendamento({
      tenant_id: tenant.id,
      cliente_id: user?.id,
      servico_id: servicoSelecionado.id,
      data: diaSelecionado,
      horario: horarioSelecionado,
      nome_cliente: user ? undefined : nomeGuest,
      telefone_cliente: user ? undefined : telefoneGuest,
    })

    setLoadingConfirm(false)
    if (!error && data) {
      setAgendamentoFeito({ ...data, servico: servicoSelecionado })
      setEtapa('confirmado')
    }
  }

  async function cancelarAgendamento(id: string) {
    const supabase = createClient()
    await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', id)
    if (user) {
      const ag = await getAgendamentosCliente(user.id)
      setAgendamentosCliente(ag as Agendamento[])
    }
  }

  const podeConfirmar = servicoSelecionado && diaSelecionado && horarioSelecionado && (!isGuest || nomeGuest)
  const dias = getDiasSemana()

  // ── TELA CONFIRMADO ────────────────────────────────────────────────────────
  if (etapa === 'confirmado' && agendamentoFeito) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm animate-fadeup text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ background: 'rgba(45,122,107,0.15)', border: '1px solid rgba(45,122,107,0.3)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="font-serif text-2xl font-bold mb-2">Agendado!</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Seu horário foi reservado com sucesso.
          </p>

          <div className="card text-left mb-6">
            <div className="flex flex-col gap-3">
              {[
                { label: 'Serviço', value: agendamentoFeito.servico?.nome },
                { label: 'Data', value: formatarData(agendamentoFeito.data) },
                { label: 'Horário', value: agendamentoFeito.horario?.slice(0, 5) },
                { label: 'Valor', value: formatarMoeda(agendamentoFeito.servico?.preco) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {tenant?.whatsapp && (
            <a href={`https://wa.me/${tenant.whatsapp}?text=Olá! Acabei de agendar um horário: ${agendamentoFeito.servico?.nome} em ${formatarData(agendamentoFeito.data)} às ${agendamentoFeito.horario?.slice(0,5)}`}
              target="_blank" rel="noopener noreferrer"
              className="block w-full py-3 rounded-xl text-sm font-semibold mb-3"
              style={{ background: '#25D366', color: 'white' }}>
              Confirmar pelo WhatsApp
            </a>
          )}

          <button onClick={() => { setEtapa('agendar'); setServicoSelecionado(null); setDiaSelecionado(null); setHorarioSelecionado(null) }}
            className="btn-outline w-full py-3 text-sm">
            Fazer outro agendamento
          </button>
        </div>
      </div>
    )
  }

  // ── TELA PRINCIPAL ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#0A0A0A' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="flex items-center gap-3">
          <span className="text-xl">💈</span>
          <div>
            <div className="text-sm font-semibold leading-tight" style={{ color: 'var(--gold)' }}>Valtinho Bizarri</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Ter–Sáb • 07:30–19:00</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <button onClick={() => setAba(aba === 'meus' ? 'agendar' : 'meus')}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid var(--border)', color: 'var(--gold)' }}>
              Meus agendamentos
            </button>
          ) : (
            <button onClick={() => router.push('/login')}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              Entrar
            </button>
          )}
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">

        {/* ABA: MEUS AGENDAMENTOS */}
        {aba === 'meus' && user && (
          <div className="animate-fadeup">
            <h2 className="font-serif text-xl font-bold mb-4">Meus agendamentos</h2>
            {agendamentosCliente.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Você não tem agendamentos ainda.</p>
                <button onClick={() => setAba('agendar')} className="btn-gold px-6 py-2 text-sm mt-4">Agendar agora</button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {agendamentosCliente.map(ag => (
                  <div key={ag.id} className="card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{(ag as any).servicos?.nome}</span>
                          <span className={`badge-status badge-${ag.status}`}>{ag.status}</span>
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {formatarData(ag.data)} às {ag.horario?.slice(0, 5)}
                          {' · '}{formatarMoeda((ag as any).servicos?.preco)}
                        </div>
                      </div>
                      {ag.status === 'pendente' || ag.status === 'confirmado' ? (
                        <button onClick={() => cancelarAgendamento(ag.id)}
                          className="text-xs px-3 py-1.5 rounded-lg"
                          style={{ color: '#E24B4A', border: '1px solid rgba(226,75,74,0.2)' }}>
                          Cancelar
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: AGENDAR */}
        {aba === 'agendar' && (
          <>
            {/* PASSO 1 – Serviço */}
            <section className="mb-6 animate-fadeup">
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                1 · Escolha o serviço
              </p>
              <div className="grid grid-cols-2 gap-2">
                {servicos.map(s => (
                  <button key={s.id}
                    onClick={() => { setServicoSelecionado(s); setHorarioSelecionado(null) }}
                    className="text-left rounded-xl p-4 transition-all"
                    style={{
                      background: servicoSelecionado?.id === s.id ? 'rgba(201,168,76,0.08)' : 'var(--dark2)',
                      border: `1px solid ${servicoSelecionado?.id === s.id ? 'var(--gold)' : 'rgba(201,168,76,0.1)'}`,
                    }}>
                    <div className="font-semibold text-sm mb-1">{s.nome}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: 'var(--gold)' }}>{formatarMoeda(s.preco)}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.duracao_min}min</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* PASSO 2 – Dia */}
            <section className="mb-6 animate-fadeup delay-1">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  2 · Escolha o dia
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSemanaOffset(o => Math.max(0, o - 1))}
                    disabled={semanaOffset === 0}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all"
                    style={{ background: 'var(--dark2)', border: '1px solid var(--border)', color: semanaOffset === 0 ? 'var(--text-muted)' : 'var(--text)', opacity: semanaOffset === 0 ? 0.4 : 1 }}>
                    ‹
                  </button>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {MESES[dias[0]?.getMonth()]}
                  </span>
                  <button onClick={() => setSemanaOffset(o => o + 1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all"
                    style={{ background: 'var(--dark2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    ›
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {dias.map((d, i) => {
                  const iso = formatarDataISO(d)
                  const disponivel = isDiaFuncionamento(d) && !isDiaPassado(d)
                  const selecionado = diaSelecionado === iso
                  return (
                    <button key={i} onClick={() => disponivel && setDiaSelecionado(iso)}
                      disabled={!disponivel}
                      className="flex flex-col items-center py-2.5 rounded-xl transition-all"
                      style={{
                        background: selecionado ? 'rgba(201,168,76,0.1)' : 'var(--dark2)',
                        border: `1px solid ${selecionado ? 'var(--gold)' : 'rgba(201,168,76,0.08)'}`,
                        opacity: disponivel ? 1 : 0.3,
                        cursor: disponivel ? 'pointer' : 'not-allowed',
                      }}>
                      <span className="text-xs mb-1" style={{ color: selecionado ? 'var(--gold)' : 'var(--text-muted)' }}>
                        {DIAS_LABEL[d.getDay()]}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: selecionado ? 'var(--gold)' : 'var(--text)' }}>
                        {d.getDate()}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* PASSO 3 – Horário */}
            {diaSelecionado && servicoSelecionado && (
              <section className="mb-6 animate-fadeup delay-2">
                <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                  3 · Escolha o horário
                </p>
                {loadingSlots ? (
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: 'var(--dark2)' }} />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map(({ horario, disponivel }) => (
                      <button key={horario}
                        onClick={() => disponivel && setHorarioSelecionado(horario)}
                        disabled={!disponivel}
                        className="py-2.5 rounded-xl text-sm font-medium transition-all"
                        style={{
                          background: horarioSelecionado === horario ? 'rgba(201,168,76,0.1)' : 'var(--dark2)',
                          border: `1px solid ${horarioSelecionado === horario ? 'var(--gold)' : 'rgba(201,168,76,0.08)'}`,
                          color: !disponivel ? 'var(--text-muted)' : horarioSelecionado === horario ? 'var(--gold)' : 'var(--text)',
                          opacity: disponivel ? 1 : 0.35,
                          cursor: disponivel ? 'pointer' : 'not-allowed',
                          textDecoration: !disponivel ? 'line-through' : 'none',
                        }}>
                        {horario}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* PASSO 4 – Dados do guest */}
            {isGuest && horarioSelecionado && (
              <section className="mb-6 animate-fadeup">
                <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                  4 · Seus dados
                </p>
                <div className="flex flex-col gap-3">
                  <input className="input-dark" type="text" placeholder="Seu nome *"
                    value={nomeGuest} onChange={e => setNomeGuest(e.target.value)} />
                  <input className="input-dark" type="tel" placeholder="WhatsApp (opcional)"
                    value={telefoneGuest} onChange={e => setTelefoneGuest(e.target.value)} />
                </div>
              </section>
            )}

            {/* Resumo + Confirmar */}
            {servicoSelecionado && diaSelecionado && horarioSelecionado && (
              <section className="animate-fadeup delay-3">
                <div className="card mb-4">
                  <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Resumo</p>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: 'Serviço', value: servicoSelecionado.nome },
                      { label: 'Data', value: formatarData(diaSelecionado) },
                      { label: 'Horário', value: horarioSelecionado },
                      { label: 'Duração', value: `${servicoSelecionado.duracao_min} min` },
                      { label: 'Valor', value: formatarMoeda(servicoSelecionado.preco) },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={confirmarAgendamento} disabled={!podeConfirmar || loadingConfirm}
                  className="btn-gold w-full py-4 text-sm">
                  {loadingConfirm ? 'Confirmando...' : 'Confirmar agendamento'}
                </button>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
