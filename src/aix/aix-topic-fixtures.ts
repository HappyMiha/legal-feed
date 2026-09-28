import type { Topic } from "../domain/monitoring";
export const aixTopics: Topic[] = [
  [
    "tax",
    "Taxation of employee participations",
    "When options, shares and VSOP payouts are taxed as income",
    "DBG Art. 17a to 17e, ESTV Circular No. 37",
  ],
  [
    "valuation",
    "Valuation of startup shares for tax purposes",
    "How unlisted startup shares are valued for income and wealth tax",
    "ESTV Circular No. 28, cantonal startup practice",
  ],
  [
    "social",
    "Social security on equity compensation",
    "AHV contributions on option exercises and VSOP payouts",
    "AHVG, AHVV",
  ],
  [
    "reporting",
    "Employer reporting obligations",
    "What the employer must report to tax authorities",
    "Ordinance on Employee Participations (MBV)",
  ],
  [
    "leaver",
    "Leaver clauses and employment law",
    "Good and bad leaver rules and whether payouts count as salary",
    "CO Art. 322d, Federal Supreme Court case law",
  ],
  [
    "capital",
    "Share capital for option plans",
    "Conditional capital and capital band to serve the plan",
    "CO Art. 653, CO Art. 653s",
  ],
].map(([id, title, description, legal_basis]) => ({
  id,
  title,
  description,
  legal_basis,
  origin: "ai",
  selected: true,
}));
export const matchesAIx = (input: string) =>
  /\b(esop|vsop|employee participation|employee options|stock options|phantom shares|equity plan|mitarbeiterbeteiligung)\b/i.test(
    input,
  );
