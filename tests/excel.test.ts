import { parseStudentExcel, buildAttendanceExcel, buildStudentTemplateExcel } from '@/lib/excel';
import ExcelJS from 'exceljs';

async function makeExcel(
  rows: Array<[string, string, string]>,
  headers = ['Student Name', 'University Email', 'Group']
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Students');
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab);
}

describe('parseStudentExcel', () => {
  it('parses valid rows', async () => {
    const buf = await makeExcel([['Alice', 'alice@uni.edu', 'Group A']]);
    const result = await parseStudentExcel(buf);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]).toEqual({ name: 'Alice', email: 'alice@uni.edu', group: 'Group A' });
    expect(result.errors).toHaveLength(0);
  });

  it('parses realistic engineering groups like AIA 3.3A, AIA 3.1 B, ELA 2.2 A', async () => {
    const buf = await makeExcel([
      ['Ion Popescu', 'ion.popescu@univ.ro', 'AIA 3.3A'],
      ['Maria Radu', 'maria.radu@univ.ro', 'AIA 3.1 B'],
      ['Andrei Stan', 'andrei.stan@univ.ro', 'ELA 2.2 A'],
    ]);
    const result = await parseStudentExcel(buf);
    expect(result.valid).toHaveLength(3);
    expect(result.valid[0].group).toBe('AIA 3.3A');
    expect(result.valid[1].group).toBe('AIA 3.1 B');
    expect(result.valid[2].group).toBe('ELA 2.2 A');
  });

  it('accepts custom and misspelled header variations like THE NAme, imai, Groups', async () => {
    const buf = await makeExcel(
      [['Alex', 'alex@univ.ro', 'AIA 3.3A']],
      ['THE NAme', 'imai', 'Groups']
    );
    const result = await parseStudentExcel(buf);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]).toEqual({ name: 'Alex', email: 'alex@univ.ro', group: 'AIA 3.3A' });
  });

  it('accepts Romanian headers (Nume, Email, Grupa)', async () => {
    const buf = await makeExcel(
      [['Elena', 'elena@univ.ro', 'ELA 2.2 A']],
      ['Nume', 'Adresa Email', 'Grupa']
    );
    const result = await parseStudentExcel(buf);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].name).toBe('Elena');
    expect(result.valid[0].group).toBe('ELA 2.2 A');
  });

  it('parses transposed horizontal layout (Row 1: Name, Row 2: Email, Row 3: Group)', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Students');
    ws.addRow(['THE NAme', 'Ion Popescu', 'Maria Radu']);
    ws.addRow(['imai', 'ion@univ.ro', 'maria@univ.ro']);
    ws.addRow(['Groups', 'AIA 3.3A', 'ELA 2.2 A']);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const result = await parseStudentExcel(buf);
    expect(result.valid).toHaveLength(2);
    expect(result.valid[0]).toEqual({ name: 'Ion Popescu', email: 'ion@univ.ro', group: 'AIA 3.3A' });
    expect(result.valid[1]).toEqual({ name: 'Maria Radu', email: 'maria@univ.ro', group: 'ELA 2.2 A' });
  });

  it('normalizes email (trims and lowercases)', async () => {
    const buf = await makeExcel([[' Bob ', '  BOB@UNI.EDU  ', 'Group A']]);
    const result = await parseStudentExcel(buf);
    expect(result.valid[0].email).toBe('bob@uni.edu');
    expect(result.valid[0].name).toBe('Bob');
  });

  it('flags invalid email', async () => {
    const buf = await makeExcel([['Carol', 'not-an-email', 'Group A']]);
    const result = await parseStudentExcel(buf);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toMatch(/Invalid email/);
  });

  it('flags missing email', async () => {
    const buf = await makeExcel([['Dave', '', 'Group A']]);
    const result = await parseStudentExcel(buf);
    expect(result.errors[0].reason).toMatch(/Missing email/);
  });

  it('flags missing name', async () => {
    const buf = await makeExcel([['', 'x@uni.edu', 'Group A']]);
    const result = await parseStudentExcel(buf);
    expect(result.errors[0].reason).toMatch(/Missing student name/);
  });

  it('flags missing group', async () => {
    const buf = await makeExcel([['Eve', 'eve@uni.edu', '']]);
    const result = await parseStudentExcel(buf);
    expect(result.errors[0].reason).toMatch(/Missing group/);
  });

  it('flags duplicate emails', async () => {
    const buf = await makeExcel([
      ['Alice', 'alice@uni.edu', 'Group A'],
      ['Alice2', 'alice@uni.edu', 'Group B'],
    ]);
    const result = await parseStudentExcel(buf);
    expect(result.valid).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });

  it('throws on missing header columns when only 2 columns exist and no valid email structure', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('S');
    ws.addRow(['Foo', 'Bar']);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    await expect(parseStudentExcel(buf)).rejects.toThrow();
  });

  it('skips empty rows', async () => {
    const buf = await makeExcel([['Alice', 'alice@uni.edu', 'Group A'], ['', '', '']]);
    const result = await parseStudentExcel(buf);
    expect(result.valid).toHaveLength(1);
  });
});

describe('buildStudentTemplateExcel', () => {
  it('generates a valid template containing expected sample groups', async () => {
    const buf = await buildStudentTemplateExcel();
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    expect(ws.name).toBe('Students');

    const header = ws.getRow(1);
    expect(header.getCell(1).value).toBe('Student Name');
    expect(header.getCell(2).value).toBe('University Email');
    expect(header.getCell(3).value).toBe('Group');

    const sampleRow = ws.getRow(2);
    expect(sampleRow.getCell(3).value).toBe('AIA 3.3A');
  });
});

describe('buildAttendanceExcel', () => {
  it('builds a valid xlsx buffer with scan distance telemetry', async () => {
    const students = [
      { name: 'Alice', email: 'alice@uni.edu', group: 'AIA 3.3A' },
      { name: 'Bob', email: 'bob@uni.edu', group: 'AIA 3.1 B' },
    ];
    const attendance = new Map([
      [
        'alice@uni.edu',
        {
          verifiedAt: new Date(),
          status: 'verified',
          distanceMeters: 200000,
          studentCity: 'Timisoara',
        },
      ],
    ]);
    const buf = await buildAttendanceExcel({
      students,
      attendance,
      courseName: 'Math 101',
      sessionDate: new Date(),
      sessionName: 'Lecture 1',
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);

    // Parse and verify
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(buf as unknown as ArrayBuffer);
    const ws2 = wb2.worksheets[0];
    const rows: string[][] = [];
    ws2.eachRow((row) => {
      const vals: string[] = [];
      row.eachCell((c) => vals.push(String(c.value)));
      rows.push(vals);
    });

    // Check header
    expect(rows[0]).toContain('Scan Distance');

    // Check Alice (Present with distance)
    expect(rows[1]).toContain('Present');
    expect(rows[1]).toContain('200 km');

    // Check Bob (Absent)
    expect(rows[2]).toContain('Absent');
    expect(rows[2]).toContain('—');
  });
});
