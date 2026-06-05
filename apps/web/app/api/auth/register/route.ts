import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, upsertUser, createSession } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    let user = await getUserByEmail(email);
    if (user) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = password
      ? crypto
          .createHash('sha256')
          .update(password + email)
          .digest('hex')
      : null;

    // upsertUser will insert
    user = await upsertUser(email, name);
    if (passwordHash && user) {
      const { query } = await import('@/lib/db');
      await query(`UPDATE "User" SET "passwordHash" = $1 WHERE id = $2`, [passwordHash, user.id]);
    }

    const token = await createSession(user!.id);
    return NextResponse.json({
      success: true,
      token,
      user: { id: user!.id, email: user!.email, name: user!.name },
    });
  } catch (err: any) {
    console.error('[register]', err.message);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
