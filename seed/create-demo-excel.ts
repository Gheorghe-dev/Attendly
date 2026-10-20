import ExcelJS from 'exceljs';
import path from 'path';

// ============================================================================
//  GROUP CONFIGURATION
//  --------------------
//  Edit the GROUPS list below to match your class structure.
//  - Each entry becomes a "Group" column value.
//  - Students are distributed evenly across the listed groups in order.
//  - You can have as few as 1 or as many as you like — the script auto-balances.
//
//  Current defaults mimic real-world groups:
//      AIA 3.3A, AIA 3.1 B, ELA 2.2 A, AIA 3.2 A, ELA 2.1 B
// ============================================================================
const GROUPS: string[] = ['AIA 3.3A', 'AIA 3.1 B', 'ELA 2.2 A', 'AIA 3.2 A', 'ELA 2.1 B'];
// ============================================================================

async function main() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Students');

  ws.columns = [
    { header: 'Student Name', key: 'name', width: 30 },
    { header: 'University Email', key: 'email', width: 40 },
    { header: 'Group', key: 'group', width: 15 },
  ];

  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'left' };

  const firsts = [
    'Alice','Bob','Carol','David','Eve','Frank','Grace','Henry','Iris','Jack',
    'Kira','Liam','Maya','Noah','Olivia','Pavel','Quinn','Ravi','Sofia','Tariq',
    'Uma','Victor','Willow','Xavier','Yara','Zane','Anna','Bruno','Camila','Diego',
    'Elena','Fatima','Gabriel','Hana','Ines','Julia','Kai','Luna','Mateo','Nia',
    'Omar','Priya','Rafael','Sara','Theo','Una','Vince','Wendy','Yusuf','Zoe'
  ];
  const lasts = [
    'Johnson','Smith','Williams','Brown','Davis','Miller','Wilson','Moore','Taylor','Anderson',
    'Thomas','Jackson','White','Harris','Martin','Thompson','Garcia','Martinez','Robinson','Clark',
    'Rodriguez','Lewis','Lee','Walker','Hall','Allen','Young','King','Wright','Scott',
    'Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Carter','Mitchell',
    'Roberts','Phillips','Evans','Turner','Parker','Edwards','Collins','Stewart','Morris','Murphy'
  ];

  const seen = new Set<string>();
  const rows: Array<[string, string, string]> = [];

  for (let i = 0; i < 60 && rows.length < 60; i++) {
    const first = firsts[i % firsts.length];
    const last  = lasts[(i * 7) % lasts.length];
    const name  = `${first} ${last}`;
    let email = `${first.toLowerCase()}.${last.toLowerCase()}@university.edu`;
    let suffix = 0;
    while (seen.has(email)) {
      suffix++;
      email = `${first.toLowerCase()}.${last.toLowerCase()}${suffix}@university.edu`;
    }
    seen.add(email);
    const group = GROUPS[i % GROUPS.length];
    rows.push([name, email, group]);
  }

  for (const r of rows) ws.addRow({ name: r[0], email: r[1], group: r[2] });

  // -------- Summary block at the bottom for quick visual check ---------------
  ws.addRow([]);
  ws.addRow([`Demo file: ${rows.length} students distributed across ${GROUPS.length} group(s): ${GROUPS.join(', ')}.`]);
  ws.addRow([]);
  ws.addRow(['Group', 'Students in this file']);
  for (const g of GROUPS) {
    const count = rows.filter(r => r[2] === g).length;
    ws.addRow([g, count]);
  }

  const outPath = path.join(process.cwd(), 'seed', 'demo-students.xlsx');
  await wb.xlsx.writeFile(outPath);

  const stat = require('fs').statSync(outPath);
  console.log(`Wrote ${outPath}  (${stat.size} bytes, ${rows.length} rows across ${GROUPS.length} groups)`);
  for (const g of GROUPS) {
    const count = rows.filter(r => r[2] === g).length;
    console.log(`  - ${g}: ${count} student(s)`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
