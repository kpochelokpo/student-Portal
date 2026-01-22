const gradeScale = [
  { min: 80, max: 100, grade: 'A1', remark: 'EXCELLENT' },
  { min: 70, max: 79, grade: 'B2', remark: 'VERY GOOD' },
  { min: 60, max: 69, grade: 'B3', remark: 'VERY GOOD' },
  { min: 55, max: 59, grade: 'C4', remark: 'GOOD' },
  { min: 50, max: 54, grade: 'C5', remark: 'GOOD' },
  { min: 45, max: 49, grade: 'C6', remark: 'CREDIT' },
  { min: 40, max: 44, grade: 'D7', remark: 'PASS' },
  { min: 35, max: 39, grade: 'E8', remark: 'PASS' },
  { min: 0, max: 34, grade: 'F9', remark: 'FAIL' }
];

const evaluateGrade = (classScore, examScore) => {
  const classScoreNum = Number(classScore);
  const examScoreNum = Number(examScore);
  if (Number.isNaN(classScoreNum) || Number.isNaN(examScoreNum)) {
    throw new Error('Scores must be numeric.');
  }
  if (classScoreNum < 0 || classScoreNum > 50 || examScoreNum < 0 || examScoreNum > 50) {
    throw new Error('Scores must be within 0-50 each.');
  }
  const total = classScoreNum + examScoreNum;
  const range = gradeScale.find((item) => total >= item.min && total <= item.max);
  return {
    total,
    grade: range.grade,
    remark: range.remark
  };
};

module.exports = {
  gradeScale,
  evaluateGrade
};
