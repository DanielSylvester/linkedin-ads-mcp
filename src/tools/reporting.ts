import type { LinkedInApiClient } from "../linkedin-client.js";
import type { ToolRegistry } from "../tool-registry.js";
import type { AnalyticsResponse, DateRange } from "../types.js";

export class ReportingTools {
  private apiClient: LinkedInApiClient;

  constructor(apiClient: LinkedInApiClient) {
    this.apiClient = apiClient;
  }

  registerTools(registry: ToolRegistry): void {
    registry.register(
      {
        name: "linkedin_ads_get_analytics",
        description:
          "Fetch LinkedIn Ads analytics data with flexible pivoting, date ranges, and field selection. Returns aggregated metrics based on the requested pivot dimension.",
        inputSchema: {
          type: "object",
          properties: {
            accountId: { type: "string" },
            pivot: {
              type: "string",
              enum: [
                "CAMPAIGN",
                "CREATIVE",
                "ACCOUNT",
                "CAMPAIGN_GROUP",
                "CONVERSION",
                "SERVING_LOCATION",
                "CARD_INDEX",
                "MEMBER_COMPANY",
                "MEMBER_JOB_TITLE",
                "MEMBER_INDUSTRY",
                "MEMBER_JOB_SENIORITY",
                "MEMBER_JOB_FUNCTION",
                "MEMBER_REGION",
                "MEMBER_COUNTRY",
                "IMPRESSION_DEVICE_TYPE",
              ],
              description: "Dimension to pivot analytics data by",
            },
            timeGranularity: { type: "string", enum: ["DAILY", "MONTHLY", "YEARLY", "ALL"], default: "ALL" },
            dateRange: {
              type: "object",
              properties: {
                start: { type: "object", properties: { year: { type: "integer" }, month: { type: "integer" }, day: { type: "integer" } } },
                end: { type: "object", properties: { year: { type: "integer" }, month: { type: "integer" }, day: { type: "integer" } } },
              },
            },
            campaigns: { type: "array", items: { type: "string" } },
            campaignGroups: { type: "array", items: { type: "string" } },
            fields: { type: "array", items: { type: "string" } },
            start: { type: "integer", default: 0 },
            count: { type: "integer", default: 1000 },
          },
          required: ["accountId", "pivot"],
        },
      },
      async (args: unknown) => {
        const params = args as Record<string, unknown>;
        if (!params.accountId || !params.pivot) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "accountId and pivot are required" }) }], isError: true };
        }

        const pivot = params.pivot as string;
        const timeGranularity = (params.timeGranularity as string) || "ALL";
        const start = (params.start as number) ?? 0;
        const count = (params.count as number) ?? 1000;

        const queryParts: string[] = [];
        queryParts.push(`pivot=${encodeURIComponent(pivot)}`);
        queryParts.push(`timeGranularity=${encodeURIComponent(timeGranularity)}`);

        if (params.dateRange && typeof params.dateRange === "object") {
          const dr = params.dateRange as DateRange;
          if (dr.start && dr.end) {
            const dateRangeStr = `dateRange=(start:(year:${dr.start.year},month:${dr.start.month},day:${dr.start.day}),end:(year:${dr.end.year},month:${dr.end.month},day:${dr.end.day}))`;
            queryParts.push(dateRangeStr);
          }
        }

        if (params.campaigns && Array.isArray(params.campaigns) && params.campaigns.length > 0) {
          const campaignsStr = (params.campaigns as string[]).map((c) => encodeURIComponent(c)).join(",");
          queryParts.push(`campaigns=List(${campaignsStr})`);
        }

        if (params.campaignGroups && Array.isArray(params.campaignGroups) && params.campaignGroups.length > 0) {
          const groupsStr = (params.campaignGroups as string[]).map((g) => encodeURIComponent(g)).join(",");
          queryParts.push(`campaignGroups=List(${groupsStr})`);
        }

        if (params.fields && Array.isArray(params.fields) && params.fields.length > 0) {
          queryParts.push(`fields=${(params.fields as string[]).join(",")}`);
        }

        queryParts.push(`start=${start}&count=${count}`);

        try {
          const result = await this.apiClient.get<AnalyticsResponse>(`/adAnalytics?q=analytics&${queryParts.join("&")}`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
        }
      }
    );

    registry.register(
      {
        name: "linkedin_ads_get_campaign_stats",
        description: "Get simplified campaign statistics for a list of campaign IDs. Defaults to last 30 days if no date range given.",
        inputSchema: {
          type: "object",
          properties: {
            accountId: { type: "string" },
            campaignIds: { type: "array", items: { type: "string" }, minItems: 1 },
            dateRange: {
              type: "object",
              properties: {
                start: { type: "object", properties: { year: { type: "integer" }, month: { type: "integer" }, day: { type: "integer" } } },
                end: { type: "object", properties: { year: { type: "integer" }, month: { type: "integer" }, day: { type: "integer" } } },
              },
            },
          },
          required: ["accountId", "campaignIds"],
        },
      },
      async (args: unknown) => {
        const params = args as Record<string, unknown>;
        if (!params.accountId || !Array.isArray(params.campaignIds) || params.campaignIds.length === 0) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "accountId and campaignIds are required" }) }], isError: true };
        }

        const campaignIds = params.campaignIds as string[];
        const campaignUrns = campaignIds.map((id) => `urn:li:sponsoredCampaign:${id}`);

        const defaultFields = [
          "impressions",
          "clicks",
          "externalWebsiteConversions",
          "costInLocalCurrency",
          "videoViews",
          "videoCompletions",
          "likes",
          "comments",
          "shares",
          "follows",
        ];

        let dateRange: DateRange;
        if (params.dateRange && typeof params.dateRange === "object") {
          dateRange = params.dateRange as DateRange;
        } else {
          dateRange = this.getLast30DaysDateRange();
        }

        const queryParts: string[] = [];
        queryParts.push(`pivot=${encodeURIComponent("CAMPAIGN")}`);
        queryParts.push(`timeGranularity=${encodeURIComponent("ALL")}`);

        const dr = dateRange;
        const dateRangeStr = `dateRange=(start:(year:${dr.start.year},month:${dr.start.month},day:${dr.start.day}),end:(year:${dr.end.year},month:${dr.end.month},day:${dr.end.day}))`;
        queryParts.push(dateRangeStr);

        const campaignsStr = campaignUrns.map((c) => encodeURIComponent(c)).join(",");
        queryParts.push(`campaigns=List(${campaignsStr})`);
        queryParts.push(`fields=${defaultFields.join(",")}`);
        queryParts.push(`start=0&count=1000`);

        try {
          const result = await this.apiClient.get<AnalyticsResponse>(`/adAnalytics?q=analytics&${queryParts.join("&")}`);
          return { content: [{ type: "text", text: JSON.stringify(result.elements, null, 2) }] };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
        }
      }
    );
  }

  private getLast30DaysDateRange(): DateRange {
    const now = new Date();
    const end = { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);
    const start = { year: startDate.getFullYear(), month: startDate.getMonth() + 1, day: startDate.getDate() };
    return { start, end };
  }
}
