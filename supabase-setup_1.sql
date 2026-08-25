-- ==========================================================
-- Configuração do banco de dados no Supabase
-- Cole tudo isso no SQL Editor do Supabase e clique em "Run"
-- ==========================================================

-- Tabela de vestidos do acervo
create table dresses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  occasion text not null,        -- festa | casamento | formatura | coquetel
  color text not null default '#C9A66B',  -- cor usada na ilustração de reserva (fallback sem foto)
  image_url text,                -- link da foto no Supabase Storage (preenchido pela loja, sem código)
  price numeric not null,
  size text not null,
  created_at timestamp with time zone default now()
);

-- Tabela de reservas: cada linha bloqueia um vestido num intervalo de datas
create table bookings (
  id uuid primary key default gen_random_uuid(),
  dress_id uuid references dresses(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  customer_name text,
  customer_phone text,
  payment_id text,               -- id do pagamento no Mercado Pago
  status text not null default 'pendente',  -- pendente | confirmada | cancelada
  created_at timestamp with time zone default now()
);

-- Segurança: ativa Row Level Security nas duas tabelas.
-- Isso significa que, por padrão, NINGUÉM consegue ler ou escrever
-- até criarmos uma regra explícita liberando.
alter table dresses enable row level security;
alter table bookings enable row level security;

-- Libera leitura pública (o site precisa ler o catálogo e as reservas
-- para montar o calendário). Isso NÃO libera escrita — só quem tem
-- acesso ao painel do Supabase consegue adicionar/editar/apagar.
create policy "Leitura pública dos vestidos" on dresses
  for select using (true);

create policy "Leitura pública das reservas" on bookings
  for select using (true);

-- ==========================================================
-- Dados de exemplo (os mesmos 6 vestidos que já estavam no site).
-- Pode editar, apagar ou adicionar novos direto pelo Table Editor
-- depois que rodar isso uma vez. A coluna image_url começa vazia —
-- o site usa a ilustração como reserva até a foto ser adicionada.
-- ==========================================================
insert into dresses (name, occasion, color, price, size) values
  ('Vestido Aurora', 'festa', '#E3B7B0', 120, 'P ao M'),
  ('Vestido Meia-noite', 'casamento', '#241016', 180, 'M ao G'),
  ('Vestido Jasmim', 'formatura', '#8B9A7C', 140, 'PP ao M'),
  ('Vestido Terracota', 'coquetel', '#B5674A', 110, 'P ao GG'),
  ('Vestido Ipê', 'festa', '#C9A66B', 130, 'M ao G'),
  ('Vestido Noite Azul', 'casamento', '#2E3A59', 170, 'P ao M');

-- Exemplos de reserva (ajuste as datas e o dress_id depois de ver os IDs
-- gerados na tabela "dresses" pelo Table Editor).
-- insert into bookings (dress_id, start_date, end_date, customer_name)
-- values ('COLE-O-ID-DO-VESTIDO-AQUI', '2026-09-10', '2026-09-13', 'Marina T.');

-- Nota sobre o campo "status": o site trata como "ocupado" no calendário
-- qualquer reserva com status "pendente" ou "confirmada" (só ignora
-- "cancelada"). Isso evita que duas pessoas reservem o mesmo vestido
-- enquanto um pagamento ainda está sendo processado.

-- ==========================================================
-- FOTOS DOS VESTIDOS (sem precisar de código)
-- ==========================================================
-- 1. No painel do Supabase, vá em "Storage" (menu lateral) e crie um bucket
--    novo chamado "fotos-vestidos", marcado como PÚBLICO.
-- 2. Rode o comando abaixo (uma única vez) para liberar a leitura pública
--    dos arquivos desse bucket:
insert into storage.buckets (id, name, public)
values ('fotos-vestidos', 'fotos-vestidos', true)
on conflict (id) do nothing;

-- 3. Depois disso, a dona da loja só precisa:
--    a) abrir Storage > fotos-vestidos > arrastar a foto do vestido
--    b) clicar na foto enviada > "Copy URL"
--    c) abrir Table Editor > dresses > colar o link na coluna image_url
--       da linha do vestido correspondente
--    Nenhum desses passos exige abrir código.
