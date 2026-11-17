/**
 * Realistic demo portfolio. All dates are expressed as day offsets from
 * `today` so the portfolio always looks "live" regardless of when it runs.
 * Given the same `today`, the output is fully deterministic.
 */
import type {
  ISODate,
  Milestone,
  MilestoneStatus,
  PortfolioData,
  Priority,
  Project,
  ProjectUpdate,
  RaidItem,
  Task,
  TaskStatus,
  UpdateKind,
} from "@/lib/types";
import { addDays } from "@/lib/utils/dates";

type TaskSpec = [
  id: string,
  milestoneId: string | null,
  title: string,
  owner: string,
  priority: Priority,
  status: TaskStatus,
  startOffset: number,
  dueOffset: number,
  dependsOn?: string[],
];

type MilestoneSpec = [
  id: string,
  name: string,
  plannedOffset: number,
  status: MilestoneStatus,
  actualOffset?: number,
];

export function buildDemoData(today: ISODate): PortfolioData {
  const d = (offset: number) => addDays(today, offset);
  const ts = (offset: number, hour: number) =>
    `${d(offset)}T${String(hour).padStart(2, "0")}:00:00.000Z`;

  const project = (
    p: Omit<Project, "startDate" | "targetEndDate" | "updatedAt"> & {
      start: number;
      end: number;
      updated: number;
    },
  ): Project => {
    const { start, end, updated, ...rest } = p;
    return { ...rest, startDate: d(start), targetEndDate: d(end), updatedAt: ts(updated, 9) };
  };

  const projects: Project[] = [
    project({
      id: "prj-erp",
      name: "ERP Cloud Migration",
      client: "Northwind Logistics",
      description:
        "Lift-and-modernise the on-prem SAP ECC estate to S/4HANA on Azure, including finance and warehouse modules.",
      projectManager: "Priya Sharma",
      start: -120,
      end: 90,
      budget: 1_200_000,
      actualSpend: 742_000,
      status: "active",
      health: "amber",
      updated: -1,
    }),
    project({
      id: "prj-mobile",
      name: "Customer Mobile App v2",
      client: "Apex Retail Group",
      description:
        "Rebuild of the iOS/Android shopping app with loyalty integration, saved baskets and in-store pickup.",
      projectManager: "Daniel Okafor",
      start: -75,
      end: 60,
      budget: 450_000,
      actualSpend: 236_500,
      status: "active",
      health: "green",
      updated: 0,
    }),
    project({
      id: "prj-data",
      name: "Data Platform Modernisation",
      client: "Meridian Health",
      description:
        "Replace legacy Hadoop pipelines with a governed lakehouse on Databricks and migrate 40+ clinical reports.",
      projectManager: "Sofia Martinez",
      start: -150,
      end: 30,
      budget: 900_000,
      actualSpend: 861_000,
      status: "active",
      health: "red",
      updated: 0,
    }),
    project({
      id: "prj-zt",
      name: "Zero Trust Security Rollout",
      client: "Harbor Financial",
      description:
        "Identity-centric access controls, device posture checks and micro-segmentation across 3,200 endpoints.",
      projectManager: "James Whitfield",
      start: -40,
      end: 140,
      budget: 650_000,
      actualSpend: 148_000,
      status: "active",
      health: "green",
      updated: -2,
    }),
    project({
      id: "prj-crm",
      name: "CRM Consolidation",
      client: "Summit Energy",
      description:
        "Merge three regional Salesforce orgs into a single global org with unified account hierarchy.",
      projectManager: "Aisha Rahman",
      start: -90,
      end: 75,
      budget: 380_000,
      actualSpend: 141_000,
      status: "on_hold",
      health: "amber",
      updated: -4,
    }),
    project({
      id: "prj-aisd",
      name: "AI Service Desk Pilot",
      client: "Harbor Financial",
      description:
        "Pilot an LLM-assisted triage layer for the IT service desk, scoped to password and access requests.",
      projectManager: "Priya Sharma",
      start: -10,
      end: 120,
      budget: 220_000,
      actualSpend: 18_500,
      status: "planning",
      health: "green",
      updated: -3,
    }),
    project({
      id: "prj-portal",
      name: "Partner Portal Launch",
      client: "Brightline Insurance",
      description: "Self-service broker portal for quotes, policy documents and commission statements.",
      projectManager: "Daniel Okafor",
      start: -210,
      end: -20,
      budget: 300_000,
      actualSpend: 287_400,
      status: "completed",
      health: "green",
      updated: -18,
    }),
  ];

  const milestoneSpecs: Record<string, MilestoneSpec[]> = {
    "prj-erp": [
      ["ms-erp-1", "Solution blueprint signed off", -85, "completed", -82],
      ["ms-erp-2", "Finance module SIT complete", -10, "in_progress"],
      ["ms-erp-3", "Warehouse module UAT", 25, "not_started"],
      ["ms-erp-4", "Production cutover", 85, "not_started"],
    ],
    "prj-mobile": [
      ["ms-mob-1", "Design system approved", -50, "completed", -51],
      ["ms-mob-2", "Beta release to TestFlight", 6, "in_progress"],
      ["ms-mob-3", "App store launch", 55, "not_started"],
    ],
    "prj-data": [
      ["ms-dat-1", "Lakehouse foundation live", -90, "completed", -76],
      ["ms-dat-2", "Ingestion pipelines migrated", -21, "in_progress"],
      ["ms-dat-3", "Clinical reports parity sign-off", 12, "not_started"],
      ["ms-dat-4", "Legacy cluster decommissioned", 30, "not_started"],
    ],
    "prj-zt": [
      ["ms-zt-1", "Identity provider consolidated", -5, "completed", -6],
      ["ms-zt-2", "Device posture pilot (200 users)", 18, "in_progress"],
      ["ms-zt-3", "Full endpoint rollout", 120, "not_started"],
    ],
    "prj-crm": [
      ["ms-crm-1", "Data mapping workshop", -60, "completed", -60],
      ["ms-crm-2", "Org merge dry run", -15, "not_started"],
      ["ms-crm-3", "Global org go-live", 70, "not_started"],
    ],
    "prj-aisd": [
      ["ms-ai-1", "Pilot scope & success criteria", 9, "in_progress"],
      ["ms-ai-2", "Pilot go-live", 75, "not_started"],
    ],
    "prj-portal": [
      ["ms-por-1", "Broker beta", -90, "completed", -92],
      ["ms-por-2", "General availability", -25, "completed", -21],
    ],
  };

  const milestones: Milestone[] = Object.entries(milestoneSpecs).flatMap(([projectId, specs]) =>
    specs.map(([id, name, planned, status, actual]) => ({
      id,
      projectId,
      name,
      plannedDate: d(planned),
      actualDate: actual === undefined ? null : d(actual),
      status,
    })),
  );

  const taskSpecs: Record<string, TaskSpec[]> = {
    "prj-erp": [
      ["t-erp-01", "ms-erp-1", "Current-state process mapping", "Leah Chen", "high", "done", -118, -100],
      ["t-erp-02", "ms-erp-1", "Target architecture design", "Marcus Lee", "critical", "done", -100, -85, ["t-erp-01"]],
      ["t-erp-03", "ms-erp-2", "Configure GL and cost centres", "Leah Chen", "high", "done", -80, -40, ["t-erp-02"]],
      ["t-erp-04", "ms-erp-2", "Finance data migration rehearsal", "Ravi Patel", "critical", "in_progress", -35, -6, ["t-erp-03"]],
      ["t-erp-05", "ms-erp-2", "Finance SIT defect triage", "Leah Chen", "high", "in_progress", -20, -2, ["t-erp-04"]],
      ["t-erp-06", "ms-erp-3", "Warehouse picking workflow config", "Marcus Lee", "medium", "in_progress", -15, 14],
      ["t-erp-07", "ms-erp-3", "UAT scripts for warehouse", "Grace Kim", "medium", "todo", 0, 20, ["t-erp-06"]],
      ["t-erp-08", "ms-erp-4", "Cutover runbook", "Ravi Patel", "high", "todo", 30, 70],
      ["t-erp-09", "ms-erp-4", "Hypercare rota", "Priya Sharma", "low", "todo", 60, 80, ["t-erp-08"]],
    ],
    "prj-mobile": [
      ["t-mob-01", "ms-mob-1", "Component library in Figma", "Hana Ito", "high", "done", -74, -52],
      ["t-mob-02", null, "Loyalty API contract", "Tom Becker", "high", "done", -60, -40],
      ["t-mob-03", "ms-mob-2", "Saved baskets feature", "Tom Becker", "medium", "done", -45, -12, ["t-mob-02"]],
      ["t-mob-04", "ms-mob-2", "In-store pickup flow", "Nadia Aziz", "high", "in_progress", -25, 4],
      ["t-mob-05", "ms-mob-2", "Crash reporting & analytics", "Hana Ito", "medium", "done", -20, -5],
      ["t-mob-06", "ms-mob-3", "Accessibility audit fixes", "Nadia Aziz", "medium", "todo", 5, 30, ["t-mob-04"]],
      ["t-mob-07", "ms-mob-3", "App store listing & screenshots", "Hana Ito", "low", "todo", 35, 50],
      ["t-mob-08", null, "Push notification consent copy", "Tom Becker", "low", "in_progress", -6, -1],
    ],
    "prj-data": [
      ["t-dat-01", "ms-dat-1", "Provision workspace & Unity Catalog", "Owen Brooks", "critical", "done", -148, -95],
      ["t-dat-02", "ms-dat-2", "Migrate claims ingestion pipeline", "Elena Rossi", "critical", "done", -90, -45, ["t-dat-01"]],
      ["t-dat-03", "ms-dat-2", "Migrate pharmacy feed", "Elena Rossi", "high", "blocked", -60, -18, ["t-dat-02"]],
      ["t-dat-04", "ms-dat-2", "Migrate lab results stream", "Kwame Mensah", "critical", "in_progress", -50, -9, ["t-dat-02"]],
      ["t-dat-05", "ms-dat-3", "Rebuild readmission dashboards", "Ivy Nguyen", "high", "in_progress", -30, 5, ["t-dat-04"]],
      ["t-dat-06", "ms-dat-3", "Report parity test pack", "Ivy Nguyen", "high", "todo", -10, 8, ["t-dat-05"]],
      ["t-dat-07", null, "Data quality rules for PHI fields", "Owen Brooks", "critical", "in_progress", -40, -3],
      ["t-dat-08", "ms-dat-4", "Decommission plan for Hadoop cluster", "Kwame Mensah", "medium", "todo", 10, 28, ["t-dat-06"]],
    ],
    "prj-zt": [
      ["t-zt-01", "ms-zt-1", "Migrate SSO apps to Entra ID", "Carlos Diaz", "critical", "done", -38, -7],
      ["t-zt-02", "ms-zt-1", "Conditional access baseline", "Mei Tanaka", "high", "done", -30, -8],
      ["t-zt-03", "ms-zt-2", "Device compliance policies", "Mei Tanaka", "high", "in_progress", -6, 12, ["t-zt-02"]],
      ["t-zt-04", "ms-zt-2", "Pilot cohort comms", "Ben Harper", "medium", "todo", 2, 14],
      ["t-zt-05", "ms-zt-3", "Network micro-segmentation design", "Carlos Diaz", "high", "todo", 15, 60],
      ["t-zt-06", "ms-zt-3", "Endpoint rollout waves 1-4", "Ben Harper", "medium", "todo", 45, 115, ["t-zt-03", "t-zt-05"]],
    ],
    "prj-crm": [
      ["t-crm-01", "ms-crm-1", "Field mapping across 3 orgs", "Julia Weber", "high", "done", -85, -62],
      ["t-crm-02", "ms-crm-2", "Duplicate account resolution rules", "Samir Haddad", "high", "blocked", -55, -20, ["t-crm-01"]],
      ["t-crm-03", "ms-crm-2", "Sandbox merge dry run", "Julia Weber", "critical", "todo", -25, -15, ["t-crm-02"]],
      ["t-crm-04", "ms-crm-3", "Sales team training plan", "Aisha Rahman", "medium", "todo", 30, 60],
      ["t-crm-05", null, "Licence true-up with vendor", "Samir Haddad", "low", "done", -70, -50],
    ],
    "prj-aisd": [
      ["t-ai-01", "ms-ai-1", "Collect 6 months of ticket history", "Noah Fischer", "medium", "done", -9, -3],
      ["t-ai-02", "ms-ai-1", "Define deflection KPIs", "Priya Sharma", "high", "in_progress", -5, 7],
      ["t-ai-03", "ms-ai-1", "Security & data residency review", "Mei Tanaka", "critical", "todo", 0, 9],
      ["t-ai-04", "ms-ai-2", "Prototype triage prompts", "Noah Fischer", "medium", "todo", 10, 40, ["t-ai-02"]],
    ],
    "prj-portal": [
      ["t-por-01", "ms-por-1", "Broker authentication", "Tom Becker", "critical", "done", -200, -120],
      ["t-por-02", "ms-por-1", "Quote engine integration", "Nadia Aziz", "high", "done", -170, -95],
      ["t-por-03", "ms-por-2", "Commission statements module", "Tom Becker", "high", "done", -90, -40],
      ["t-por-04", "ms-por-2", "Load testing", "Hana Ito", "medium", "done", -45, -28],
      ["t-por-05", "ms-por-2", "Go-live support", "Daniel Okafor", "medium", "done", -25, -21],
    ],
  };

  const tasks: Task[] = Object.entries(taskSpecs).flatMap(([projectId, specs]) =>
    specs.map(([id, milestoneId, title, owner, priority, status, start, due, dependsOn = []]) => ({
      id,
      projectId,
      milestoneId,
      title,
      owner,
      priority,
      status,
      startDate: d(start),
      dueDate: d(due),
      completedDate: status === "done" ? d(due) : null,
      dependsOn,
    })),
  );

  const raid = (
    item: Omit<RaidItem, "targetDate"> & { target: number | null },
  ): RaidItem => {
    const { target, ...rest } = item;
    return { ...rest, targetDate: target === null ? null : d(target) };
  };

  const raidItems: RaidItem[] = [
    raid({ id: "r-erp-1", projectId: "prj-erp", type: "risk", title: "Finance data quality may delay cutover", description: "Legacy GL contains ~4% unreconciled entries.", owner: "Ravi Patel", severity: "high", probability: "medium", impact: "high", mitigation: "Run weekly reconciliation sprints with client finance team.", status: "open", target: 21 }),
    raid({ id: "r-erp-2", projectId: "prj-erp", type: "dependency", title: "Azure landing zone from client IT", description: "Production subscription must be ready before cutover rehearsal.", owner: "Marcus Lee", severity: "medium", probability: "low", impact: "high", mitigation: "Escalated to client CIO; weekly checkpoint.", status: "monitoring", target: 40 }),
    raid({ id: "r-mob-1", projectId: "prj-mobile", type: "assumption", title: "Loyalty API stays on v3", description: "Client confirmed no breaking changes before launch.", owner: "Tom Becker", severity: "low", probability: "low", impact: "medium", mitigation: "Contract tests in CI.", status: "open", target: 55 }),
    raid({ id: "r-dat-1", projectId: "prj-data", type: "issue", title: "Pharmacy vendor feed schema changed", description: "Vendor shipped an unannounced schema change; pipeline blocked.", owner: "Elena Rossi", severity: "high", probability: "high", impact: "high", mitigation: "Vendor fix due next week; interim manual load approved.", status: "open", target: 5 }),
    raid({ id: "r-dat-2", projectId: "prj-data", type: "risk", title: "Budget exhausted before decommission", description: "Spend at 96% with 2 milestones outstanding.", owner: "Sofia Martinez", severity: "high", probability: "high", impact: "high", mitigation: "Change request for additional funding raised with sponsor.", status: "open", target: 10 }),
    raid({ id: "r-dat-3", projectId: "prj-data", type: "risk", title: "Clinical sign-off availability", description: "Clinical SMEs have limited availability in the next month.", owner: "Ivy Nguyen", severity: "medium", probability: "medium", impact: "high", mitigation: "Pre-book review slots; async sign-off pack.", status: "open", target: 12 }),
    raid({ id: "r-zt-1", projectId: "prj-zt", type: "risk", title: "User friction from MFA prompts", description: "Pilot users may push back on additional prompts.", owner: "Ben Harper", severity: "medium", probability: "medium", impact: "medium", mitigation: "Phased policies and clear comms.", status: "monitoring", target: 20 }),
    raid({ id: "r-crm-1", projectId: "prj-crm", type: "issue", title: "Programme paused pending re-org", description: "Client sales re-organisation changes account ownership model.", owner: "Aisha Rahman", severity: "high", probability: "high", impact: "medium", mitigation: "Awaiting new org chart from client HR.", status: "open", target: 14 }),
    raid({ id: "r-ai-1", projectId: "prj-aisd", type: "dependency", title: "Data residency approval", description: "Legal must approve the model hosting region.", owner: "Mei Tanaka", severity: "high", probability: "medium", impact: "high", mitigation: "Review scheduled with legal.", status: "open", target: 9 }),
  ];

  const update = (
    id: string,
    projectId: string,
    author: string,
    kind: UpdateKind,
    summary: string,
    dayOffset: number,
    hour: number,
  ): ProjectUpdate => ({ id, projectId, author, kind, summary, createdAt: ts(dayOffset, hour) });

  const updates: ProjectUpdate[] = [
    update("u-01", "prj-data", "Sofia Martinez", "status", "Health moved to Red: pharmacy feed blocked and budget at 96%.", 0, 10),
    update("u-02", "prj-mobile", "Daniel Okafor", "milestone", "Beta build submitted to TestFlight review.", 0, 8),
    update("u-03", "prj-erp", "Priya Sharma", "risk", "Finance SIT slipped; data migration rehearsal still running.", -1, 16),
    update("u-04", "prj-zt", "James Whitfield", "milestone", "Identity provider consolidation completed a day early.", -2, 11),
    update("u-05", "prj-aisd", "Priya Sharma", "decision", "Pilot scope limited to password and access requests.", -3, 14),
    update("u-06", "prj-crm", "Aisha Rahman", "status", "Project placed on hold pending client sales re-org.", -4, 9),
    update("u-07", "prj-data", "Elena Rossi", "risk", "Vendor confirmed schema change on pharmacy feed.", -5, 15),
    update("u-08", "prj-erp", "Marcus Lee", "general", "Warehouse workflow configuration started.", -7, 10),
    update("u-09", "prj-portal", "Daniel Okafor", "status", "Project closed; lessons-learned report shared.", -18, 12),
  ];

  return { projects, tasks, milestones, raidItems, updates };
}
