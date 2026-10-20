import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
            where: { id: params.id, course: { professorId: session!.user!.id } },
            include: {
              attendance: {
                include: { student: true },
                where: { status: 'verified' },
              },
              _count: { select: { attendance: true } },
            },
          });
          if (!s) return;
          const sessionGroups = s.groups.split(',').map((g: string) => g.trim());
          const enrolled = await prisma.student.count({
            where: { courseId: s.courseId, group: { in: sessionGroups } },
          });
          const data = {
            status: s.status,
            enrolled,
            verified: s.attendance.length,
            recent: s.attendance.slice(0, 5).map((a) => ({
              name: a.student.name,
              email: a.student.email,
              group: a.student.group,
              verifiedAt: a.verifiedAt,
            })),
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          clearInterval(intervalId);
          controller.close();
        }
      }
      sendUpdate();
      intervalId = setInterval(sendUpdate, 5000);
      req.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        controller.close();
      });
    },
    cancel() {
      clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
