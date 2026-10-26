import { NextRequest, NextResponse } from 'next/server';
import { getTunnelUrl, getLocalIpAddress, setMemoryTunnelUrl } from '@/lib/qrcode';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tunnel = getTunnelUrl();
  const lanIp = getLocalIpAddress();
  const port = process.env.PORT || '3000';
  const lanUrl = lanIp ? `http://${lanIp}:${port}` : null;
  const localUrl = `http://localhost:${port}`;
  const bestUrl = tunnel || lanUrl || localUrl;

  return NextResponse.json({
    tunnelUrl: tunnel,
    lanUrl,
    localUrl,
    bestUrl,
    isWorldwide: Boolean(tunnel),
    mode: tunnel ? 'worldwide' : lanUrl ? 'lan' : 'local',
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?.url && typeof body.url === 'string' && body.url.startsWith('http')) {
      setMemoryTunnelUrl(body.url.trim());
      return NextResponse.json({ success: true, url: body.url.trim() });
    }
    return NextResponse.json({ error: 'Missing or invalid url string' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
