#!/usr/bin/env node

import "dotenv/config";
import { loadConfig } from "./config.js";
import { LinkedInAdsMcpServer } from "./server.js";

const config = loadConfig();
const server = new LinkedInAdsMcpServer(config);
server.start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
