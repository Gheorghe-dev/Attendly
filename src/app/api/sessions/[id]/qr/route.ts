import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateQRCodeDataURL, getAttendanceUrl, waitForTunnelUrl, isPrivateOrLocalUrl } from '@/lib/qrcode';
import { slugifyClassroom } from '@/lib/classroom';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const s = await prisma.session.findFirst({
    where: { id: params.id, course: { professorId: session.user.id } },
  });
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // If a tunnel URL is still handshaking, wait briefly (up to 1.5s) to get the worldwide link
  await waitForTunnelUrl(1500);

  const hostHeader = req.headers.get('host') ?? '';
  const requestOrigin = hostHeader ? `${req.headers.get('x-forwarded-proto') ?? 'http'}://${hostHeader}` : '';
  const requestIsLocal = isPrivateOrLocalUrl(requestOrigin);

  const classroomIdentifier = s.classroom ? slugifyClassroom(s.classroom) : s.token;
  const url = getAttendanceUrl(classroomIdentifier, requestOrigin);
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
      : `QR code uses: ${url.split('/attend/')[0]} (waiting for worldwide connection).`,
  });
}
