import ExcelJS from 'exceljs';

export interface StudentRow {
  name: string;
  email: string;
  group: string;
}

export interface ValidationResult {
  valid: StudentRow[];
  errors: Array<{ row: number; reason: string; data: Record<string, unknown> }>;
  duplicates: Array<{ row: number; email: string }>;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function cellToString(cell: ExcelJS.Cell | undefined): string {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  const val = cell.value;
  if (typeof val === 'object') {
    if ('text' in val && typeof (val as { text: unknown }).text === 'string') {
      return (val as { text: string }).text.trim();
    }
    if ('richText' in val && Array.isArray((val as { richText: unknown[] }).richText)) {
      return (val as { richText: Array<{ text: string }> }).richText.map((t) => t.text || '').join('').trim();
    }
    if ('result' in val && val.result !== undefined && val.result !== null) {
      return String(val.result).trim();
    }
  }
  return String(val).trim();
}

function isEmailHeader(val: string): boolean {
  const v = val.toLowerCase().trim();
  return v.includes('email') || v.includes('mail') || v.includes('imai');
}

function isNameHeader(val: string): boolean {
  const v = val.toLowerCase().trim();
  return v.includes('name') || v.includes('nume') || v.includes('student');
}

function isGroupHeader(val: string): boolean {
  const v = val.toLowerCase().trim();
  return v.includes('group') || v.includes('grup') || v.includes('subgroup') || v.includes('formatiun');
}

export async function parseStudentExcel(buffer: Buffer): Promise<ValidationResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('No worksheet found in Excel file.');

  const result: ValidationResult = { valid: [], errors: [], duplicates: [] };
  const emailsSeen = new Map<string, number>();

  const rowCount = sheet.rowCount;
  const firstRow = sheet.getRow(1);
  const secondRow = sheet.getRow(2);
  const thirdRow = sheet.getRow(3);

  // Check for horizontal/transposed layout (Row 1 = Name, Row 2 = Email, Row 3 = Group across columns)
  const r1c1 = cellToString(firstRow.getCell(1)).toLowerCase();
  const r2c1 = cellToString(secondRow.getCell(1)).toLowerCase();
  const r3c1 = cellToString(thirdRow.getCell(1)).toLowerCase();

  const isHorizontal =
    rowCount <= 5 &&
    isNameHeader(r1c1) &&
    isEmailHeader(r2c1) &&
    isGroupHeader(r3c1);

  if (isHorizontal) {
    const colCount = Math.max(firstRow.cellCount, secondRow.cellCount, thirdRow.cellCount);
    for (let col = 2; col <= colCount; col++) {
      const name = cellToString(firstRow.getCell(col));
      const rawEmail = cellToString(secondRow.getCell(col));
      const rawGroup = cellToString(thirdRow.getCell(col));
      const group = rawGroup.replace(/\s+/g, ' ').trim();

      if (!name && !rawEmail && !group) continue;

      if (!name) {
        result.errors.push({ row: col, reason: 'Missing student name', data: { name, rawEmail, group } });
        continue;
      }
      if (!rawEmail) {
        result.errors.push({ row: col, reason: 'Missing email', data: { name, rawEmail, group } });
        continue;
      }
      if (!group) {
        result.errors.push({ row: col, reason: 'Missing group', data: { name, rawEmail, group } });
        continue;
      }

      const email = normalizeEmail(rawEmail);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        result.errors.push({ row: col, reason: `Invalid email format: "${rawEmail}"`, data: { name, rawEmail, group } });
        continue;
      }

      if (emailsSeen.has(email)) {
        result.duplicates.push({ row: col, email });
        continue;
      }

      emailsSeen.set(email, col);
      result.valid.push({ name, email, group });
    }
    return result;
  }

  // Standard vertical column layout
  const headers: Record<string, number> = {};
  firstRow.eachCell((cell, colNumber) => {
    const val = cellToString(cell);
    if (isNameHeader(val) && !headers['name']) headers['name'] = colNumber;
    if (isEmailHeader(val) && !headers['email']) headers['email'] = colNumber;
    if (isGroupHeader(val) && !headers['group']) headers['group'] = colNumber;
  });

  let startRow = 2;

  // Fallback if headers were not explicitly matched by keyword:
  if (!headers['name'] || !headers['email'] || !headers['group']) {
    const r1c2 = cellToString(firstRow.getCell(2));
    const r2c2 = cellToString(secondRow.getCell(2));

    if (r1c2.includes('@')) {
      // Row 1 is already student data (no header row): Col 1 = Name, Col 2 = Email, Col 3 = Group
      headers['name'] = 1;
      headers['email'] = 2;
      headers['group'] = 3;
      startRow = 1;
    } else if (r2c2.includes('@')) {
      // Row 1 is a header with custom naming, Row 2 is data
      headers['name'] = headers['name'] || 1;
      headers['email'] = headers['email'] || 2;
      headers['group'] = headers['group'] || 3;
      startRow = 2;
    }
  }

  if (!headers['name'] || !headers['email'] || !headers['group']) {
    throw new Error(
      'Excel file must have columns: Student Name (or Name), University Email (or Email), Group (e.g. AIA 3.3A, AIA 3.1 B, ELA 2.2 A)'
    );
  }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < startRow) return;
    const name = cellToString(row.getCell(headers['name']));
    const rawEmail = cellToString(row.getCell(headers['email']));
    const rawGroup = cellToString(row.getCell(headers['group']));
    const group = rawGroup.replace(/\s+/g, ' ').trim();

    if (!name && !rawEmail && !group) return; // skip empty rows

    if (!name) {
      result.errors.push({ row: rowNumber, reason: 'Missing student name', data: { name, rawEmail, group } });
      return;
    }
    if (!rawEmail) {
      result.errors.push({ row: rowNumber, reason: 'Missing email', data: { name, rawEmail, group } });
      return;
    }
    if (!group) {
      result.errors.push({ row: rowNumber, reason: 'Missing group', data: { name, rawEmail, group } });
      return;
    }

    const email = normalizeEmail(rawEmail);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      result.errors.push({ row: rowNumber, reason: `Invalid email format: "${rawEmail}"`, data: { name, rawEmail, group } });
      return;
    }

    if (emailsSeen.has(email)) {
      result.duplicates.push({ row: rowNumber, email });
      return;
    }

    emailsSeen.set(email, rowNumber);
    result.valid.push({ name, email, group });
  });

  return result;
}

export async function buildStudentTemplateExcel(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Students');

  sheet.columns = [
    { header: 'Student Name', key: 'name', width: 30 },
    { header: 'University Email', key: 'email', width: 38 },
    { header: 'Group', key: 'group', width: 20 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' },
  };

  const sampleRows = [
    { name: 'Popescu Andrei', email: 'andrei.popescu@student.university.edu', group: 'AIA 3.3A' },
    { name: 'Ionescu Maria', email: 'maria.ionescu@student.university.edu', group: 'AIA 3.1 B' },
    { name: 'Radu Cristian', email: 'cristian.radu@student.university.edu', group: 'ELA 2.2 A' },
    { name: 'Dumitrescu Elena', email: 'elena.dumitrescu@student.university.edu', group: 'AIA 3.2 A' },
    { name: 'Stan Alexandru', email: 'alexandru.stan@student.university.edu', group: 'ELA 2.1 B' },
  ];

  for (const r of sampleRows) {
    sheet.addRow(r);
  }

  sheet.autoFilter = { from: 'A1', to: 'C1' };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function buildAttendanceExcel({
  students,
  attendance,
  courseName,
  sessionDate,
  sessionName,
}: {
  students: Array<{ name: string; email: string; group: string }>;
  attendance: Map<string, { verifiedAt: Date | null; status: string }>;
  courseName: string;
  sessionDate: Date;
  sessionName: string;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sessionName ? sessionName.slice(0, 31) : 'Attendance');

  sheet.columns = [
    { header: 'Student Full Name', key: 'name', width: 30 },
    { header: 'University Email', key: 'email', width: 35 },
    { header: 'Group', key: 'group', width: 18 },
    { header: 'Course Name', key: 'course', width: 25 },
    { header: 'Class Date', key: 'date', width: 15 },
    { header: 'Attendance Status', key: 'status', width: 20 },
    { header: 'Registration Date & Time', key: 'registeredAt', width: 25 },
  ];

  // Style header
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' },
  };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  const dateStr = sessionDate.toLocaleDateString('en-GB');

  for (const student of students) {
    const rec = attendance.get(student.email);
    const isPresent = rec?.status === 'verified';
    const row = sheet.addRow({
      name: student.name,
      email: student.email,
      group: student.group,
      course: courseName,
      date: dateStr,
      status: isPresent ? 'Present' : 'Absent',
      registeredAt: rec?.verifiedAt
        ? new Date(rec.verifiedAt).toLocaleString('en-GB')
        : '',
    });
    const statusCell = row.getCell('status');
    statusCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isPresent ? 'FFD1FAE5' : 'FFFEE2E2' },
    };
    statusCell.font = { color: { argb: isPresent ? 'FF065F46' : 'FF991B1B' } };
  }

  sheet.autoFilter = { from: 'A1', to: 'G1' };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function buildMultiSessionExcel(sessions: Array<{
  sessionName: string;
  courseName: string;
  sessionDate: Date;
  students: Array<{ name: string; email: string; group: string }>;
  attendance: Map<string, { verifiedAt: Date | null; status: string }>;
}>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('All Sessions');

  sheet.columns = [
    { header: 'Student Full Name', key: 'name', width: 30 },
    { header: 'University Email', key: 'email', width: 35 },
    { header: 'Group', key: 'group', width: 18 },
    { header: 'Course Name', key: 'course', width: 25 },
    { header: 'Session', key: 'session', width: 20 },
    { header: 'Class Date', key: 'date', width: 15 },
    { header: 'Attendance Status', key: 'status', width: 20 },
    { header: 'Registration Date & Time', key: 'registeredAt', width: 25 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };

  for (const s of sessions) {
    const dateStr = s.sessionDate.toLocaleDateString('en-GB');
    for (const student of s.students) {
      const rec = s.attendance.get(student.email);
      const isPresent = rec?.status === 'verified';
      const row = sheet.addRow({
        name: student.name,
        email: student.email,
        group: student.group,
        course: s.courseName,
        session: s.sessionName,
        date: dateStr,
        status: isPresent ? 'Present' : 'Absent',
        registeredAt: rec?.verifiedAt
          ? new Date(rec.verifiedAt).toLocaleString('en-GB')
          : '',
      });
      const statusCell = row.getCell('status');
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isPresent ? 'FFD1FAE5' : 'FFFEE2E2' },
      };
      statusCell.font = { color: { argb: isPresent ? 'FF065F46' : 'FF991B1B' } };
    }
  }

  sheet.autoFilter = { from: 'A1', to: 'H1' };
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
