/**
 * Realistic demo portfolio. All dates are expressed as day offsets from
 * `today` so the portfolio always looks "live" regardless of when it runs.
 * Given the same `today`, the output is fully deterministic.
 */
import type {
  ISODate,
  Milestone,
  PortfolioData,
  Priority,
  Project,
  ProjectUpdate,
  AssumptionItem,
  DependencyItem,
  IssueItem,
  RaidItem,
  RiskItem,
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
  startOffset: number,
  plannedOffset: number,
  priority: Priority,
  actualOffset?: number,
];

export function buildDemoData(today: ISODate): PortfolioData {
  const d = (offset: number) => addDays(today, offset);
  const ts = (offset: number, hour: number) =>
    `${d(offset)}T${String(hour).padStart(2, "0")}:00:00.000Z`;

  const project = (
    p: Omit<Project, "startDate" | "targetEndDate" | "updatedAt" | "createdAt" | "archivedAt"> & {
      start: number;
      end: number;
      updated: number;
      archived?: number;
    },
  ): Project => {
    const { start, end, updated, archived, ...rest } = p;
    return {
      ...rest,
      startDate: d(start),
      targetEndDate: d(end),
      createdAt: ts(start, 8),
      updatedAt: ts(updated, 9),
      archivedAt: archived === undefined ? null : ts(archived, 17),
    };
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
    project({
      id: "prj-intranet",
      name: "Intranet Refresh",
      client: "Northwind Logistics",
      description: "Replaced the legacy SharePoint intranet with a modern employee hub.",
      projectManager: "Aisha Rahman",
      start: -400,
      end: -240,
      budget: 120_000,
      actualSpend: 131_500,
      status: "completed",
      health: "amber",
      updated: -200,
      archived: -200,
    }),
  ];

  // [id, title, plannedStart, plannedCompletion, priority, actualCompletion?]
  // Status is not stored: it is calculated from linked tasks and dates.
  const milestoneSpecs: Record<string, MilestoneSpec[]> = {
    "prj-erp": [
      ["ms-erp-1", "Solution blueprint signed off", -118, -85, "high", -82],
      ["ms-erp-2", "Finance module SIT complete", -80, -10, "high"],
      ["ms-erp-3", "Warehouse module UAT", -15, 25, "medium"],
      ["ms-erp-4", "Production cutover", 30, 85, "critical"],
    ],
    "prj-mobile": [
      ["ms-mob-1", "Design system approved", -74, -50, "high", -51],
      ["ms-mob-2", "Beta release to TestFlight", -45, 6, "high"],
      ["ms-mob-3", "App store launch", 5, 55, "critical"],
    ],
    "prj-data": [
      ["ms-dat-1", "Lakehouse foundation live", -148, -90, "high", -76],
      ["ms-dat-2", "Ingestion pipelines migrated", -90, -21, "critical"],
      ["ms-dat-3", "Clinical reports parity sign-off", -30, 12, "high"],
      ["ms-dat-4", "Legacy cluster decommissioned", 10, 30, "medium"],
    ],
    "prj-zt": [
      ["ms-zt-1", "Identity provider consolidated", -38, -5, "high", -6],
      ["ms-zt-2", "Device posture pilot (200 users)", -6, 18, "high"],
      ["ms-zt-3", "Full endpoint rollout", 15, 120, "medium"],
    ],
    "prj-crm": [
      ["ms-crm-1", "Data mapping workshop", -85, -60, "medium", -58],
      ["ms-crm-2", "Org merge dry run", -55, -15, "high"],
      ["ms-crm-3", "Global org go-live", 30, 70, "critical"],
    ],
    "prj-aisd": [
      ["ms-ai-1", "Pilot scope & success criteria", -9, 9, "high"],
      ["ms-ai-2", "Pilot go-live", 10, 75, "critical"],
    ],
    "prj-portal": [
      ["ms-por-1", "Broker beta", -200, -90, "high", -92],
      ["ms-por-2", "General availability", -90, -25, "critical", -21],
    ],
  };

  const pmOf = new Map(projects.map((p) => [p.id, p.projectManager]));
  const milestones: Milestone[] = Object.entries(milestoneSpecs).flatMap(([projectId, specs]) =>
    specs.map(([id, name, start, planned, priority, actual]) => ({
      id,
      projectId,
      name,
      description: "",
      owner: pmOf.get(projectId) ?? "Unassigned",
      priority,
      plannedStartDate: d(start),
      plannedDate: d(planned),
      actualDate: actual === undefined ? null : d(actual),
      notes: "",
      createdAt: ts(Math.min(start, -1), 8),
      updatedAt: ts(actual ?? Math.min(start, 0), 9),
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
      ["t-erp-07", "ms-erp-3", "UAT scripts for warehouse", "Grace Kim", "medium", "not_started", 0, 20, ["t-erp-06"]],
      ["t-erp-08", "ms-erp-4", "Cutover runbook", "Ravi Patel", "high", "not_started", 30, 70],
      ["t-erp-09", "ms-erp-4", "Hypercare rota", "Priya Sharma", "low", "not_started", 60, 80, ["t-erp-08"]],
    ],
    "prj-mobile": [
      ["t-mob-01", "ms-mob-1", "Component library in Figma", "Hana Ito", "high", "done", -74, -52],
      ["t-mob-02", null, "Loyalty API contract", "Tom Becker", "high", "done", -60, -40],
      ["t-mob-03", "ms-mob-2", "Saved baskets feature", "Tom Becker", "medium", "done", -45, -12, ["t-mob-02"]],
      ["t-mob-04", "ms-mob-2", "In-store pickup flow", "Nadia Aziz", "high", "in_progress", -25, 4],
      ["t-mob-05", "ms-mob-2", "Crash reporting & analytics", "Hana Ito", "medium", "done", -20, -5],
      ["t-mob-06", "ms-mob-3", "Accessibility audit fixes", "Nadia Aziz", "medium", "not_started", 5, 30, ["t-mob-04"]],
      ["t-mob-07", "ms-mob-3", "App store listing & screenshots", "Hana Ito", "low", "not_started", 35, 50],
      ["t-mob-08", null, "Push notification consent copy", "Tom Becker", "low", "in_progress", -6, -1],
    ],
    "prj-data": [
      ["t-dat-01", "ms-dat-1", "Provision workspace & Unity Catalog", "Owen Brooks", "critical", "done", -148, -95],
      ["t-dat-02", "ms-dat-2", "Migrate claims ingestion pipeline", "Elena Rossi", "critical", "done", -90, -45, ["t-dat-01"]],
      ["t-dat-03", "ms-dat-2", "Migrate pharmacy feed", "Elena Rossi", "high", "blocked", -60, -18, ["t-dat-02"]],
      ["t-dat-04", "ms-dat-2", "Migrate lab results stream", "Kwame Mensah", "critical", "in_progress", -50, -9, ["t-dat-02"]],
      ["t-dat-05", "ms-dat-3", "Rebuild readmission dashboards", "Ivy Nguyen", "high", "in_progress", -30, 5, ["t-dat-04"]],
      ["t-dat-06", "ms-dat-3", "Report parity test pack", "Ivy Nguyen", "high", "not_started", -10, 8, ["t-dat-05"]],
      ["t-dat-07", null, "Data quality rules for PHI fields", "Owen Brooks", "critical", "in_progress", -40, -3],
      ["t-dat-08", "ms-dat-4", "Decommission plan for Hadoop cluster", "Kwame Mensah", "medium", "not_started", 10, 28, ["t-dat-06"]],
    ],
    "prj-zt": [
      ["t-zt-01", "ms-zt-1", "Migrate SSO apps to Entra ID", "Carlos Diaz", "critical", "done", -38, -7],
      ["t-zt-02", "ms-zt-1", "Conditional access baseline", "Mei Tanaka", "high", "done", -30, -8],
      ["t-zt-03", "ms-zt-2", "Device compliance policies", "Mei Tanaka", "high", "in_progress", -6, 12, ["t-zt-02"]],
      ["t-zt-04", "ms-zt-2", "Pilot cohort comms", "Ben Harper", "medium", "not_started", 2, 14],
      ["t-zt-05", "ms-zt-3", "Network micro-segmentation design", "Carlos Diaz", "high", "not_started", 15, 60],
      ["t-zt-06", "ms-zt-3", "Endpoint rollout waves 1-4", "Ben Harper", "medium", "not_started", 45, 115, ["t-zt-03", "t-zt-05"]],
    ],
    "prj-crm": [
      ["t-crm-01", "ms-crm-1", "Field mapping across 3 orgs", "Julia Weber", "high", "done", -85, -62],
      ["t-crm-02", "ms-crm-2", "Duplicate account resolution rules", "Samir Haddad", "high", "blocked", -55, -20, ["t-crm-01"]],
      ["t-crm-03", "ms-crm-2", "Sandbox merge dry run", "Julia Weber", "critical", "not_started", -25, -15, ["t-crm-02"]],
      ["t-crm-04", "ms-crm-3", "Sales team training plan", "Aisha Rahman", "medium", "on_hold", 30, 60],
      ["t-crm-05", null, "Licence true-up with vendor", "Samir Haddad", "low", "done", -70, -50],
    ],
    "prj-aisd": [
      ["t-ai-01", "ms-ai-1", "Collect 6 months of ticket history", "Noah Fischer", "medium", "done", -9, -3],
      ["t-ai-02", "ms-ai-1", "Define deflection KPIs", "Priya Sharma", "high", "in_progress", -5, 7],
      ["t-ai-03", "ms-ai-1", "Security & data residency review", "Mei Tanaka", "critical", "not_started", 0, 9],
      ["t-ai-04", "ms-ai-2", "Prototype triage prompts", "Noah Fischer", "medium", "not_started", 10, 40, ["t-ai-02"]],
    ],
    "prj-portal": [
      ["t-por-01", "ms-por-1", "Broker authentication", "Tom Becker", "critical", "done", -200, -120],
      ["t-por-02", "ms-por-1", "Quote engine integration", "Nadia Aziz", "high", "done", -170, -95],
      ["t-por-03", "ms-por-2", "Commission statements module", "Tom Becker", "high", "done", -90, -40],
      ["t-por-04", "ms-por-2", "Load testing", "Hana Ito", "medium", "done", -45, -28],
      ["t-por-05", "ms-por-2", "Go-live support", "Daniel Okafor", "medium", "done", -25, -21],
    ],
    "prj-intranet": [
      ["t-int-01", null, "Content migration", "Grace Kim", "medium", "done", -380, -280],
      ["t-int-02", null, "Launch communications", "Aisha Rahman", "low", "done", -260, -245],
    ],
  };

  /** Days between due date and actual completion for done tasks (+ = late). */
  const completionSlip: Record<string, number> = {
    "t-erp-02": 3,
    "t-erp-03": 5,
    "t-mob-01": -2,
    "t-dat-01": 6,
    "t-dat-02": 9,
    "t-zt-01": -1,
    "t-crm-01": 4,
    "t-por-04": 2,
  };

  const tasks: Task[] = Object.entries(taskSpecs).flatMap(([projectId, specs]) =>
    specs.map(([id, milestoneId, title, owner, priority, status, start, due, dependsOn = []]) => {
      const completed = status === "done" ? Math.min(-1, due + (completionSlip[id] ?? 0)) : null;
      return {
        id,
        projectId,
        milestoneId,
        title,
        description: "",
        owner,
        priority,
        status,
        startDate: d(start),
        dueDate: d(due),
        completedDate: completed === null ? null : d(completed),
        dependsOn,
        createdAt: ts(Math.min(start, -1), 8),
        updatedAt: ts(completed ?? Math.min(start, 0), 9),
      };
    }),
  );

  // Shared RAID fields; offsets are days from today (null = not set).
  type Base = {
    id: string;
    ref: string;
    projectId: string;
    title: string;
    description: string;
    owner: string;
    target: number | null;
    resolved?: number;
    milestoneId?: string;
    taskId?: string;
    plan: string;
    latestUpdate?: string;
    created: number;
  };
  const base = (b: Base) => ({
    id: b.id,
    ref: b.ref,
    projectId: b.projectId,
    title: b.title,
    description: b.description,
    owner: b.owner,
    targetDate: b.target === null ? null : d(b.target),
    resolvedDate: b.resolved === undefined ? null : d(b.resolved),
    milestoneId: b.milestoneId ?? null,
    taskId: b.taskId ?? null,
    plan: b.plan,
    latestUpdate: b.latestUpdate ?? "",
    createdAt: ts(b.created, 9),
    updatedAt: ts(Math.max(b.created, b.resolved ?? -1), 11),
  });
  const risk = (b: Base, r: Pick<RiskItem, "status" | "probability" | "impact" | "contingency">): RiskItem => ({ ...base(b), type: "risk", ...r });
  const assumption = (b: Base, a: Pick<AssumptionItem, "status" | "priority" | "validationNotes">): AssumptionItem => ({ ...base(b), type: "assumption", ...a });
  const issue = (b: Base, i: Pick<IssueItem, "status" | "priority" | "businessImpact" | "escalationReason"> & { escalated?: number }): IssueItem => {
    const { escalated, ...rest } = i;
    return { ...base(b), type: "issue", ...rest, escalatedDate: escalated === undefined ? null : d(escalated) };
  };
  const dependency = (
    b: Base,
    x: Pick<DependencyItem, "status" | "priority" | "direction" | "requiredFrom" | "impactIfUnfulfilled" | "escalationOwner">,
  ): DependencyItem => ({ ...base(b), type: "dependency", ...x });

  const raidItems: RaidItem[] = [
    risk(
      { id: "raid-r1", ref: "R-001", projectId: "prj-erp", title: "Finance data quality may delay cutover", description: "Legacy GL contains about 4% unreconciled entries that must be cleared before migration.", owner: "Ravi Patel", target: 5, milestoneId: "ms-erp-4", taskId: "t-erp-04", plan: "Weekly reconciliation sprints with the client finance team.", latestUpdate: "Unreconciled entries down to 2.1%.", created: -60 },
      { status: "mitigating", probability: 3, impact: 4, contingency: "Migrate open balances only and reconcile history post go-live." },
    ),
    risk(
      { id: "raid-r2", ref: "R-002", projectId: "prj-data", title: "Budget exhausted before decommission", description: "Spend is at 96% with two milestones outstanding.", owner: "Sofia Martinez", target: -2, milestoneId: "ms-dat-4", plan: "Change request for additional funding raised with the sponsor.", latestUpdate: "Awaiting steering committee decision.", created: -20 },
      { status: "open", probability: 5, impact: 4, contingency: "Defer Hadoop decommission to a follow-on phase." },
    ),
    risk(
      { id: "raid-r3", ref: "R-003", projectId: "prj-data", title: "Clinical sign-off availability", description: "Clinical SMEs have limited availability in the next month.", owner: "Ivy Nguyen", target: 6, milestoneId: "ms-dat-3", plan: "Pre-book review slots; prepare an asynchronous sign-off pack.", created: -15 },
      { status: "open", probability: 3, impact: 4, contingency: "Escalate to the chief medical officer for delegated sign-off." },
    ),
    risk(
      { id: "raid-r4", ref: "R-004", projectId: "prj-zt", title: "User friction from MFA prompts", description: "Pilot users may push back on additional sign-in prompts.", owner: "Ben Harper", target: 20, milestoneId: "ms-zt-2", plan: "Phased policies and clear communications.", created: -30 },
      { status: "mitigating", probability: 3, impact: 2, contingency: "Relax prompt frequency for low-risk apps." },
    ),
    risk(
      { id: "raid-r5", ref: "R-005", projectId: "prj-mobile", title: "App store review rejection", description: "New loyalty features may trigger additional App Store review.", owner: "Hana Ito", target: 12, milestoneId: "ms-mob-3", plan: "Pre-submission review against current store guidelines.", created: -10 },
      { status: "open", probability: 2, impact: 5, contingency: "Ship without loyalty features and enable them by remote config." },
    ),
    risk(
      { id: "raid-r6", ref: "R-006", projectId: "prj-portal", title: "Broker adoption below target", description: "Brokers may keep using email for quotes.", owner: "Daniel Okafor", target: -20, resolved: -15, plan: "Broker training webinars.", latestUpdate: "Adoption reached 82%; risk closed.", created: -120 },
      { status: "closed", probability: 2, impact: 2, contingency: "" },
    ),
    assumption(
      { id: "raid-a1", ref: "A-001", projectId: "prj-mobile", title: "Loyalty API stays on v3", description: "The loyalty API will remain on v3 with no breaking changes before launch.", owner: "Tom Becker", target: 10, taskId: "t-mob-04", plan: "Confirm in writing with the loyalty platform owner.", created: -40 },
      { status: "pending", priority: "medium", validationNotes: "" },
    ),
    assumption(
      { id: "raid-a2", ref: "A-002", projectId: "prj-erp", title: "Client finance team available for UAT", description: "Two client finance users are available full-time during warehouse UAT.", owner: "Priya Sharma", target: -3, milestoneId: "ms-erp-3", plan: "Confirm named users with the client finance director.", created: -25 },
      { status: "pending", priority: "high", validationNotes: "" },
    ),
    assumption(
      { id: "raid-a3", ref: "A-003", projectId: "prj-aisd", title: "Ticket history is representative", description: "Six months of tickets reflect the request mix the pilot will see.", owner: "Noah Fischer", target: -2, resolved: -2, taskId: "t-ai-01", plan: "Compare category mix against the prior year.", created: -9 },
      { status: "validated", priority: "medium", validationNotes: "Category mix within 3% of the prior 12 months." },
    ),
    issue(
      { id: "raid-i1", ref: "I-001", projectId: "prj-data", title: "Pharmacy vendor feed schema changed", description: "The vendor shipped an unannounced schema change; the pipeline is blocked.", owner: "Elena Rossi", target: 5, taskId: "t-dat-03", plan: "Vendor fix due next week; interim manual load approved.", latestUpdate: "Vendor has acknowledged the defect.", created: -6 },
      { status: "escalated", priority: "critical", businessImpact: "No pharmacy data in the lakehouse; parity sign-off at risk.", escalationReason: "Vendor missed two committed fix dates.", escalated: -3 },
    ),
    issue(
      { id: "raid-i2", ref: "I-002", projectId: "prj-crm", title: "Programme paused pending re-org", description: "The client's sales re-organisation changes the account ownership model.", owner: "Aisha Rahman", target: -1, plan: "Awaiting the new org chart from client HR.", created: -5 },
      { status: "investigating", priority: "high", businessImpact: "Merge rules cannot be finalised; go-live date at risk.", escalationReason: "" },
    ),
    issue(
      { id: "raid-i3", ref: "I-003", projectId: "prj-erp", title: "SIT defects above exit threshold", description: "42 open defects against an exit threshold of 15.", owner: "Leah Chen", target: 7, milestoneId: "ms-erp-2", taskId: "t-erp-05", plan: "Daily triage; vendor adds two developers.", created: -8 },
      { status: "open", priority: "high", businessImpact: "Finance SIT exit is delayed.", escalationReason: "" },
    ),
    issue(
      { id: "raid-i4", ref: "I-004", projectId: "prj-portal", title: "Load test failed at 500 users", description: "Quote engine timed out under load.", owner: "Hana Ito", target: -30, resolved: -29, taskId: "t-por-04", plan: "Add caching and scale the quote service.", latestUpdate: "Retest passed at 1,200 users.", created: -35 },
      { status: "closed", priority: "high", businessImpact: "GA could not proceed.", escalationReason: "" },
    ),
    dependency(
      { id: "raid-d1", ref: "D-001", projectId: "prj-erp", title: "Azure landing zone from client IT", description: "The production subscription must be ready before the cutover rehearsal.", owner: "Marcus Lee", target: 40, milestoneId: "ms-erp-4", plan: "Weekly checkpoint with client IT.", created: -50 },
      { status: "in_progress", priority: "high", direction: "external", requiredFrom: "Northwind Logistics IT", impactIfUnfulfilled: "Cutover rehearsal cannot start.", escalationOwner: "Priya Sharma" },
    ),
    dependency(
      { id: "raid-d2", ref: "D-002", projectId: "prj-aisd", title: "Data residency approval", description: "Legal must approve the model hosting region.", owner: "Mei Tanaka", target: 9, taskId: "t-ai-03", plan: "Review scheduled with legal.", latestUpdate: "Legal requested a DPIA before review.", created: -8 },
      { status: "blocked", priority: "critical", direction: "external", requiredFrom: "Harbor Financial Legal", impactIfUnfulfilled: "Pilot cannot go live in any region.", escalationOwner: "Priya Sharma" },
    ),
    dependency(
      { id: "raid-d3", ref: "D-003", projectId: "prj-zt", title: "Device management licences", description: "Additional endpoint licences for the full rollout.", owner: "Carlos Diaz", target: 14, milestoneId: "ms-zt-3", plan: "Purchase order raised.", created: -12 },
      { status: "pending", priority: "medium", direction: "external", requiredFrom: "Microsoft (licensing partner)", impactIfUnfulfilled: "Rollout waves 2-4 cannot start.", escalationOwner: "James Whitfield" },
    ),
    dependency(
      { id: "raid-d4", ref: "D-004", projectId: "prj-mobile", title: "Loyalty platform sandbox", description: "Sandbox environment with test member accounts.", owner: "Tom Becker", target: -45, resolved: -44, plan: "Request via the loyalty team backlog.", created: -70 },
      { status: "fulfilled", priority: "medium", direction: "internal", requiredFrom: "Apex Retail loyalty team", impactIfUnfulfilled: "Saved baskets could not be tested.", escalationOwner: "Daniel Okafor" },
    ),
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
