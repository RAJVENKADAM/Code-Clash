/**
 * Resolve canonical visible/hidden arrays while supporting legacy challenges
 * whose cases were stored together in `testCases`.
 */
export function getChallengeTestCaseGroups(challenge) {
  const legacyCases = Array.isArray(challenge?.testCases)
    ? challenge.testCases
    : [];
  const sourceCases = Array.isArray(challenge?.visibleTestCases) &&
    challenge.visibleTestCases.length > 0
    ? challenge.visibleTestCases
    : legacyCases;
  const visible = sourceCases.filter((testCase) => !testCase?.isHidden);
  const hidden = [
    ...(Array.isArray(challenge?.hiddenTestCases) ? challenge.hiddenTestCases : []),
    ...sourceCases.filter((testCase) => testCase?.isHidden),
  ];
  const seenHidden = new Set();
  const uniqueHidden = hidden.filter((testCase) => {
    const key = `${testCase?.input ?? ""}\u0000${testCase?.expectedOutput ?? ""}`;
    if (seenHidden.has(key)) return false;
    seenHidden.add(key);
    return true;
  });
  return { visible, hidden: uniqueHidden };
}
