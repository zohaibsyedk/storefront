/** Art directions for generated sites and ads: hand-tuned token sets, never free-form CSS from a model. */
export interface ArtDirection {
  id: string;
  name: string;
  blurb: string;
  bg: string;
  panel: string;
  ink: string;
  accent: string;
  accentInk: string;
  display: string;
  body: string;
  displayWeight: number;
  displayCase: "none" | "uppercase";
  radius: string;
  tracking: string;
}

export const ART: Record<string, ArtDirection> = {
  sign_painter: {
    id: "sign_painter",
    name: "Sign painter",
    blurb: "Butter yellow, oxblood and chunky lettering, like a hand-painted shop sign.",
    bg: "#ffe9a8",
    panel: "#fff6d6",
    ink: "#5a1616",
    accent: "#e2452b",
    accentInk: "#fff6d6",
    display: "var(--font-bowlby), Impact, sans-serif",
    body: "var(--font-karla), system-ui, sans-serif",
    displayWeight: 400,
    displayCase: "none",
    radius: "0px",
    tracking: "0",
  },
  market_hall: {
    id: "market_hall",
    name: "Market hall",
    blurb: "Sage, forest green and plum with a soft, generous serif.",
    bg: "#dce5d3",
    panel: "#f4f6ee",
    ink: "#1f3b2c",
    accent: "#6b2d5c",
    accentInk: "#f4f6ee",
    display: "var(--font-fraunces), Georgia, serif",
    body: "var(--font-worksans), system-ui, sans-serif",
    displayWeight: 600,
    displayCase: "none",
    radius: "18px",
    tracking: "-0.02em",
  },
  clean_counter: {
    id: "clean_counter",
    name: "Clean counter",
    blurb: "White, ink and one strong cobalt. Calm and exact.",
    bg: "#ffffff",
    panel: "#eef2f7",
    ink: "#0e1a2b",
    accent: "#2248f5",
    accentInk: "#ffffff",
    display: "var(--font-schibsted), system-ui, sans-serif",
    body: "var(--font-schibsted), system-ui, sans-serif",
    displayWeight: 700,
    displayCase: "none",
    radius: "6px",
    tracking: "-0.03em",
  },
};
export const artOf = (id?: string) => ART[id ?? ""] ?? ART.market_hall;
