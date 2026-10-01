export function countRoomTestCases(questions = []) {
  return questions.reduce(
    (total, question) =>
      total +
      (question.visibleTestCases || []).length +
      (question.hiddenTestCases || []).length,
    0,
  );
}

export function calculateQuestionScore(points, passedTestCases, totalTestCases) {
  if (totalTestCases <= 0) return 0;
  return Math.round((points * passedTestCases * 100) / totalTestCases) / 100;
}
