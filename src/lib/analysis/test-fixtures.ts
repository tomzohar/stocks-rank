/** A submit_scores input that passes validation; override fields per test. */
export function validSubmission(overrides: Record<string, unknown> = {}) {
  return {
    moat: { rationale: "Dominant platform with switching costs.", score: 10 },
    ceo: { rationale: "Long-tenured founder CEO.", score: 10 },
    recessionProof: { rationale: "Enterprise spend dipped in 2022.", score: 5 },
    secularTrend: { rationale: "AI infrastructure build-out.", score: 10 },
    culture: { rationale: "Mixed employee reviews.", score: 5 },
    talent: { rationale: "Attrition of senior researchers.", score: 0 },
    summary: "Strong moat and tailwind; culture is a watch item.",
    sources: [],
    ...overrides,
  };
}
