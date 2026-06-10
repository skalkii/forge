import type { MetricStrategy } from "../types";

/**
 * GitHub → Usage: find devs hand-rolling what VideoDB does natively,
 * measure cost per developer reaching first_successful_api_call.
 *
 * Queries verified against live GitHub search 2026-06-10 (R10, commit 20).
 * Originals failed: long quoted phrases returned 0; bare OR doesn't scope
 * in legacy issue search (17,933 garbage hits). These use short qualifier
 * form — moderate volume, fresh results; triage filters residual noise
 * (bot authors, paper-digest repos).
 */
export const githubUsage: MetricStrategy = {
  id: "github-usage",
  targets: {
    source: "github",
    queries: [
      // frame extraction (377 total, real hand-rolled-pipeline hits in top 10)
      "extract frames from video ffmpeg is:issue is:open in:title,body",
      // transcription + search (229 total, best precision of the set)
      "whisper transcribe video timestamps is:issue is:open",
      // scene / semantic video search — two narrow phrase queries replace the broken OR
      '"search inside video" is:issue is:open', // 51 total
      '"semantic video search" is:issue is:open', // 87 total
      // agent vision (191 total; replaces the dead '"give my agent"' phrase = 0 hits)
      "agent vision video frames screenshot is:issue is:open",
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
