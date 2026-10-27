// Small generated timetable fixture; no user PDF is stored in the repository.
function timetablePdf(subject='INFO-A') {
  const lines=[['S4',20,750],['26.10.-01.11.2026',45,750],
    ...['Luni','Marti','Miercuri','Joi','Vineri','Sambata','Duminica'].map((day,index)=>[day,140+index*62,750]),
    ['I',30,730],['II',30,670],['10-12_MSPPS_1_c_MCS-M',202,730],[`15-17_MSPPS_c_${subject}`,202,670]];
  const content=lines.map(([text,x,y])=>`BT /F1 7 Tf ${x} ${y} Td (${text.replace(/[\\()]/g,'\\$&')}) Tj ET`).join('\n');
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf='%PDF-1.7\n';const offsets=[0];
  objects.forEach((body,index)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${body}\nendobj\n`;});
  const xref=Buffer.byteLength(pdf);
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(const offset of offsets.slice(1))pdf+=`${String(offset).padStart(10,'0')} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
module.exports={timetablePdf};
