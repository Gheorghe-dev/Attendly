import ExcelJS from 'exceljs';
import path from 'path';

async function main() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Students');
  ws.columns = [
    { header: 'Student Name', key: 'name', width: 30 },
    { header: 'University Email', key: 'email', width: 40 },
    { header: 'Group', key: 'group', width: 18 },
  ];
  ws.getRow(1).font = { bold: true };

  // Sample students across groups like AIA 3.3A, AIA 3.1 B, ELA 2.2 A:
  //   - 8 valid students
  //   - 3 demo rows to exercise import validation (missing name, missing email, duplicate)
  const students: Array<[string, string, string]> = [
    ['Alice Johnson', 'alice.johnson@university.edu', 'AIA 3.3A'],
    ['Bob Smith',     'bob.smith@university.edu',     'AIA 3.1 B'],
    ['Carol Williams','carol.williams@university.edu','ELA 2.2 A'],
    ['David Brown',   'david.brown@university.edu',   'AIA 3.3A'],
    ['Eve Davis',     'eve.davis@university.edu',     'AIA 3.1 B'],
    ['Frank Miller',  'frank.miller@university.edu',  'ELA 2.2 A'],
    ['Grace Wilson',  'grace.wilson@university.edu',  'AIA 3.2 A'],
    ['Henry Moore',   'henry.moore@university.edu',   'ELA 2.1 B'],
    ['',              'invalid-email',                'AIA 3.3A'],   // missing name + bad email
    ['Jane Doe',      '',                             'AIA 3.1 B'],   // missing email
    ['Bob Smith',     'bob.smith@university.edu',     'AIA 3.1 B'],   // duplicate of row 2
  ];

  for (const [name, email, group] of students) {
    ws.addRow({ name, email, group });
  }

  const outPath = path.join(process.cwd(), 'seed', 'sample-students.xlsx');
  await wb.xlsx.writeFile(outPath);
  console.log('Sample Excel written to', outPath);
}

main().catch(console.error);
