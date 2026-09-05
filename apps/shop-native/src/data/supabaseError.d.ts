export type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export function formatSupabaseError(error: unknown, fallback: string): string;
export function logSupabaseError(scope: string, error: unknown): void;
export function isMissingTableError(error: SupabaseLikeError | null | undefined, tableName: string): boolean;
export function isMissingColumnError(error: SupabaseLikeError | null | undefined, columnName: string): boolean;
