-- Fila de escritas para o Firebird (outbox) — usada quando o Firebird está fora
-- do ar no momento da operação. Reprocessada pela Edge Function
-- `firebird-outbox-worker`.
--
-- Aplicar via: supabase (SQL editor) ou migration.

create table if not exists public.firebird_outbox (
  id          uuid primary key default gen_random_uuid(),
  op          text not null check (op in ('POST','PUT','DELETE')),
  fb_table    text not null,
  fb_id       text,                 -- PK unida por "~" (para PUT/DELETE)
  payload     jsonb,                -- corpo (para POST/PUT)
  status      text not null default 'pending' check (status in ('pending','done','error')),
  attempts    int  not null default 0,
  motivo      text,                 -- por que caiu na fila
  last_error  text,                 -- último erro ao reprocessar
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_firebird_outbox_pending
  on public.firebird_outbox (created_at)
  where status = 'pending';

alter table public.firebird_outbox enable row level security;

-- Usuários autenticados podem enfileirar e acompanhar; service_role (worker) faz tudo.
drop policy if exists firebird_outbox_auth_ins on public.firebird_outbox;
create policy firebird_outbox_auth_ins on public.firebird_outbox
  for insert to authenticated with check (true);

drop policy if exists firebird_outbox_auth_sel on public.firebird_outbox;
create policy firebird_outbox_auth_sel on public.firebird_outbox
  for select to authenticated using (true);

-- gatilho updated_at
create or replace function public.tg_firebird_outbox_updated()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_firebird_outbox_updated on public.firebird_outbox;
create trigger trg_firebird_outbox_updated before update on public.firebird_outbox
  for each row execute function public.tg_firebird_outbox_updated();
