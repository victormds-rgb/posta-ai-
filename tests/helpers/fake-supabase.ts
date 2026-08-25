// Cliente Supabase fake, em memória — cobre só os métodos do query builder
// realmente usados no código (ver `grep` dos métodos em src/). Não tenta
// replicar o Postgrest inteiro, só o suficiente pra rodar as rotas de API
// contra dados fabricados, sem rede nem Postgres reais.

type Row = Record<string, unknown>
type Store = Record<string, Row[]>

function matches(row: Row, filters: ((r: Row) => boolean)[]) {
  return filters.every((f) => f(row))
}

export function createFakeSupabase(initial: Store = {}) {
  const store: Store = JSON.parse(JSON.stringify(initial))

  function from(table: string) {
    if (!store[table]) store[table] = []
    const filters: ((r: Row) => boolean)[] = []
    let orderCol: string | null = null
    let orderAsc = true
    let limitN: number | null = null
    let mode: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
    let payload: Row | Row[] | null = null
    let upsertConflictCols: string[] = []

    function finishSelectLike(result: Row[], kind: 'single' | 'maybeSingle' | 'list') {
      if (kind === 'single') {
        if (result.length !== 1) return { data: null, error: { message: `expected 1 row, got ${result.length}` } }
        return { data: result[0], error: null }
      }
      if (kind === 'maybeSingle') {
        if (result.length > 1) return { data: null, error: { message: `expected 0-1 rows, got ${result.length}` } }
        return { data: result[0] ?? null, error: null }
      }
      return { data: result, error: null, count: result.length }
    }

    function run(kind: 'single' | 'maybeSingle' | 'list') {
      if (mode === 'insert') {
        const rows = Array.isArray(payload) ? payload : [payload as Row]
        const inserted = rows.map((r) => ({
          id: r.id ?? crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...r,
        }))
        store[table].push(...inserted)
        return finishSelectLike(inserted, kind)
      }
      if (mode === 'upsert') {
        const rows = Array.isArray(payload) ? payload : [payload as Row]
        const result: Row[] = []
        for (const r of rows) {
          const existingIndex = store[table].findIndex((existing) =>
            upsertConflictCols.every((c) => existing[c] === r[c]),
          )
          if (existingIndex >= 0) {
            store[table][existingIndex] = { ...store[table][existingIndex], ...r }
            result.push(store[table][existingIndex])
          } else {
            const row = { id: r.id ?? crypto.randomUUID(), created_at: new Date().toISOString(), ...r }
            store[table].push(row)
            result.push(row)
          }
        }
        return finishSelectLike(result, kind)
      }
      if (mode === 'update') {
        const matched = store[table].filter((r) => matches(r, filters))
        matched.forEach((r) => Object.assign(r, payload))
        return finishSelectLike(matched, kind)
      }
      if (mode === 'delete') {
        const matched = store[table].filter((r) => matches(r, filters))
        store[table] = store[table].filter((r) => !matched.includes(r))
        return { data: null, error: null }
      }
      // select
      let result = store[table].filter((r) => matches(r, filters))
      if (orderCol) {
        const col = orderCol
        result = [...result].sort((a, b) => {
          const av = a[col] as string | number
          const bv = b[col] as string | number
          if (av === bv) return 0
          return (av > bv ? 1 : -1) * (orderAsc ? 1 : -1)
        })
      }
      if (limitN != null) result = result.slice(0, limitN)
      return finishSelectLike(result, kind)
    }

    const builder = {
      select() {
        return builder
      },
      insert(rows: Row | Row[]) {
        mode = 'insert'
        payload = rows
        return builder
      },
      update(row: Row) {
        mode = 'update'
        payload = row
        return builder
      },
      delete() {
        mode = 'delete'
        return builder
      },
      upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
        mode = 'upsert'
        payload = rows
        upsertConflictCols = opts?.onConflict?.split(',') ?? ['id']
        return builder
      },
      eq(col: string, val: unknown) {
        filters.push((r) => r[col] === val)
        return builder
      },
      neq(col: string, val: unknown) {
        filters.push((r) => r[col] !== val)
        return builder
      },
      in(col: string, vals: unknown[]) {
        filters.push((r) => vals.includes(r[col]))
        return builder
      },
      is(col: string, val: unknown) {
        filters.push((r) => (val === null ? r[col] == null : r[col] === val))
        return builder
      },
      gt(col: string, val: unknown) {
        filters.push((r) => (r[col] as string) > (val as string))
        return builder
      },
      gte(col: string, val: unknown) {
        filters.push((r) => (r[col] as string) >= (val as string))
        return builder
      },
      lt(col: string, val: unknown) {
        filters.push((r) => (r[col] as string) < (val as string))
        return builder
      },
      lte(col: string, val: unknown) {
        filters.push((r) => (r[col] as string) <= (val as string))
        return builder
      },
      order(col: string, opts?: { ascending?: boolean }) {
        orderCol = col
        orderAsc = opts?.ascending ?? true
        return builder
      },
      limit(n: number) {
        limitN = n
        return builder
      },
      single() {
        return Promise.resolve(run('single'))
      },
      maybeSingle() {
        return Promise.resolve(run('maybeSingle'))
      },
      // select(...).eq(...) sem .single()/.maybeSingle() é aguardado direto (thenable)
      then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        return Promise.resolve(run('list')).then(onFulfilled, onRejected)
      },
    }

    return builder
  }

  return {
    from,
    /** Acesso direto aos dados fabricados, pra montar fixtures ou inspecionar depois de uma rota rodar. */
    __store: store,
  }
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>
