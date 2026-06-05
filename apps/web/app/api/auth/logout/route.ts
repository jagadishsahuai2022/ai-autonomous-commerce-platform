import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/db';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
  if (token) await deleteSession(token);
  return NextResponse.json({ success: true });
}
