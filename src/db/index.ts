import { Pool, type QueryResultRow } from 'pg';

/**
 * Arc talks to Postgres over a direct connection as the table owner, which
 * bypasses Row Level Security. Every table has RLS enabled with no policies, so
 * the PostgREST endpoint that Supabase exposes with the anon key returns
 * nothing — the app keeps full access, the public API surface stays shut.
 *
 * Use the **pooler** connection string from Supabase (Project Settings →
 * Database → Connection string → Transaction pooler). It presents a publicly
 * trusted certificate, so TLS verifies normally, and it survives serverless
 * environments that would otherwise exhaust the direct connection limit.
 */

const g = globalThis as unknown as { __arcPool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and paste the ' +
        'Supabase pooler connection string into it.',
    );
  }

  const local = /localhost|127\.0\.0\.1/.test(connectionString);

  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Verify the certificate. If this ever fails against Supabase you are
    // probably on the direct (db.<ref>.supabase.co) host rather than the
    // pooler — switch the URL rather than turning verification off.
    ssl: local ? false : { rejectUnauthorized: true },
  });
}

export function getPool(): Pool {
  // Cached across hot reloads in dev, so a saved file doesn't leak connections.
  if (!g.__arcPool) g.__arcPool = createPool();
  return g.__arcPool;
}

/**
 * Supabase's direct host (db.<ref>.supabase.co) presents a self-signed
 * certificate, so TLS verification fails against it by design. Rather than
 * turning verification off, say which string to use instead.
 */
function explain(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (/self[- ]signed certificate/i.test(msg)) {
    throw new Error(
      'Postgres rejected the TLS certificate. DATABASE_URL is pointing at the ' +
        'direct Supabase host (db.<ref>.supabase.co), which serves a self-signed ' +
        'certificate. Use the Transaction pooler string instead — Supabase → ' +
        'Project Settings → Database → Connection string → Transaction pooler. ' +
        'The host looks like aws-0-<region>.pooler.supabase.com on port 6543.',
      { cause: err },
    );
  }
  if (/password authentication failed/i.test(msg)) {
    throw new Error(
      'Postgres rejected the password in DATABASE_URL. Reset it at Supabase → ' +
        'Project Settings → Database → Reset database password, then paste the ' +
        'new one into the connection string.',
      { cause: err },
    );
  }
  throw err;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  try {
    const { rows } = await getPool().query<T>(text, params);
    return rows;
  } catch (err) {
    explain(err);
  }
}

/** Run several statements atomically. */
export async function transaction<T>(fn: (run: typeof query) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const run = async <R extends QueryResultRow>(text: string, params: unknown[] = []) =>
      (await client.query<R>(text, params)).rows;
    const out = await fn(run as typeof query);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
