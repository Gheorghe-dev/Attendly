import { NextResponse } from 'next/server';
import { buildStudentTemplateExcel } from '@/lib/excel';

export async function GET() {
  try {
    const buffer = await buildStudentTemplateExcel();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="student-roster-template.xlsx"',
      },
    });
  } catch (err) {
    console.error('Failed to generate student template:', err);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
