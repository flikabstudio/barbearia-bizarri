// lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'

// Cliente para uso no browser (componentes client-side)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Helpers de autenticação
export async function getSession() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
}

// Helpers de dados
export async function getTenant(slug: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .single()
  return data
}

export async function getServicos(tenantId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('servicos')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('ativo', true)
    .order('ordem')
  return data || []
}

export async function getSlotsLivres(tenantId: string, data: string, duracaoMin: number) {
  const supabase = createClient()

  // Busca tenant para pegar horários de funcionamento
  const { data: tenant } = await supabase
    .from('tenants')
    .select('horario_abertura, horario_fechamento, intervalo_min')
    .eq('id', tenantId)
    .single()

  if (!tenant) return []

  // Busca agendamentos do dia
  const { data: agendamentos } = await supabase
    .from('agendamentos')
    .select('horario')
    .eq('tenant_id', tenantId)
    .eq('data', data)
    .neq('status', 'cancelado')

  // Busca horários bloqueados do dia
  const { data: bloqueados } = await supabase
    .from('horarios_bloqueados')
    .select('horario_inicio, horario_fim, dia_inteiro')
    .eq('tenant_id', tenantId)
    .eq('data', data)

  const ocupados = new Set(agendamentos?.map(a => a.horario.slice(0, 5)) || [])

  // Gera slots do dia
  const slots = []
  const [hAb, mAb] = tenant.horario_abertura.split(':').map(Number)
  const [hFe, mFe] = tenant.horario_fechamento.split(':').map(Number)
  const intervalo = tenant.intervalo_min || 30

  let minAtual = hAb * 60 + mAb
  const minFim = hFe * 60 + mFe

  while (minAtual + duracaoMin <= minFim) {
    const h = Math.floor(minAtual / 60).toString().padStart(2, '0')
    const m = (minAtual % 60).toString().padStart(2, '0')
    const horario = `${h}:${m}`

    // Verifica se está bloqueado
    const estaBloqueado = bloqueados?.some(b => {
      if (b.dia_inteiro) return true
      if (!b.horario_inicio || !b.horario_fim) return false
      return horario >= b.horario_inicio.slice(0, 5) && horario < b.horario_fim.slice(0, 5)
    }) || false

    slots.push({
      horario,
      disponivel: !ocupados.has(horario) && !estaBloqueado,
    })

    minAtual += intervalo
  }

  return slots
}

export async function criarAgendamento(dados: {
  tenant_id: string
  cliente_id?: string
  servico_id: string
  data: string
  horario: string
  nome_cliente?: string
  telefone_cliente?: string
  observacao?: string
}) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('agendamentos')
    .insert([{ ...dados, status: 'pendente' }])
    .select()
    .single()
  return { data, error }
}

export async function getAgendamentosCliente(clienteId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('agendamentos')
    .select('*, servicos(*)')
    .eq('cliente_id', clienteId)
    .order('data', { ascending: false })
    .order('horario', { ascending: false })
  return data || []
}

export async function getAgendamentosBarbeiro(tenantId: string, data?: string) {
  const supabase = createClient()
  let query = supabase
    .from('agendamentos')
    .select('*, servicos(*), profiles(*)')
    .eq('tenant_id', tenantId)
    .neq('status', 'cancelado')

  if (data) query = query.eq('data', data)

  const { data: result } = await query
    .order('data')
    .order('horario')

  return result || []
}

export async function atualizarStatusAgendamento(id: string, status: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('agendamentos')
    .update({ status })
    .eq('id', id)
  return { error }
}

export async function getProfile(userId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}
