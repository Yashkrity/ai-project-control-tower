import { Suspense } from "react";
import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { getRepository, getToday } from "@/lib/data";
import { buildPortfolioSummary } from "@/lib/metrics/portfolio";
import { formatDate } from "@/lib/utils/dates";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { HealthBreakdown } from "@/components/dashboard/health-breakdown";
import { ProgressChart, type ProgressDatum } from "@/components/dashboard/progress-chart";
import { ProjectTable } from "@/components/dashboard/project-table";
import { OverdueTasks } from "@/components/dashboard/overdue-tasks";
import { UpcomingMilestones } from "@/components/dashboard/upcoming-milestones";
import { RecentUpdates } from "@/components/dashboard/recent-updates";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

export const metadata: Metadata = { title: "Portfolio dashboard" };

const MILESTONE_HORIZON_DAYS = 30;

async function DashboardContent() {
  const today = await getToday();
  const repo = await getRepository(today);
  const data = await repo.getPortfolio();
  const summary = buildPortfolioSummary(data, today, {
    milestoneHorizonDays: MILESTONE_HORIZON_DAYS,
  });

  const chartData: ProgressDatum[] = summary.projects
    .filter((p) => p.project.status !== "completed")
    .map((p) => ({
      name: p.project.name,
      progress: Math.round(p.progress.percent),
      scheduleElapsed: p.scheduleElapsed,
      completed: p.progress.completed,
      total: p.progress.total,
    }));

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">
        Figures calculated from live project, task and milestone records as of{" "}
        <span className="font-medium text-slate-700">{formatDate(summary.today)}</span>
        {repo.source === "demo" && " · demo data"}
      </p>

      <KpiCards summary={summary} />

      <div className="grid gap-6 lg:grid-cols-3">
        <HealthBreakdown summary={summary} />
        <Card className="lg:col-span-2">
          <CardHeader title="Progress by project" description="Active projects · share of tasks completed" />
          <CardBody>
            {chartData.length === 0 ? (
              <EmptyState icon={BarChart3} title="No active projects" description="Progress appears once projects have tasks." />
            ) : (
              <ProgressChart data={chartData} />
            )}
          </CardBody>
        </Card>
      </div>

      <ProjectTable projects={summary.projects} />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <OverdueTasks rows={summary.overdueTasks} />
        <UpcomingMilestones rows={summary.upcomingMilestones} horizonDays={MILESTONE_HORIZON_DAYS} />
        <RecentUpdates rows={summary.recentUpdates} today={summary.today} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio dashboard"
        description="Health, delivery progress, milestones and overdue work across all projects."
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
