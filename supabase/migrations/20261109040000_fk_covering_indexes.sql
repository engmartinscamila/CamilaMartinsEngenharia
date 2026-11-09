-- Índices para as chaves estrangeiras sem índice apontadas pelo advisor de performance.
-- Cria apenas o que falta (idempotente); não remove nada.
do $mig$
declare r record; v_name text;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conrelid as relid, c.conkey,
           (select string_agg(quote_ident(a.attname), ',' order by k.o)
              from unnest(c.conkey) with ordinality k(n, o)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n) as cols,
           (select string_agg(a.attname, '_' order by k.o)
              from unnest(c.conkey) with ordinality k(n, o)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n) as colnames,
           cl.relname
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
     where c.contype = 'f' and n.nspname = 'public'
       and not exists (
         select 1 from pg_index i
          where i.indrelid = c.conrelid
            and (select array_agg(x order by o) from unnest(i.indkey::int2[]) with ordinality u(x, o)
                  where o <= cardinality(c.conkey)) = c.conkey)
  loop
    v_name := left('idx_' || r.relname || '_' || r.colnames, 63);
    execute format('create index if not exists %I on %s (%s)', v_name, r.tbl, r.cols);
    raise notice 'índice criado: %', v_name;
  end loop;
end
$mig$;
