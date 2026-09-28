import type { Source } from "../domain/monitoring";
export function aixCantonSources(canton: string): Source[] {
  return (
    [
      ["courts", `Cantonal courts, including tax courts — ${canton}`, "court"],
      ["legislation", `Cantonal legislation — ${canton}`, "law"],
      ["authorities", `Cantonal authorities — ${canton}`, "authority"],
      ["tax-office", `Cantonal Tax Office ${canton}`, "authority"],
      ["consultations", `Cantonal consultations — ${canton}`, "consultation"],
    ] as const
  ).map(([id, name, type]) => ({
    id: `${canton.toLowerCase().replaceAll(" ", "-")}-${id}`,
    name,
    type,
    section: "government_cantonal",
    active: true,
    canton,
  }));
}
export const aixSources: Source[] = [
  ...(
    [
      ["federal-court", "Federal Supreme Court", "court"],
      ["administrative-court", "Federal Administrative Court", "court"],
      ["fedlex", "Fedlex", "law"],
      ["estv", "Federal Tax Administration (ESTV)", "authority"],
      ["bsv", "Federal Social Insurance Office (BSV)", "authority"],
      [
        "consultations",
        "Swiss consultations (Vernehmlassungen)",
        "consultation",
      ],
    ] as const
  ).map(([id, name, type]) => ({
    id,
    name,
    type,
    section: "government_federal" as const,
    active: true,
  })),
  ...aixCantonSources("Zurich"),
  ...[
    "SECA",
    "Swiss Startup Association",
    "EXPERTsuisse",
    "economiesuisse",
  ].map((name) => ({
    id: name.toLowerCase().replaceAll(" ", "-"),
    name,
    type: "association" as const,
    section: "non_government" as const,
    active: true,
  })),
];
