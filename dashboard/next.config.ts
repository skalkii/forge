import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

// Single .env at the repo root is shared by agent + dashboard.
loadEnvConfig(path.join(__dirname, ".."), process.env.NODE_ENV !== "production");

const nextConfig: NextConfig = {
  // @forge/agent ships TS source; only its dependency-free ./strategy export is imported
  transpilePackages: ["@forge/agent"],
};

export default nextConfig;
