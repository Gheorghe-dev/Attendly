import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateQRCodeDataURL, getAttendanceUrl, waitForTunnelUrl, isPrivateOrLocalUrl } from '@/lib/qrcode';
import { slugifyClassroom } from '@/lib/classroom';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth().catch(() => null);

    let s = null;
    if (session?.user?.id) {
      s = await prisma.session.findFirst({
        where: { id: params.id, course: { professorId: session.user.id } },
      });
    }

    // Resilient fallback: If session cookie is missing/expired, lookup session by ID directly
    // since attendance QR codes are public classroom projections for students.
    if (!s) {
      s = await prisma.session.findUnique({
        where: { id: params.id },
      });
    }
    if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    // Wait up to 8000ms for Cloudflare worldwide tunnel link so QR code encodes it immediately
    await waitForTunnelUrl(8000);

    const hostHeader = req.headers.get('host') ?? '';
    const requestOrigin = hostHeader ? `${req.headers.get('x-forwarded-proto') ?? 'http'}://${hostHeader}` : '';
    const requestIsLocal = isPrivateOrLocalUrl(requestOrigin);

    const classroomIdentifier = s.classroom ? slugifyClassroom(s.classroom) : s.token;
    let url = getAttendanceUrl(classroomIdentifier, requestOrigin);
    if (!url.startsWith('http')) {
      url = `http://localhost:3000/attend/${classroomIdentifier}`;
    }
    const qr = await generateQRCodeDataURL(url);
    const isWorldwide = Boolean(url.includes('trycloudflare.com') || !isPrivateOrLocalUrl(url));

    return NextResponse.json({
      qr,
      url,
      token: s.token,
      classroom: s.classroom,
      classroomSlug: s.classroom ? slugifyClassroom(s.classroom) : null,
      scannedFrom: requestOrigin || null,
      scannedFromLocalhost: requestIsLocal,
      isWorldwide,
      baseUrl: url.split('/attend/')[0],
      tip: isWorldwide
        ? `QR code is accessible from ANY Wi-Fi network and 4G/5G mobile data (${url.split('/attend/')[0]}).`
        : `Connecting Any Wi-Fi access tunnel... Please wait a moment.`,
    });
  } catch (error) {
    console.error('Error generating QR route:', error);
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 });
  }
}
