// Imported only by party/game-room.ts — must NOT be re-exported through client-visible modules.

export const PACK_NAMES = ["corporate-classics", "agile", "sales"] as const;
export type PackName = (typeof PACK_NAMES)[number];

export const STARTER_PACKS: Record<PackName, string[]> = {
  "corporate-classics": [
    "Synergy", "Circle back", "Move the needle", "Low-hanging fruit",
    "Deep dive", "Bandwidth", "Alignment", "Leverage", "Pain point",
    "Boil the ocean", "Paradigm shift", "Action item", "Touch base",
    "Blue-sky thinking", "Drill down", "Holistic approach", "Take offline",
    "Best practices", "Core competency", "Value add",
  ],
  "agile": [
    "Sprint", "Velocity", "Backlog", "Stand-up", "Retrospective",
    "Story points", "Kanban", "Scrum", "Epic", "User story",
    "Definition of done", "MVP", "Iterative", "Pivot", "Ship it",
    "Two-pizza team", "Fail fast", "Continuous delivery", "DevOps", "Stakeholder",
  ],
  "sales": [
    "Pipeline", "Closing", "Quota", "Prospect", "Discovery call",
    "Champion", "ROI", "Upsell", "Churn", "Conversion",
    "Elevator pitch", "Decision maker", "BANT", "Objection handling",
    "Solution selling", "Land and expand", "Net new", "MRR", "ARR", "Forecasting",
  ],
};
