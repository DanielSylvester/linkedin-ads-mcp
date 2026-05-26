import type { LinkedInApiClient } from "../linkedin-client.js";
import { LinkedInApiError } from "../errors.js";
import type { ToolRegistry, McpTool, ToolHandler } from "../tool-registry.js";

export class AccountTools {
  private apiClient: LinkedInApiClient;

  constructor(apiClient: LinkedInApiClient) {
    this.apiClient = apiClient;
  }

  registerTools(registry: ToolRegistry): void {
    // ── 1. list_accounts ──────────────────────────────────────────────────
    const listAccountsTool: McpTool = {
      name: "linkedin_ads_list_accounts",
      description: "List LinkedIn ad accounts accessible to the authenticated user",
      inputSchema: {
        type: "object",
        properties: {
          status: {
            type: "array",
            items: { type: "string", enum: ["ACTIVE", "DRAFT", "CANCELED", "PENDING_DELETION"] },
          },
          type: { type: "string", enum: ["BUSINESS", "ENTERPRISE"] },
          includeTest: { type: "boolean", default: false },
          start: { type: "integer", default: 0 },
          count: { type: "integer", default: 50 },
        },
      },
    };

    const listAccountsHandler: ToolHandler = async (args: unknown) => {
      const { status, type, includeTest } = (args as Record<string, unknown>) ?? {};
      try {
        const accounts = await this.apiClient.listAdAccounts({
          status: status as string[] | undefined,
          type: type as string | undefined,
          includeTest: includeTest as boolean | undefined,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  accounts: accounts.map((a) => ({
                    id: a.id,
                    name: a.name,
                    currency: a.currency,
                    type: a.type,
                    status: a.status,
                    isTest: a.test,
                  })),
                  totalCount: accounts.length,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        if (err instanceof LinkedInApiError) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: err.message, statusCode: err.statusCode }) }],
            isError: true,
          };
        }
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    };

    registry.register(listAccountsTool, listAccountsHandler);

    // ── 2. get_account ────────────────────────────────────────────────────
    const getAccountTool: McpTool = {
      name: "linkedin_ads_get_account",
      description: "Get a single LinkedIn ad account by ID",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string" },
        },
        required: ["accountId"],
      },
    };

    const getAccountHandler: ToolHandler = async (args: unknown) => {
      const { accountId } = args as Record<string, unknown>;
      if (typeof accountId !== "string" || accountId.length === 0) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "accountId is required" }) }], isError: true };
      }
      try {
        const account = await this.apiClient.getAccountDetails(accountId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  id: account.id,
                  name: account.name,
                  currency: account.currency,
                  type: account.type,
                  status: account.status,
                  servingStatuses: account.servingStatuses,
                  reference: account.reference,
                  notificationSettings: {
                    campaignOptimization: account.notifiedOnCampaignOptimizationTips,
                    creativeApproval: account.notifiedOnCreativeApproval,
                    creativeRejection: account.notifiedOnCreativeRejection,
                    endOfCampaign: account.notifiedOnEndOfCampaign,
                  },
                  isTest: account.test,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        if (err instanceof LinkedInApiError) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: err.message, statusCode: err.statusCode }) }],
            isError: true,
          };
        }
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    };

    registry.register(getAccountTool, getAccountHandler);
  }
}
