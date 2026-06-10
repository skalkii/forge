import type { MetricStrategy } from "../types";

/**
 * GitHub → Usage: find devs hand-rolling what VideoDB does natively,
 * measure cost per developer reaching first_successful_api_call.
 *
 * Queries are starting points (R10): decomposed into qualifier form and
 * false-positive-checked against live GitHub search at commit 20 (V4).
 */
export const githubUsage: MetricStrategy = {
  id: "github-usage",
  targets: {
    source: "github",
    queries: [
      'ffmpeg extract frames "every n seconds" is:issue',
      "whisper transcribe video timestamps in:title,body",
      "search inside video for moment OR scene state:open",
      '"give my agent" vision screenshot frames in:body',
    ],
    freshnessHours: 72,
  },
  rubric: `Strong = a dev hand-rolling something VideoDB does natively
(frame extraction, transcription+search, scene/semantic video search,
visual access for an agent). Reject already-solved, vendors, off-topic,
or anything where VideoDB is a stretch.`,
  successEvent: "first_successful_api_call",
  attributionMap: {
    utmSource: "github",
    utmMedium: "agent-touch",
    joinOn: "utm_campaign",
    windowDays: 21,
  },
  denylist: {
    repos: [],
    orgs: [],
    users: [],
  },
};
