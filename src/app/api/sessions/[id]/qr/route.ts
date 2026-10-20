import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateQRCodeDataURL, getAttendanceUrl } from '@/lib/qrcode';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const s = await prisma.session.findFirst({
    where: { id: params.id, course: { professorId: session.user.id } },
  });
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // The QR MUST point to a URL phones can reach. We always prefer APP_URL
  // (the LAN / public address set in .env) — the request's Host header is
  // ignored unless APP_URL is unset, because the professor may browse the
  // dashboard via `localhost` on their own laptop while the students' phones
  // are on the same Wi-Fi and need the LAN IP to reach the server.
  //
  // If the dashboard was loaded from `localhost`, we tell the UI about it so
  // it can show a "you're on localhost" warning.
  const hostHeader = req.headers.get('host') ?? '';
  const requestOrigin = hostHeader ? `${req.headers.get('x-forwarded-proto') ?? 'http'}://${hostHeader}` : '';
  const requestIsLocal = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin);

  const url = getAttendanceUrl(s.token, requestOrigin);
  const qr = await generateQRCodeDataURL(url);

  return NextResponse.json({
    qr,
    url,
    token: s.token,
    scannedFrom: requestOrigin || null,
    scannedFromLocalhost: requestIsLocal,
    baseUrl: url.split('/attend/')[0],
    tip: requestIsLocal
      ? `You opened the dashboard from localhost. The QR code uses: ${url.split('/attend/')[0]} so phones on the same Wi-Fi can connect.`
      : undefined,
  });
}
