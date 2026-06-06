# Barbearia Valtinho Bizarri — Sistema de Agendamento

Sistema MicroSaaS completo de agendamento para barbearia, construído com Next.js + Supabase.

---

## Estrutura do projeto

```
barbearia-app/
├── app/
│   ├── layout.tsx          ← Layout raiz (fontes, metadados)
│   ├── globals.css         ← Estilos globais e variáveis CSS
│   ├── page.tsx            ← Redireciona para /agendar
│   ├── login/
│   │   └── page.tsx        ← Login e cadastro do cliente
│   ├── agendar/
│   │   └── page.tsx        ← Sistema de agendamento (cliente)
│   └── painel/
│       └── page.tsx        ← Painel do barbeiro (protegido)
├── lib/
│   └── supabase.ts         ← Todos os helpers do Supabase
├── types/
│   └── index.ts            ← Tipos TypeScript
├── .env.example            ← Modelo de variáveis de ambiente
├── package.json
├── next.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## Instalação

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env.local
# Edite .env.local com suas credenciais do Supabase
```

### 3. Rodar em desenvolvimento
```bash
npm run dev
# Acesse http://localhost:3000
```

### 4. Build para produção
```bash
npm run build
npm start
```

---

## Funcionalidades

### Área do cliente (/agendar)
- Escolha de serviço com preço e duração
- Calendário semanal com dias de funcionamento
- Grade de horários em tempo real (respeita agendamentos e bloqueios)
- Agendamento com ou sem login (modo guest)
- Confirmação com link direto para WhatsApp
- Histórico de agendamentos com opção de cancelar

### Login e cadastro (/login)
- Autenticação por e-mail e senha via Supabase Auth
- Cadastro com nome e telefone
- Opção de agendar sem criar conta

### Painel do barbeiro (/painel)
- Acesso restrito por role (admin/barbeiro)
- Agenda do dia com métricas (total, concluídos, receita)
- Navegação por data com seletor
- Mudança de status dos agendamentos (pendente → confirmado → concluído)
- Link direto para WhatsApp do cliente
- Bloqueio de horários por dia/período (folgas, almoço, feriados)
- Gerenciamento de serviços (adicionar, ativar/desativar)

---

## URLs

| Rota | Descrição | Acesso |
|------|-----------|--------|
| `/` | Redireciona para /agendar | Público |
| `/agendar` | Sistema de agendamento | Público |
| `/login` | Login e cadastro | Público |
| `/painel` | Painel do barbeiro | Admin/Barbeiro |

---

## Variáveis de ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=https://XXXXXXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_TENANT_SLUG=valtinho-bizarri
```

---

## Deploy na Vercel

1. Faça push do projeto para um repositório GitHub
2. Acesse vercel.com → "Add New Project"
3. Conecte o repositório
4. Adicione as 3 variáveis de ambiente
5. Clique em Deploy

---

## Tornar um usuário barbeiro/admin

Após o usuário criar a conta no sistema, execute no SQL Editor do Supabase:

```sql
UPDATE profiles
SET
  role = 'admin',
  tenant_id = (SELECT id FROM tenants WHERE slug = 'valtinho-bizarri')
WHERE id = 'UUID_DO_USUARIO';
-- Encontre o UUID em: Supabase → Authentication → Users
```

---

## Para adicionar uma segunda barbearia (multi-tenant)

```sql
INSERT INTO tenants (slug, nome, cor_primaria, cor_secundaria, horario_abertura, horario_fechamento, dias_funcionamento)
VALUES ('nova-barbearia', 'Barbearia Nova', '#1A3A6B', '#C9A84C', '08:00', '18:00', ARRAY['seg','ter','qua','qui','sex']);
```

E crie um segundo deploy na Vercel com `NEXT_PUBLIC_TENANT_SLUG=nova-barbearia`.
