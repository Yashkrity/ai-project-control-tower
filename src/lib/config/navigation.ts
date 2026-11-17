import {
  CalendarCheck,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, description: "Portfolio health at a glance" },
  { label: "Projects", href: "/projects", icon: FolderKanban, description: "Create, edit and archive projects" },
  { label: "Tasks", href: "/tasks", icon: ListChecks, description: "Owners, priorities, due dates and dependencies" },
  { label: "Milestones", href: "/milestones", icon: CalendarCheck, description: "Planned vs actual delivery dates" },
  { label: "RAID log", href: "/raid", icon: ShieldAlert, description: "Risks, assumptions, issues and dependencies" },
];

export function isNavActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
