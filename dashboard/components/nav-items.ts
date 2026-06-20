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

/** The six loop stages (+ ops), used to place each page on the pipeline. */
export type LoopStage = "overview" | "sense" | "qualify" | "craft" | "gate" | "act" | "observe" | "ops";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  built: boolean;
  /** one-line label shown in the header breadcrumb */
  blurb: string;
  /** which loop stage this page belongs to */
  stage: LoopStage;
  /** fuller plain-English description shown under the page title */
  description: string;
}

export const navItems: NavItem[] = [
  {
    href: "/",
    label: "Overview",
    icon: Activity,
    built: true,
    blurb: "North-star KPIs and the live activity stream.",
    stage: "overview",
    description:
      "The bird's-eye view of the whole machine: the one cost number we optimize, the pipeline funnel, and what's happening right now. Every figure is a live count from the database — no projections.",
  },
  {
    href: "/signals",
    label: "Signals",
    icon: Radar,
    built: true,
    blurb: "Raw GitHub threads found by discovery — before any judgment.",
    stage: "sense",
    description:
      "Every GitHub thread discovery found, before any AI judged it. Near-duplicates are collapsed under one head row so we never pursue the same problem twice.",
  },
  {
    href: "/candidates",
    label: "Candidates",
    icon: Compass,
    built: true,
    blurb: "Signals that passed triage, moving through qualify → craft → review.",
    stage: "sense",
    description:
      "Threads the cheap triage AI judged worth pursuing. Each one runs its own touch — qualify, craft, then the human gate. Click a candidate for its full history.",
  },
  {
    href: "/drafts",
    label: "Drafts",
    icon: FileEdit,
    built: true,
    blurb: "Replies waiting for human approval — nothing posts without it.",
    stage: "gate",
    description:
      "The human gate. Replies finished and waiting for a person to approve, edit, or reject. The disclosure line is highlighted, the guardrail scores are shown, and nothing here is public yet.",
  },
  {
    href: "/runs",
    label: "Runs",
    icon: Workflow,
    built: true,
    blurb: "Every workflow run: running, suspended at review, done, failed.",
    stage: "act",
    description:
      "The control tower. Every workflow run, sorted into running, awaiting review, done, and failed — with a step-by-step progress strip so you can see exactly where each one sits.",
  },
  {
    href: "/snippets",
    label: "Snippets",
    icon: Code2,
    built: true,
    blurb: "The validated code-template library every reply draws from.",
    stage: "craft",
    description:
      "The library of pre-tested code examples the Craft agent fills in — it never writes code freehand. Each one is re-run against the real VideoDB API nightly; broken ones drop out of rotation.",
  },
  {
    href: "/strategy",
    label: "Strategy",
    icon: Target,
    built: true,
    blurb: "The active metric strategy: search queries, rubric, attribution.",
    stage: "ops",
    description:
      "The system's mission statement, in one swappable place: what we search GitHub for, the rubric the AIs follow, the success event, and the attribution rules. Change this and the whole system hunts for something else.",
  },
  {
    href: "/experiments",
    label: "Experiments",
    icon: Beaker,
    built: true,
    blurb: "A/B variants and their funnels, joined to real outcomes.",
    stage: "observe",
    description:
      "The A/B tests we run to improve with evidence, not opinion. Each variant's funnel is joined to real activation outcomes so you can see which approach actually works.",
  },
  {
    href: "/costs",
    label: "Costs",
    icon: CircleDollarSign,
    built: true,
    blurb: "Every paid call, metered — the metric is cost per activated developer.",
    stage: "observe",
    description:
      "Every penny, metered the moment it's spent — AI calls and paid web research. This is the 'money spent' half of cost per activated developer, so it's measured, never estimated.",
  },
  {
    href: "/errors",
    label: "Errors",
    icon: AlertTriangle,
    built: true,
    blurb: "Caught failures from agents and workflows, with retry links.",
    stage: "ops",
    description:
      "Caught failures from agents and workflows — an AI hiccup, a GitHub limit, a failed search. The system fails visibly, never silently: each error keeps its context and can be re-queued.",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    built: true,
    blurb: "Models, database, GitHub budgets, safety switches.",
    stage: "ops",
    description:
      "The operator's toolbox: configured AI models, database health, GitHub rate budgets, data retention, and the safety switches that keep a human in control.",
  },
];

/** Find the nav item that owns a given pathname (longest-prefix match). */
export function navItemFor(pathname: string): NavItem | undefined {
  return (
    navItems.find((i) => i.href !== "/" && pathname.startsWith(i.href)) ??
    navItems.find((i) => i.href === pathname)
  );
}
