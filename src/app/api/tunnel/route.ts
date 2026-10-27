import { NextRequest, NextResponse } from 'next/server';
import { getTunnelUrl, setMemoryTunnelUrl, ensureCloudflareTunnel, waitForTunnelUrl } from '@/lib/qrcode';

export const dynamic = 'force-dynamic';

export async function GET() {
  let tunnel = getTunnelUrl();

  // If tunnel is not active yet, proactively start it and wait briefly (runtime only, never during build/CI)
  if (
    !tunnel &&
    process.env.NODE_ENV !== 'test' &&
    !process.env.CI &&
    !process.env.GITHUB_ACTIONS &&
    !process.env.NEXT_PHASE?.includes('build')
  ) {
    ensureCloudflareTunnel();
    tunnel = await waitForTunnelUrl(2500);
  }

  const isWorldwide = Boolean(tunnel && tunnel.includes('trycloudflare.com'));

  return NextResponse.json({
    tunnelUrl: tunnel || null,
    bestUrl: tunnel || null,
    isWorldwide,
    connecting: !isWorldwide,
    mode: isWorldwide ? 'worldwide' : 'connecting',
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?.url && typeof body.url === 'string' && body.url.startsWith('http')) {
      setMemoryTunnelUrl(body.url.trim());
      return NextResponse.json({ success: true, url: body.url.trim() });
    }
    if (body?.url === null || body?.url === '') {
      setMemoryTunnelUrl(null);
      return NextResponse.json({ success: true, url: null });
    }
    return NextResponse.json({ error: 'Missing or invalid url string' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
