export function formatSupabaseError(error, fallback) {
  if (!error || typeof error !== 'object') return fallback;
  const parts = [];
  if (error.code) parts.push(`code=${error.code}`);
  if (error.message) parts.push(`message=${error.message}`);
  if (error.details) parts.push(`details=${error.details}`);
  if (error.hint) parts.push(`hint=${error.hint}`);
  return parts.length ? `${fallback} (${parts.join(' | ')})` : fallback;
}

export function logSupabaseError(scope, error) {
  if (process.env.NODE_ENV === 'production') return;
  if (!error || typeof error !== 'object') {
    console.error(`[${scope}]`, error);
    return;
  }
  console.error(`[${scope}] Supabase/PostgREST error`, {
    code: error.code ?? null,
    message: error.message ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  });
}

export function isMissingTableError(error, tableName) {
  return error?.code === 'PGRST205' && String(error.message ?? '').includes(`'public.${tableName}'`);
}

export function isMissingColumnError(error, columnName) {
  return error?.code === '42703' && String(error.message ?? '').includes(columnName);
}
