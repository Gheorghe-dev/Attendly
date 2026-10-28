import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  const filename = decodeURIComponent(params.filename || '');
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return new NextResponse('Invalid filename', { status: 400 });
  }

  const candidateDirs = [
    '/var/www/downloads',
    path.join(process.cwd(), 'release'),
    path.join(process.cwd(), 'downloads'),
    process.cwd(),
  ];

  let targetFile: string | null = null;
  for (const dir of candidateDirs) {
    const testPath = path.join(dir, filename);
    if (fs.existsSync(testPath)) {
      try {
        const stat = fs.statSync(testPath);
        if (stat.isFile()) {
          targetFile = testPath;
          break;
        }
      } catch {}
    }
  }

  if (!targetFile) {
    return new NextResponse('Installer file not found', { status: 404 });
  }

  const stat = fs.statSync(targetFile);
  const stream = fs.createReadStream(targetFile);

  // Return streamed response
  // @ts-expect-error - ReadableStream type compatibility with Node ReadStream in Next.js
  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': stat.size.toString(),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
