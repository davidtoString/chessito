import { env } from 'chessito-env';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const database = env.DB;
    if (!database) throw new Error('Database unavailable');
    await database.prepare('SELECT 1 AS ready').first();
    return new Response('ok', { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return new Response('unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
