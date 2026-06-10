import {
  Activity,
  AlertTriangle,
  Beaker,
  CircleDollarSign,
  Code2,
  Compass,
  FileEdit,
  Radar,
  Settings,
  Target,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  built: boolean;
  /** one-line definition shown in the header under the page title */
  blurb: string;
}

export const navItems: NavItem[] = [
  {
    href: "/",
    label: "Overview",
    icon: Activity,
    built: true,
    blurb: "North-star KPIs and the live activity stream.",
  },
  {
    href: "/signals",
    label: "Signals",
    icon: Radar,
    built: true,
    blurb: "Raw GitHub threads found by discovery — before any judgment.",
  },
  {
    href: "/candidates",
    label: "Candidates",
    icon: Compass,
    built: true,
    blurb: "Signals that passed triage, moving through qualify → craft → review.",
  },
  {
    href: "/drafts",
    label: "Drafts",
    icon: FileEdit,
    built: true,
    blurb: "Replies waiting for human approval — nothing posts without it.",
  },
  {
    href: "/runs",
    label: "Runs",
    icon: Workflow,
    built: true,
    blurb: "Every workflow run: running, suspended at review, done, failed.",
  },
  {
    href: "/snippets",
    label: "Snippets",
    icon: Code2,
    built: true,
    blurb: "The validated code-template library every reply draws from.",
  },
  {
    href: "/strategy",
    label: "Strategy",
    icon: Target,
    built: true,
    blurb: "The active metric strategy: search queries, rubric, attribution.",
  },
  {
    href: "/experiments",
    label: "Experiments",
    icon: Beaker,
    built: true,
    blurb: "A/B variants and their funnels, joined to real outcomes.",
  },
  {
    href: "/costs",
    label: "Costs",
    icon: CircleDollarSign,
    built: true,
    blurb: "Every paid call, metered — the metric is cost per activated developer.",
  },
  {
    href: "/errors",
    label: "Errors",
    icon: AlertTriangle,
    built: true,
    blurb: "Caught failures from agents and workflows, with retry links.",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    built: true,
    blurb: "Models, database, GitHub budgets, safety switches.",
  },
];
