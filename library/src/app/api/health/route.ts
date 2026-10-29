import { NextResponse } from 'next/server';
import { getSql } from '@/db';

export const dynamic = 'force-dynamic';

/** 200 when the app and its database answer; 503 with the reason otherwise (monitoring reads it). */
export async function GET() {
  try {
    await getSql()`select 1`;
    return NextResponse.json({ ok: true, db: true, time: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, db: false, error: (e as Error).message.split('\n')[0] }, { status: 503 });
  }
}
