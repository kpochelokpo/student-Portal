const PDFDocument = require('pdfkit');

const drawCrest = (doc, x, y, size) => {
  doc.save();
  doc.circle(x + size / 2, y + size / 2, size / 2).lineWidth(2).fillAndStroke('#F6F8FC', '#1E66D0');
  doc.circle(x + size / 2, y + size / 2, size / 2 - 12).stroke('#F5C400');
  doc.polygon([x + size / 2, y + 8], [x + 12, y + size / 2 - 6], [x + size - 12, y + size / 2 - 6]).fillAndStroke('#F5C400', '#181818');
  doc.rect(x + size / 2 - 18, y + size / 2 - 6, 36, 52).fillAndStroke('#1E66D0', '#181818');
  doc.fillColor('#181818').fontSize(8).text('HASSH', x + size / 2 - 16, y + size - 22);
  doc.restore();
};

const drawHeader = (doc, student, term) => {
  drawCrest(doc, 50, 40, 60);
  doc
    .fontSize(16)
    .font('Times-Bold')
    .fillColor('#114A9C')
    .text('HALF ASSINI SENIOR HIGH SCHOOL', 120, 45, { align: 'left' });
  doc
    .fontSize(12)
    .font('Times-Roman')
    .fillColor('#181818')
    .text('ACADEMIC RESULTS / REPORT CARD', 120, 70);

  doc
    .moveTo(50, 105)
    .lineTo(545, 105)
    .strokeColor('#1E66D0')
    .lineWidth(1.2)
    .stroke();

  doc
    .fontSize(10)
    .fillColor('#181818')
    .text(`Name: ${student.surname} ${student.firstname} ${student.othernames || ''}`, 50, 120)
    .text(`Index No: ${student.index_no}`, 50, 136)
    .text(`Class: ${student.class_name}`, 250, 120)
    .text(`Academic Year: ${term.academic_year}`, 250, 136)
    .text(`Term: ${term.name}`, 440, 120);
};

const drawWatermark = (doc) => {
  doc.save();
  doc.opacity(0.08);
  drawCrest(doc, 180, 260, 250);
  doc.restore();
};

const drawResultsTable = (doc, results, startY) => {
  const headerY = startY;
  doc
    .rect(50, headerY, 495, 20)
    .fill('#1E66D0');
  doc
    .fillColor('#FFFFFF')
    .fontSize(9)
    .text('Subject', 55, headerY + 6)
    .text('Class Score', 220, headerY + 6)
    .text('Exam Score', 300, headerY + 6)
    .text('Total Score', 380, headerY + 6)
    .text('Grade', 455, headerY + 6)
    .text('Remarks', 500, headerY + 6, { width: 40, align: 'right' });

  doc.fillColor('#181818');
  let rowY = headerY + 22;
  results.forEach((row) => {
    doc
      .fontSize(9)
      .text(row.subject, 55, rowY, { width: 160 })
      .text(row.class_score.toString(), 230, rowY)
      .text(row.exam_score.toString(), 310, rowY)
      .text(row.total_score.toString(), 390, rowY)
      .text(row.grade, 460, rowY)
      .text(row.remark, 470, rowY, { width: 70, align: 'right' });
    rowY += 18;
  });

  return rowY + 10;
};

const drawAdministration = (doc, student, startY) => {
  doc
    .fontSize(10)
    .fillColor('#114A9C')
    .text('Administration', 50, startY);

  doc
    .fontSize(9)
    .fillColor('#181818')
    .text(`Programme: ${student.programme}`, 50, startY + 16)
    .text(`Date Admitted: ${student.date_admitted}`, 250, startY + 16)
    .text(`Date of Graduation: ${student.expected_graduation}`, 50, startY + 32)
    .text(`Scholarship: ${student.scholarship || 'N/A'}`, 250, startY + 32)
    .text(`Comments: ${student.comments || 'N/A'}`, 50, startY + 48, { width: 480 });
};

const generateReportCard = ({ student, terms, resultsByTerm }, res) => {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="report-card.pdf"');

  doc.pipe(res);

  terms.forEach((term, index) => {
    if (index > 0) {
      doc.addPage();
    }

    drawHeader(doc, student, term);
    drawWatermark(doc);

    doc
      .fontSize(11)
      .fillColor('#114A9C')
      .text(`Term Summary - ${term.name}`, 50, 165);

    const results = resultsByTerm[term.id] || [];
    const tableEnd = drawResultsTable(doc, results, 185);

    doc
      .fontSize(9)
      .fillColor('#181818')
      .text(`This Term Ended: ${term.end_date}`, 50, tableEnd + 4);

    drawAdministration(doc, student, tableEnd + 28);
  });

  doc.end();
};

module.exports = {
  generateReportCard
};
