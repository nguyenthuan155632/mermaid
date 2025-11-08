import { db } from "@/db";
import { sampleDiagrams } from "@/db/schema";
import { SAMPLE_DATA, SampleKey } from "./sample_data";

type SampleMeta = {
  key: SampleKey;
  title: string;
  description: string;
  category: string;
  order: number;
};

const SAMPLE_METADATA: SampleMeta[] = [
  {
    key: "flowchart",
    title: "Holiday Shopping Flow",
    description: "Decision tree for choosing the next purchase.",
    category: "flowchart",
    order: 1,
  },
  {
    key: "class",
    title: "Animal Class Diagram",
    description: "Simple inheritance example with attributes and methods.",
    category: "class",
    order: 2,
  },
  {
    key: "sequence",
    title: "Greeting Sequence",
    description: "Message exchange between two participants.",
    category: "sequence",
    order: 3,
  },
  {
    key: "entityRelationship",
    title: "Orders ER Model",
    description: "Customers, orders, products, and items relationships.",
    category: "er",
    order: 4,
  },
  {
    key: "state",
    title: "Movement State Machine",
    description: "Idle, moving, and crash states with transitions.",
    category: "state",
    order: 5,
  },
  {
    key: "mindMap",
    title: "Mindmap Template",
    description: "Mindmap showing origins, research, and tools.",
    category: "mindmap",
    order: 6,
  },
  {
    key: "architecture",
    title: "API Cloud Architecture",
    description: "Cloud services grouped by clients, platform, and data.",
    category: "architecture",
    order: 7,
  },
  {
    key: "c4",
    title: "Banking Context (C4)",
    description: "C4 context diagram covering boundaries and systems.",
    category: "c4",
    order: 8,
  },
  {
    key: "gantt",
    title: "Sample Gantt Chart",
    description: "Tasks with durations and dependencies.",
    category: "gantt",
    order: 9,
  },
  {
    key: "git",
    title: "Git Workflow",
    description: "Commits, branches, and merges for version control.",
    category: "git",
    order: 10,
  },
  {
    key: "kanban",
    title: "Kanban Board",
    description: "Tickets across backlog, in-progress, and done.",
    category: "kanban",
    order: 11,
  },
  {
    key: "package",
    title: "TCP Packet Layout",
    description: "Visualize header bits in a TCP packet.",
    category: "packet",
    order: 12,
  },
  {
    key: "pie",
    title: "Adoption Pie Chart",
    description: "Pet adoption counts grouped by type.",
    category: "pie",
    order: 13,
  },
  {
    key: "quadrant",
    title: "Campaign Quadrant",
    description: "Compare reach and engagement of campaigns.",
    category: "quadrant",
    order: 14,
  },
  {
    key: "radar",
    title: "Student Grades Radar",
    description: "Radar chart showing scores per subject.",
    category: "radar",
    order: 15,
  },
  {
    key: "requirement",
    title: "Requirement Diagram",
    description: "Trace requirements to satisfying elements.",
    category: "requirement",
    order: 16,
  },
  {
    key: "sankey",
    title: "Energy Flow Sankey",
    description: "Extensive flow values between energy sources and uses.",
    category: "sankey",
    order: 17,
  },
  {
    key: "timeline",
    title: "Social Media Timeline",
    description: "Chronological introduction of major platforms.",
    category: "timeline",
    order: 18,
  },
  {
    key: "treemap",
    title: "Treemap Example",
    description: "Nested sections sized by numeric values.",
    category: "treemap",
    order: 19,
  },
  {
    key: "userJourney",
    title: "Working Day Journey",
    description: "Experience steps throughout a day.",
    category: "user-journey",
    order: 20,
  },
  {
    key: "xy",
    title: "Sales Revenue Chart",
    description: "XY beta chart depicting revenue over months.",
    category: "xy",
    order: 21,
  },
];

export const sampleDiagramsData = SAMPLE_METADATA.map((meta) => ({
  title: meta.title,
  description: meta.description,
  category: meta.category,
  order: meta.order,
  code: SAMPLE_DATA[meta.key].code,
}));

export async function seedSampleDiagrams() {
  try {
    await db.insert(sampleDiagrams).values(sampleDiagramsData).onConflictDoNothing();
  } catch (error) {
    console.error("Failed to seed sample diagrams", error);
  }
}
