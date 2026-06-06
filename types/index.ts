// types/index.ts

export interface Tenant {
  id: string
  slug: string
  nome: string
  telefone?: string
  endereco?: string
  descricao?: string
  logo_url?: string
  cor_primaria: string
  cor_secundaria: string
  horario_abertura: string
  horario_fechamento: string
  intervalo_min: number
  dias_funcionamento: string[]
  whatsapp?: string
  ativo: boolean
}

export interface Servico {
  id: string
  tenant_id: string
  nome: string
  descricao?: string
  preco: number
  duracao_min: number
  ativo: boolean
  ordem: number
}

export interface Profile {
  id: string
  tenant_id?: string
  nome?: string
  telefone?: string
  role: 'superadmin' | 'admin' | 'barbeiro' | 'cliente'
}

export interface Agendamento {
  id: string
  tenant_id: string
  cliente_id?: string
  servico_id: string
  data: string
  horario: string
  status: 'pendente' | 'confirmado' | 'cancelado' | 'concluido'
  observacao?: string
  nome_cliente?: string
  telefone_cliente?: string
  created_at: string
  servicos?: Servico
  profiles?: Profile
}

export interface SlotDisponivel {
  horario: string
  disponivel: boolean
}
