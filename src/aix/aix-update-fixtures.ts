import type { Update } from "../domain/monitoring";
import { aixTopics } from "./aix-topic-fixtures";
export function aixUpdates(
  profileId: string,
  clientName = "Fintara AG",
): Update[] {
  const records = [
    {
      key: "court",
      source_id: "zurich-courts",
      source_name: "Cantonal tax court Zurich",
      source_section: "government_cantonal",
      topic: "tax",
      published_at: "2026-09-25",
      relevance: "high",
      headline: "Court treats VSOP exit payout as salary, not capital gain",
      summary:
        "The Zurich cantonal tax court treated a VSOP exit payout as employment income rather than a capital gain. The decision linked the payout to the employment relationship and therefore treated it as taxable salary income.",
      why_it_matters:
        "Fintara's VSOP payouts on exit would be fully taxable income for employees.",
    },
    {
      key: "valuation",
      source_id: "estv",
      source_name: "ESTV",
      source_section: "government_federal",
      topic: "valuation",
      published_at: "2026-09-23",
      relevance: "high",
      headline:
        "Updated practice note on valuing shares of startups after a financing round",
      summary:
        "The practice note addresses the valuation of startup shares after a financing round. It considers how the financing price affects the tax value of employee shares.",
      why_it_matters:
        "Fintara's Series A price may now set the tax value of employee shares.",
    },
    {
      key: "leaver",
      source_id: "federal-court",
      source_name: "Federal Supreme Court",
      source_section: "government_federal",
      topic: "leaver",
      published_at: "2026-09-19",
      relevance: "medium",
      headline: "Ruling on good leaver clause and forfeiture of vested options",
      summary:
        "The ruling examines a good leaver clause and the forfeiture of vested options. It raises questions about how the plan terms apply when an employee leaves.",
      why_it_matters:
        "Fintara's leaver terms may need review before the next grant.",
    },
    {
      key: "seca",
      source_id: "seca",
      source_name: "SECA",
      source_section: "non_government",
      topic: "tax",
      published_at: "2026-09-16",
      relevance: "medium",
      headline:
        "Position paper calling for simpler taxation of startup employee participations",
      summary:
        "SECA calls for simpler taxation of startup employee participations. The position paper sets out a policy signal rather than an enacted change.",
      why_it_matters:
        "Signal of a possible legislative change worth mentioning to the founders.",
    },
  ] as const;
  return records.map(({ key, topic, ...r }) => {
    const t = aixTopics.find((t) => t.id === topic)!;
    return {
      ...r,
      client_name: clientName,
      why_it_matters: r.why_it_matters.replaceAll(
        "Fintara",
        clientName.replace(/ AG$/, ""),
      ),
      id: `${profileId}-${key}`,
      profile_id: profileId,
      topic_ids: [topic],
      topic_title: t.title,
      legal_basis: t.legal_basis!,
      read: false,
      saved: false,
      hidden: false,
    };
  });
}
