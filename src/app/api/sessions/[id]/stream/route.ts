import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseGroups } from '@/lib/groups';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();
  let intervalId: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      async function sendUpdate() {
        try {
          const s = await prisma.session.findFirst({
            where: {
              id: params.id,
              course: { professorId: session!.user!.id },
            },
            include: {
              course: true,
              attendance: {
                where: { status: 'verified' },
                include: { student: true },
                orderBy: { verifiedAt: 'desc' },
              },
            },
          });

          if (!s) return;

          const targetGroups = parseGroups(s.groups);
          const studentFilter: { courseId: string; group?: { in: string[] } } = {
            courseId: s.courseId,
          };
          if (targetGroups.length > 0) {
            studentFilter.group = { in: targetGroups };
          }

          const enrolled = await prisma.student.count({ where: studentFilter });
          const present = s.attendance.length;
          const absent = Math.max(0, enrolled - present);
          const rate = enrolled > 0 ? Math.round((present / enrolled) * 100) : 0;

          const payload = {
            status: s.status,
            enrolled,
            present,
            absent,
            rate,
            records: s.attendance.map((a) => ({
              id: a.id,
              studentId: a.studentId,
              name: a.student.name,
              email: a.student.email,
              group: a.student.group,
              checkInTime: (a.verifiedAt || a.createdAt).toISOString(),
              distance: a.distanceMeters,
              city: a.studentCity,
            })),
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch (err) {
          console.error('[SSE stream error]', err);
          clearInterval(intervalId);
          try {
            controller.close();
          } catch {}
        }
      }

      // Initial push
      sendUpdate();
      // Push every 2 seconds
      intervalId = setInterval(sendUpdate, 2000);

      req.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
