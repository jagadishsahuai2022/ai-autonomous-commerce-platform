import { NextRequest, NextResponse } from 'next/server';
import {
  validateSession,
  getUserByEmail,
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from '@/lib/db';
import { DEMO_USERS } from '@/lib/admin-auth';

// Fast lookup for demo users
const DEMO_BY_EMAIL = Object.fromEntries(DEMO_USERS.map(u => [u.email.toLowerCase(), u]));

function getToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
}

/** Resolve authenticated user — tries DB session, DB email, then DEMO_USERS fallback */
async function resolveUser(req: NextRequest) {
  const token = getToken(req);
  const email = (req.headers.get('x-user-email') || '').toLowerCase();

  // 1. DB session token
  if (token) {
    try {
      const session = await validateSession(token);
      if (session) return session;
    } catch { /* DB unavailable */ }
  }

  // 2. DB getUserByEmail
  if (email) {
    try {
      const user = await getUserByEmail(email);
      if (user) return { userId: (user as any).id, email: (user as any).email, name: (user as any).name };
    } catch { /* DB unavailable */ }

    // 3. DEMO_USERS fallback when DB is unreachable
    const isDemoToken = !token || token.startsWith('admin-') || token.startsWith('demo-');
    const demoUser = DEMO_BY_EMAIL[email];
    if (demoUser && isDemoToken) {
      return {
        userId: `demo-${demoUser.email.split('@')[0]}`,
        email: demoUser.email,
        name: demoUser.displayName,
        _isDemo: true,
      };
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await resolveUser(req) as any;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Demo mode: no DB addresses — return empty list gracefully
    if (session._isDemo) return NextResponse.json({ addresses: [] });

    const addresses = await getUserAddresses(session.userId);
    return NextResponse.json({ addresses });
  } catch (err: any) {
    console.error('[addresses GET]', err.message);
    return NextResponse.json({ addresses: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await resolveUser(req) as any;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Demo mode: simulate success without touching DB
    if (session._isDemo) {
      const body = await req.json();
      return NextResponse.json({ address: { id: Date.now(), ...body, userId: session.userId } }, { status: 201 });
    }

    const body = await req.json();
    if (!body.name || !body.line1 || !body.city || !body.state || !body.pincode) {
      return NextResponse.json(
        { error: 'Missing required fields: name, line1, city, state, pincode' },
        { status: 400 }
      );
    }

    // Validate field formats
    if (!/^\d{6}$/.test(body.pincode)) {
      return NextResponse.json({ error: 'Pincode must be exactly 6 digits' }, { status: 400 });
    }
    if (body.phone) {
      const cleanPhone = body.phone.replace(/[\s+\-]/g, '').replace(/^0+/, '');
      // Strip Indian country code (91) if present — e.g. "+91 9876543210" becomes "9876543210"
      const normalizedPhone =
        cleanPhone.length === 12 && cleanPhone.startsWith('91')
          ? cleanPhone.slice(2)
          : cleanPhone.length === 13 && cleanPhone.startsWith('091')
            ? cleanPhone.slice(3)
            : cleanPhone;
      if (!/^\d{10}$/.test(normalizedPhone)) {
        return NextResponse.json({ error: 'Phone number must be 10 digits' }, { status: 400 });
      }
      body.phone = normalizedPhone;
    }
    if (
      body.name.length > 100 ||
      body.line1.length > 200 ||
      body.city.length > 50 ||
      body.state.length > 50
    ) {
      return NextResponse.json({ error: 'Field length exceeds maximum allowed' }, { status: 400 });
    }

    const address = await createAddress(session.userId, {
      name: body.name,
      phone: body.phone,
      line1: body.line1,
      line2: body.line2,
      city: body.city,
      state: body.state,
      pincode: body.pincode,
      isDefault: body.isDefault,
    });
    return NextResponse.json({ address }, { status: 201 });
  } catch (err: any) {
    console.error('[addresses POST]', err.message);
    return NextResponse.json({ error: 'Failed to save address' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await resolveUser(req) as any;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Demo mode: simulate update success
    if (session._isDemo) {
      const body = await req.json();
      return NextResponse.json({ address: { ...body, userId: session.userId } });
    }

    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'Address ID required' }, { status: 400 });

    const address = await updateAddress(body.id, session.userId, body);
    if (!address)
      return NextResponse.json({ error: 'Address not found or no changes' }, { status: 404 });
    return NextResponse.json({ address });
  } catch (err: any) {
    console.error('[addresses PUT]', err.message);
    return NextResponse.json({ error: 'Failed to update address' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await resolveUser(req) as any;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Demo mode: simulate delete success
    if (session._isDemo) return NextResponse.json({ success: true });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Address ID required' }, { status: 400 });

    await deleteAddress(parseInt(id, 10), session.userId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[addresses DELETE]', err.message);
    return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 });
  }
}
