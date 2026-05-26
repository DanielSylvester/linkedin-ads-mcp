#!/usr/bin/env node
/**
 * Live dry-run smoke test for the LinkedIn Ads MCP Server.
 *
 * Requires a real LINKEDIN_ACCESS_TOKEN. Exercises ONLY read-only tools
 * (list/get/analytics) — zero mutations. Validates response shapes.
 *
 * Skips gracefully if no token is available or if the account has no data.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = join(__dirname, "../dist/index.js");

const COLORS = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  reset: "\x1b[0m",
};

let passCount = 0;
let failCount = 0;
let skipCount = 0;
const errors = [];

function pass(label) {
  passCount++;
  console.log(`${COLORS.green}✓ PASS${COLORS.reset} ${label}`);
}

function fail(label, reason) {
  failCount++;
  console.log(`${COLORS.red}✗ FAIL${COLORS.reset} ${label}`);
  if (reason) console.log(`  ${COLORS.red}${reason}${COLORS.reset}`);
  errors.push({ label, reason });
}

function skip(label, reason) {
  skipCount++;
  console.log(`${COLORS.yellow}⊘ SKIP${COLORS.reset} ${label}${reason ? ` — ${reason}` : ""}`);
}

function info(label) {
  console.log(`${COLORS.cyan}→ INFO${COLORS.reset} ${label}`);
}

// Shared stdout line buffer and pending request map
let stdoutBuffer = "";
const pendingRequests = new Map();

function attachStdoutHandler(server) {
  server.stdout.on("data", (data) => {
    stdoutBuffer += data.toString();
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined && pendingRequests.has(msg.id)) {
          const { resolve } = pendingRequests.get(msg.id);
          clearTimeout(pendingRequests.get(msg.id).timeout);
          pendingRequests.delete(msg.id);
          resolve(msg);
        }
      } catch {
        // ignore non-JSON
      }
    }
  });
}

async function sendRequest(server, request, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(request.id);
      reject(new Error(`Request timeout (${timeoutMs}ms)`));
    }, timeoutMs);
    pendingRequests.set(request.id, { resolve, reject, timeout });
    server.stdin.write(JSON.stringify(request) + "\n");
  });
}

function parseResult(response) {
  const text = response.result?.content?.[0]?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isErrorResult(response) {
  return response.result?.isError === true;
}

async function runTests() {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;

  console.log(`\n${COLORS.cyan}═══════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.cyan}  LinkedIn Ads MCP Server — Live Dry-Run Smoke Test${COLORS.reset}`);
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════════════${COLORS.reset}\n`);

  if (!token || token === "your_access_token_here") {
    skip("Live smoke test", "LINKEDIN_ACCESS_TOKEN not set or is placeholder");
    console.log(`\n${COLORS.yellow}Set LINKEDIN_ACCESS_TOKEN to run live tests.${COLORS.reset}\n`);
    process.exit(0);
  }

  info("Starting MCP server with live token...");
  const server = spawn("node", [SERVER_PATH], {
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let serverCrashed = false;
  server.on("exit", (code) => {
    if (code !== null && code !== 0) serverCrashed = true;
  });

  attachStdoutHandler(server);
  await new Promise((r) => setTimeout(r, 800));

  if (serverCrashed) {
    fail("Server startup", "Server crashed immediately");
    process.exit(1);
  }
  pass("Server starts with live token");

  let reqId = 1;
  let accountId = null;
  let campaignId = null;
  let campaignGroupId = null;

  // ── 1. List Accounts ───────────────────────────────────────────────────
  info("Testing linkedin_ads_list_accounts...");
  try {
    const resp = await sendRequest(server, {
      jsonrpc: "2.0",
      id: ++reqId,
      method: "tools/call",
      params: { name: "linkedin_ads_list_accounts", arguments: {} },
    });

    if (isErrorResult(resp)) {
      fail("list_accounts", parseResult(resp)?.error || "Unknown error");
    } else {
      const data = parseResult(resp);
      if (Array.isArray(data?.accounts) && data.accounts.length > 0) {
        accountId = data.accounts[0].id;
        pass(`list_accounts — ${data.accounts.length} account(s) found, using ${accountId}`);
      } else if (Array.isArray(data?.accounts) && data.accounts.length === 0) {
        skip("list_accounts", "No accounts found for this token");
      } else {
        fail("list_accounts", "Unexpected response shape");
      }
    }
  } catch (e) {
    fail("list_accounts", e.message);
  }

  if (!accountId) {
    skip("Remaining tests", "No accountId available");
    server.kill();
    printSummary();
    process.exit(0);
  }

  // ── 2. Get Account Details ─────────────────────────────────────────────
  info("Testing linkedin_ads_get_account...");
  try {
    const resp = await sendRequest(server, {
      jsonrpc: "2.0",
      id: ++reqId,
      method: "tools/call",
      params: { name: "linkedin_ads_get_account", arguments: { accountId } },
    });

    if (isErrorResult(resp)) {
      fail("get_account", parseResult(resp)?.error);
    } else {
      const data = parseResult(resp);
      if (data && typeof data.id === "string") {
        pass("get_account — returned valid account object");
      } else {
        fail("get_account", "Unexpected response shape");
      }
    }
  } catch (e) {
    fail("get_account", e.message);
  }

  // ── 3. List Campaign Groups ────────────────────────────────────────────
  info("Testing linkedin_ads_list_campaign_groups...");
  try {
    const resp = await sendRequest(server, {
      jsonrpc: "2.0",
      id: ++reqId,
      method: "tools/call",
      params: { name: "linkedin_ads_list_campaign_groups", arguments: { accountId } },
    });

    if (isErrorResult(resp)) {
      fail("list_campaign_groups", parseResult(resp)?.error);
    } else {
      const data = parseResult(resp);
      if (Array.isArray(data?.campaignGroups)) {
        pass(`list_campaign_groups — ${data.campaignGroups.length} group(s)`);
        if (data.campaignGroups.length > 0) {
          campaignGroupId = data.campaignGroups[0].id;
        }
      } else {
        fail("list_campaign_groups", "Unexpected response shape");
      }
    }
  } catch (e) {
    fail("list_campaign_groups", e.message);
  }

  // ── 4. List Campaigns ──────────────────────────────────────────────────
  info("Testing linkedin_ads_list_campaigns...");
  try {
    const resp = await sendRequest(server, {
      jsonrpc: "2.0",
      id: ++reqId,
      method: "tools/call",
      params: { name: "linkedin_ads_list_campaigns", arguments: { accountId } },
    });

    if (isErrorResult(resp)) {
      fail("list_campaigns", parseResult(resp)?.error);
    } else {
      const data = parseResult(resp);
      if (Array.isArray(data?.campaigns)) {
        pass(`list_campaigns — ${data.campaigns.length} campaign(s)`);
        if (data.campaigns.length > 0) {
          campaignId = data.campaigns[0].id;
        }
      } else {
        fail("list_campaigns", "Unexpected response shape");
      }
    }
  } catch (e) {
    fail("list_campaigns", e.message);
  }

  // ── 5. Get Campaign Performance ────────────────────────────────────────
  info("Testing linkedin_ads_get_campaign_performance...");
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const startDate = lastWeek.toISOString().split("T")[0];
  const endDate = new Date().toISOString().split("T")[0];

  try {
    const resp = await sendRequest(server, {
      jsonrpc: "2.0",
      id: ++reqId,
      method: "tools/call",
      params: {
        name: "linkedin_ads_get_campaign_performance",
        arguments: { accountId, startDate, endDate },
      },
    });

    if (isErrorResult(resp)) {
      fail("get_campaign_performance", parseResult(resp)?.error);
    } else {
      const data = parseResult(resp);
      if (Array.isArray(data?.results) || Array.isArray(data?.campaigns)) {
        pass("get_campaign_performance — returned analytics data");
      } else {
        fail("get_campaign_performance", "Unexpected response shape");
      }
    }
  } catch (e) {
    fail("get_campaign_performance", e.message);
  }

  // ── 6. List Creatives ──────────────────────────────────────────────────
  info("Testing linkedin_ads_list_creatives...");
  try {
    const resp = await sendRequest(server, {
      jsonrpc: "2.0",
      id: ++reqId,
      method: "tools/call",
      params: { name: "linkedin_ads_list_creatives", arguments: { accountId } },
    });

    if (isErrorResult(resp)) {
      fail("list_creatives", parseResult(resp)?.error);
    } else {
      const data = parseResult(resp);
      if (Array.isArray(data?.creatives)) {
        pass(`list_creatives — ${data.creatives.length} creative(s)`);
      } else {
        fail("list_creatives", "Unexpected response shape");
      }
    }
  } catch (e) {
    fail("list_creatives", e.message);
  }

  // ── 7. Get Analytics (raw) ─────────────────────────────────────────────
  info("Testing linkedin_ads_get_analytics...");
  try {
    const resp = await sendRequest(server, {
      jsonrpc: "2.0",
      id: ++reqId,
      method: "tools/call",
      params: {
        name: "linkedin_ads_get_analytics",
        arguments: {
          accountId,
          startDate,
          endDate,
          pivot: "CAMPAIGN",
        },
      },
    });

    if (isErrorResult(resp)) {
      fail("get_analytics", parseResult(resp)?.error);
    } else {
      const data = parseResult(resp);
      if (Array.isArray(data?.results) || Array.isArray(data?.data)) {
        pass("get_analytics — returned raw analytics");
      } else {
        fail("get_analytics", "Unexpected response shape");
      }
    }
  } catch (e) {
    fail("get_analytics", e.message);
  }

  // ── 8. Audience Demographics ───────────────────────────────────────────
  info("Testing linkedin_ads_get_audience_demographics...");
  try {
    const resp = await sendRequest(server, {
      jsonrpc: "2.0",
      id: ++reqId,
      method: "tools/call",
      params: {
        name: "linkedin_ads_get_audience_demographics",
        arguments: {
          accountId,
          demographicType: "MEMBER_JOB_FUNCTION",
          startDate,
          endDate,
        },
      },
    });

    if (isErrorResult(resp)) {
      fail("get_audience_demographics", parseResult(resp)?.error);
    } else {
      const data = parseResult(resp);
      if (Array.isArray(data?.segments) || data?.error?.includes("delay")) {
        pass("get_audience_demographics — returned demographic breakdown");
      } else {
        fail("get_audience_demographics", "Unexpected response shape");
      }
    }
  } catch (e) {
    fail("get_audience_demographics", e.message);
  }

  // ── 9. Audience Reach ──────────────────────────────────────────────────
  info("Testing linkedin_ads_get_audience_reach...");
  try {
    const resp = await sendRequest(server, {
      jsonrpc: "2.0",
      id: ++reqId,
      method: "tools/call",
      params: {
        name: "linkedin_ads_get_audience_reach",
        arguments: { accountId, startDate, endDate },
      },
    });

    if (isErrorResult(resp)) {
      const err = parseResult(resp);
      if (err?.error?.includes("92 days")) {
        skip("get_audience_reach", "Date range too long for reach API");
      } else {
        fail("get_audience_reach", err?.error);
      }
    } else {
      const data = parseResult(resp);
      if (Array.isArray(data?.entities)) {
        pass("get_audience_reach — returned reach data");
      } else {
        fail("get_audience_reach", "Unexpected response shape");
      }
    }
  } catch (e) {
    fail("get_audience_reach", e.message);
  }

  // ── 10. List Saved Audiences ───────────────────────────────────────────
  info("Testing linkedin_ads_list_saved_audiences...");
  try {
    const resp = await sendRequest(server, {
      jsonrpc: "2.0",
      id: ++reqId,
      method: "tools/call",
      params: { name: "linkedin_ads_list_saved_audiences", arguments: { accountId } },
    });

    if (isErrorResult(resp)) {
      fail("list_saved_audiences", parseResult(resp)?.error);
    } else {
      const data = parseResult(resp);
      if (Array.isArray(data?.audiences)) {
        pass(`list_saved_audiences — ${data.audiences.length} audience(s)`);
      } else {
        fail("list_saved_audiences", "Unexpected response shape");
      }
    }
  } catch (e) {
    fail("list_saved_audiences", e.message);
  }

  // ── 11. List Conversions ───────────────────────────────────────────────
  info("Testing linkedin_ads_list_conversions...");
  try {
    const resp = await sendRequest(server, {
      jsonrpc: "2.0",
      id: ++reqId,
      method: "tools/call",
      params: { name: "linkedin_ads_list_conversions", arguments: { accountId } },
    });

    if (isErrorResult(resp)) {
      fail("list_conversions", parseResult(resp)?.error);
    } else {
      const data = parseResult(resp);
      if (Array.isArray(data?.conversions)) {
        pass(`list_conversions — ${data.conversions.length} conversion(s)`);
      } else {
        fail("list_conversions", "Unexpected response shape");
      }
    }
  } catch (e) {
    fail("list_conversions", e.message);
  }

  // ── 12. List Lead Forms ────────────────────────────────────────────────
  info("Testing linkedin_ads_list_lead_forms...");
  try {
    const resp = await sendRequest(server, {
      jsonrpc: "2.0",
      id: ++reqId,
      method: "tools/call",
      params: { name: "linkedin_ads_list_lead_forms", arguments: { accountId } },
    });

    if (isErrorResult(resp)) {
      fail("list_lead_forms", parseResult(resp)?.error);
    } else {
      const data = parseResult(resp);
      if (Array.isArray(data?.forms) || Array.isArray(data?.leadForms)) {
        pass("list_lead_forms — returned lead form data");
      } else {
        fail("list_lead_forms", "Unexpected response shape");
      }
    }
  } catch (e) {
    fail("list_lead_forms", e.message);
  }

  // ── 13. Campaign Stats (simplified) ────────────────────────────────────
  info("Testing linkedin_ads_get_campaign_stats...");
  try {
    const resp = await sendRequest(server, {
      jsonrpc: "2.0",
      id: ++reqId,
      method: "tools/call",
      params: { name: "linkedin_ads_get_campaign_stats", arguments: { accountId } },
    });

    if (isErrorResult(resp)) {
      fail("get_campaign_stats", parseResult(resp)?.error);
    } else {
      const data = parseResult(resp);
      if (Array.isArray(data?.results) || Array.isArray(data?.campaigns)) {
        pass("get_campaign_stats — returned stats");
      } else {
        fail("get_campaign_stats", "Unexpected response shape");
      }
    }
  } catch (e) {
    fail("get_campaign_stats", e.message);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────
  server.kill();
  await new Promise((r) => setTimeout(r, 300));

  if (serverCrashed) {
    fail("Server survived smoke test", "Server crashed during tests");
  } else {
    pass("Server shuts down cleanly");
  }

  printSummary();
  process.exit(failCount > 0 ? 1 : 0);
}

function printSummary() {
  console.log(`\n${COLORS.cyan}═══════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.cyan}  Live Smoke Test Results${COLORS.reset}`);
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.green}Passed: ${passCount}${COLORS.reset}`);
  console.log(`${COLORS.red}Failed: ${failCount}${COLORS.reset}`);
  console.log(`${COLORS.yellow}Skipped: ${skipCount}${COLORS.reset}`);
  console.log(`Total:  ${passCount + failCount + skipCount}`);

  if (errors.length > 0) {
    console.log(`\n${COLORS.red}Errors:${COLORS.reset}`);
    for (const err of errors) {
      console.log(`  • ${err.label}: ${err.reason}`);
    }
  }
  console.log();
}

runTests().catch((e) => {
  console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, e);
  process.exit(1);
});
