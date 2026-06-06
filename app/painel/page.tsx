'use client'
// app/painel/page.tsx

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  createClient, getTenant, getServicos,
  getAgendamentosBarbeiro, atualizarStatusAgendamento,
  getUser, getProfile
} from '@/lib/supabase'
import type { Tenant, Servico, Agendamento } from '@/types'

const DIAS_SEMANA = ['dom','seg','ter','qua','qui','sex','sab']
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function formatarData(data: string) {
  const [y, m, d] = data.split('-')
  return `${d}/${m}/${y}`
}
function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function hoje() {
  return new Date().toISOString().split('T')[0]
}

const STATUS_OPCOES = ['pendente','confirmado','concluido','cancelado'] as const

export default function PainelPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [servicos, setServicos] = useState<Servico[]>([])
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [dataSelecionada, setDataSelecionada] = useState(hoje())
  const [aba, setAba] = useState<'agenda' | 'bloqueios' | 'servicos'>('agenda')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  // Bloqueio de horário
  const [novoBloqueio, setNovoBloqueio] = useState({ data: hoje(), horario_inicio: '', horario_fim: '', motivo: '', dia_inteiro: false })
  const [savingBloqueio, setSavingBloqueio] = useState(false)
  const [bloqueios, setBloqueios] = useState<any[]>([])

  // Novo serviço
  const [novoServico, setNovoServico] = useState({ nome: '', preco: '', duracao_min: '30' })
  const [savingServico, setSavingServico] = useState(false)

  const SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG || 'valtinho-bizarri'

  useEffect(() => {
    async function init() {
      const u = await getUser()
      if (!u) { router.push('/login'); return }
      const profile = await getProfile(u.id)
      if (!profile || !['admin','barbeiro','superadmin'].includes(profile.role)) {
        router.push('/agendar'); return
      }
      setUser(u)
      const t = await getTenant(SLUG)
      setTenant(t)
      if (t) {
        const [s, ag] = await Promise.all([
          getServicos(t.id),
          getAgendamentosBarbeiro(t.id, dataSelecionada)
        ])
        setServicos(s)
        setAgendamentos(ag as Agendamento[])
        await carregarBloqueios(t.id, dataSelecionada)
      }
      setLoading(false)
    }
    init()
  }, [])

  async function recarregarAgendamentos(data?: string) {
    if (!tenant) return
    const ag = await getAgendamentosBarbeiro(tenant.id, data || dataSelecionada)
    setAgendamentos(ag as Agendamento[])
  }

  async function carregarBloqueios(tenantId: string, data: string) {
    const supabase = createClient()
    const { data: bl } = await supabase
      .from('horarios_bloqueados')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('data', data)
      .order('data').order('horario_inicio')
    setBloqueios(bl || [])
  }

  async function mudarData(novaData: string) {
    setDataSelecionada(novaData)
    if (tenant) {
      const ag = await getAgendamentosBarbeiro(tenant.id, novaData)
      setAgendamentos(ag as Agendamento[])
      await carregarBloqueios(tenant.id, novaData)
    }
  }

  async function mudarStatus(id: string, status: string) {
    await atualizarStatusAgendamento(id, status)
    await recarregarAgendamentos()
  }

  async function salvarBloqueio() {
    if (!tenant || !novoBloqueio.data) return
    setSavingBloqueio(true)
    const supabase = createClient()
    await supabase.from('horarios_bloqueados').insert([{
      tenant_id: tenant.id,
      ...novoBloqueio,
      horario_inicio: novoBloqueio.dia_inteiro ? null : novoBloqueio.horario_inicio || null,
      horario_fim: novoBloqueio.dia_inteiro ? null : novoBloqueio.horario_fim || null,
    }])
    await carregarBloqueios(tenant.id, dataSelecionada)
    setNovoBloqueio({ data: hoje(), horario_inicio: '', horario_fim: '', motivo: '', dia_inteiro: false })
    setSavingBloqueio(false)
  }

  async function removerBloqueio(id: string) {
    const supabase = createClient()
    await supabase.from('horarios_bloqueados').delete().eq('id', id)
    if (tenant) await carregarBloqueios(tenant.id, dataSelecionada)
  }

  async function salvarServico() {
    if (!tenant || !novoServico.nome || !novoServico.preco) return
    setSavingServico(true)
    const supabase = createClient()
    await supabase.from('servicos').insert([{
      tenant_id: tenant.id,
      nome: novoServico.nome,
      preco: parseFloat(novoServico.preco),
      duracao_min: parseInt(novoServico.duracao_min),
      ordem: servicos.length + 1,
    }])
    const s = await getServicos(tenant.id)
    setServicos(s)
    setNovoServico({ nome: '', preco: '', duracao_min: '30' })
    setSavingServico(false)
  }

  async function toggleServico(id: string, ativo: boolean) {
    const supabase = createClient()
    await supabase.from('servicos').update({ ativo: !ativo }).eq('id', id)
    if (tenant) { const s = await getServicos(tenant.id); setServicos(s) }
  }

  // Métricas do dia
  const agendadosHoje = agendamentos.filter(a => a.status !== 'cancelado')
  const receitaHoje = agendadosHoje.reduce((sum, a) => sum + ((a as any).servicos?.preco || 0), 0)
  const concluidos = agendamentos.filter(a => a.status === 'concluido').length

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin-slow" style={{ borderColor: 'rgba(201,168,76,0.3)', borderTopColor: 'var(--gold)' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#0A0A0A' }}>
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between"
        style={{ background: '#111', borderBottom: '1px solid rgba(201,168,76,0.12)' }}>
        <div>
          <div className="font-serif font-bold" style={{ color: 'var(--gold)' }}>Painel do Barbeiro</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Barbearia Valtinho Bizarri</div>
        </div>
        <button onClick={async () => { const s = createClient(); await s.auth.signOut(); router.push('/login') }}
          className="text-xs px-3 py-1.5 rounded-lg btn-outline">
          Sair
        </button>
      </header>

      {/* Abas */}
      <div className="flex border-b" style={{ borderColor: 'rgba(201,168,76,0.1)', background: '#111' }}>
        {[
          { key: 'agenda', label: 'Agenda' },
          { key: 'bloqueios', label: 'Bloqueios' },
          { key: 'servicos', label: 'Serviços' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setAba(key as any)}
            className="px-5 py-3 text-sm font-medium transition-all"
            style={{
              color: aba === key ? 'var(--gold)' : 'var(--text-muted)',
              borderBottom: aba === key ? '2px solid var(--gold)' : '2px solid transparent',
            }}>
            {label}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* ── ABA AGENDA ── */}
        {aba === 'agenda' && (
          <div className="animate-fadeup">
            {/* Seletor de data */}
            <div className="flex items-center gap-3 mb-5">
              <input type="date" value={dataSelecionada}
                onChange={e => mudarData(e.target.value)}
                className="input-dark text-sm"
                style={{ width: 'auto' }} />
              <button onClick={() => mudarData(hoje())}
                className="text-xs px-3 py-2 rounded-lg btn-outline">
                Hoje
              </button>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { num: agendadosHoje.length, label: 'agendados' },
                { num: concluidos, label: 'concluídos' },
                { num: formatarMoeda(receitaHoje), label: 'receita' },
              ].map(({ num, label }) => (
                <div key={label} className="card text-center py-3">
                  <div className="font-serif text-xl font-bold" style={{ color: 'var(--gold)' }}>{num}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Lista de agendamentos */}
            {agendamentos.length === 0 ? (
              <div className="card text-center py-10">
                <p style={{ color: 'var(--text-muted)' }}>Nenhum agendamento para este dia.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {agendamentos.map(ag => (
                  <div key={ag.id} className="card">
                    <div className="flex items-start gap-4">
                      <div className="text-lg font-bold font-serif min-w-[52px]" style={{ color: 'var(--gold)' }}>
                        {ag.horario?.slice(0, 5)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm">
                            {ag.nome_cliente || (ag as any).profiles?.nome || 'Cliente'}
                          </span>
                          <span className={`badge-status badge-${ag.status}`}>{ag.status}</span>
                        </div>
                        <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                          {(ag as any).servicos?.nome} · {formatarMoeda((ag as any).servicos?.preco)} · {(ag as any).servicos?.duracao_min}min
                        </div>
                        {ag.telefone_cliente && (
                          <a href={`https://wa.me/${ag.telefone_cliente.replace(/\D/g,'')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs" style={{ color: '#25D366' }}>
                            WhatsApp: {ag.telefone_cliente}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Ações de status */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {STATUS_OPCOES.filter(s => s !== ag.status).map(s => (
                        <button key={s} onClick={() => mudarStatus(ag.id, s)}
                          className="text-xs px-3 py-1.5 rounded-lg transition-all"
                          style={{
                            border: '1px solid rgba(201,168,76,0.15)',
                            color: s === 'cancelado' ? '#E24B4A' : s === 'concluido' ? '#5DCAA5' : 'var(--text-muted)',
                          }}>
                          → {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ABA BLOQUEIOS ── */}
        {aba === 'bloqueios' && (
          <div className="animate-fadeup">
            <h2 className="font-serif text-lg font-bold mb-4">Bloquear horários</h2>

            <div className="card mb-5">
              <p className="text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Novo bloqueio</p>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Data</label>
                    <input type="date" className="input-dark text-sm"
                      value={novoBloqueio.data} onChange={e => setNovoBloqueio(b => ({ ...b, data: e.target.value }))} />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={novoBloqueio.dia_inteiro}
                        onChange={e => setNovoBloqueio(b => ({ ...b, dia_inteiro: e.target.checked }))}
                        className="w-4 h-4" />
                      <span className="text-sm">Dia inteiro</span>
                    </label>
                  </div>
                </div>

                {!novoBloqueio.dia_inteiro && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Início</label>
                      <input type="time" className="input-dark text-sm"
                        value={novoBloqueio.horario_inicio} onChange={e => setNovoBloqueio(b => ({ ...b, horario_inicio: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Fim</label>
                      <input type="time" className="input-dark text-sm"
                        value={novoBloqueio.horario_fim} onChange={e => setNovoBloqueio(b => ({ ...b, horario_fim: e.target.value }))} />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Motivo (opcional)</label>
                  <input type="text" className="input-dark text-sm" placeholder="Ex: almoço, feriado..."
                    value={novoBloqueio.motivo} onChange={e => setNovoBloqueio(b => ({ ...b, motivo: e.target.value }))} />
                </div>

                <button onClick={salvarBloqueio} disabled={savingBloqueio} className="btn-gold py-2.5 text-sm">
                  {savingBloqueio ? 'Salvando...' : 'Bloquear horário'}
                </button>
              </div>
            </div>

            {/* Lista de bloqueios */}
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Próximos bloqueios</h3>
            {bloqueios.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum bloqueio cadastrado.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {bloqueios.map(b => (
                  <div key={b.id} className="card flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{formatarData(b.data)}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {b.dia_inteiro ? 'Dia inteiro' : `${b.horario_inicio?.slice(0,5)} – ${b.horario_fim?.slice(0,5)}`}
                        {b.motivo && ` · ${b.motivo}`}
                      </div>
                    </div>
                    <button onClick={() => removerBloqueio(b.id)}
                      className="text-xs px-3 py-1.5 rounded-lg"
                      style={{ color: '#E24B4A', border: '1px solid rgba(226,75,74,0.2)' }}>
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ABA SERVIÇOS ── */}
        {aba === 'servicos' && (
          <div className="animate-fadeup">
            <h2 className="font-serif text-lg font-bold mb-4">Gerenciar serviços</h2>

            {/* Novo serviço */}
            <div className="card mb-5">
              <p className="text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Novo serviço</p>
              <div className="flex flex-col gap-3">
                <input type="text" className="input-dark text-sm" placeholder="Nome do serviço"
                  value={novoServico.nome} onChange={e => setNovoServico(s => ({ ...s, nome: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Preço (R$)</label>
                    <input type="number" className="input-dark text-sm" placeholder="0,00"
                      value={novoServico.preco} onChange={e => setNovoServico(s => ({ ...s, preco: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Duração (min)</label>
                    <input type="number" className="input-dark text-sm" placeholder="30"
                      value={novoServico.duracao_min} onChange={e => setNovoServico(s => ({ ...s, duracao_min: e.target.value }))} />
                  </div>
                </div>
                <button onClick={salvarServico} disabled={savingServico} className="btn-gold py-2.5 text-sm">
                  {savingServico ? 'Salvando...' : 'Adicionar serviço'}
                </button>
              </div>
            </div>

            {/* Lista de serviços */}
            <div className="flex flex-col gap-2">
              {servicos.map(s => (
                <div key={s.id} className="card flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{s.nome}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {formatarMoeda(s.preco)} · {s.duracao_min}min
                    </div>
                  </div>
                  <button onClick={() => toggleServico(s.id, s.ativo)}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{
                      background: s.ativo ? 'rgba(45,122,107,0.1)' : 'rgba(150,140,120,0.1)',
                      border: `1px solid ${s.ativo ? 'rgba(45,122,107,0.2)' : 'rgba(150,140,120,0.15)'}`,
                      color: s.ativo ? '#5DCAA5' : 'var(--text-muted)',
                    }}>
                    {s.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
