import type { LinkedInApiClient } from "../linkedin-client.js";
import type { ToolRegistry } from "../tool-registry.js";

export class AnalyticsTools {
  private apiClient: LinkedInApiClient;

  constructor(apiClient: LinkedInApiClient) {
    this.apiClient = apiClient;
  }

  registerTools(registry: ToolRegistry): void {
    // 1. compare_performance
    registry.register(
      {
        name: "linkedin_ads_compare_performance",
        description:
          "Compares performance between two time periods, campaigns, or campaign groups. Calculates percentage changes and highlights significant differences. Essential for reporting on performance trends.",
        inputSchema: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "The LinkedIn Ad Account ID" },
            comparisonType: {
              type: "string",
              enum: ["TIME_PERIOD", "CAMPAIGNS", "CAMPAIGN_GROUPS"],
              description: "Type of comparison to make",
            },
            periodA: {
              type: "object",
              properties: {
                startDate: { type: "string", description: "Start date for period A (YYYY-MM-DD)" },
                endDate: { type: "string", description: "End date for period A (YYYY-MM-DD)" },
                entityIds: {
                  type: "array",
                  items: { type: "string" },
                  description: "Entity IDs for comparison (campaigns or campaign groups)",
                },
              },
              description: "First period or entity set for comparison",
            },
            periodB: {
              type: "object",
              properties: {
                startDate: { type: "string", description: "Start date for period B (YYYY-MM-DD)" },
                endDate: { type: "string", description: "End date for period B (YYYY-MM-DD)" },
                entityIds: {
                  type: "array",
                  items: { type: "string" },
                  description: "Entity IDs for comparison (campaigns or campaign groups)",
                },
              },
              description: "Second period or entity set for comparison",
            },
          },
          required: ["accountId", "comparisonType", "periodA", "periodB"],
        },
      },
      async (args: unknown) => {
        const params = args as Record<string, any>;
        if (!params.accountId || !params.comparisonType || !params.periodA || !params.periodB) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: "accountId, comparisonType, periodA, and periodB are required" }),
              },
            ],
            isError: true,
          };
        }

        try {
          let metricsA: Record<string, number>;
          let metricsB: Record<string, number>;
          let labelA: string;
          let labelB: string;

          if (params.comparisonType === "TIME_PERIOD") {
            if (!params.periodA.startDate || !params.periodB.startDate) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({ error: "startDate is required for both periods in TIME_PERIOD comparison" }),
                  },
                ],
                isError: true,
              };
            }
            const [analyticsA, analyticsB] = await Promise.all([
              this.apiClient.getAnalytics({
                accountId: params.accountId,
                pivot: "ACCOUNT",
                startDate: params.periodA.startDate,
                endDate: params.periodA.endDate,
                timeGranularity: "ALL",
              }),
              this.apiClient.getAnalytics({
                accountId: params.accountId,
                pivot: "ACCOUNT",
                startDate: params.periodB.startDate,
                endDate: params.periodB.endDate,
                timeGranularity: "ALL",
              }),
            ]);
            metricsA = aggregateMetrics(analyticsA);
            metricsB = aggregateMetrics(analyticsB);
            labelA = formatDateForLabel(params.periodA.startDate, params.periodA.endDate);
            labelB = formatDateForLabel(params.periodB.startDate, params.periodB.endDate);
          } else if (params.comparisonType === "CAMPAIGNS") {
            if (!params.periodA.entityIds?.length || !params.periodB.entityIds?.length) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({ error: "entityIds are required for both periods in CAMPAIGNS comparison" }),
                  },
                ],
                isError: true,
              };
            }
            const startDate = params.periodA.startDate || getDefaultStartDate();
            const endDate = params.periodA.endDate;
            const [analyticsA, analyticsB] = await Promise.all([
              this.apiClient.getCampaignPerformance({
                accountId: params.accountId,
                campaignIds: params.periodA.entityIds,
                startDate,
                endDate,
              }),
              this.apiClient.getCampaignPerformance({
                accountId: params.accountId,
                campaignIds: params.periodB.entityIds,
                startDate,
                endDate,
              }),
            ]);
            metricsA = aggregateMetrics(analyticsA);
            metricsB = aggregateMetrics(analyticsB);
            labelA = `Campaigns: ${params.periodA.entityIds.join(", ")}`;
            labelB = `Campaigns: ${params.periodB.entityIds.join(", ")}`;
          } else {
            if (!params.periodA.entityIds?.length || !params.periodB.entityIds?.length) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      error: "entityIds are required for both periods in CAMPAIGN_GROUPS comparison",
                    }),
                  },
                ],
                isError: true,
              };
            }
            const startDate = params.periodA.startDate || getDefaultStartDate();
            const endDate = params.periodA.endDate;
            const [analyticsA, analyticsB] = await Promise.all([
              this.apiClient.getCampaignPerformance({
                accountId: params.accountId,
                campaignGroupIds: params.periodA.entityIds,
                startDate,
                endDate,
              }),
              this.apiClient.getCampaignPerformance({
                accountId: params.accountId,
                campaignGroupIds: params.periodB.entityIds,
                startDate,
                endDate,
              }),
            ]);
            metricsA = aggregateMetrics(analyticsA);
            metricsB = aggregateMetrics(analyticsB);
            labelA = `Campaign Groups: ${params.periodA.entityIds.join(", ")}`;
            labelB = `Campaign Groups: ${params.periodB.entityIds.join(", ")}`;
          }

          const changes: Record<string, { absolute: number; percentage: number | null }> = {};
          const metricKeys = ["impressions", "clicks", "costInUsd", "conversions", "averageDwellTime"];

          for (const key of metricKeys) {
            const valA = metricsA[key] || 0;
            const valB = metricsB[key] || 0;
            changes[key] = { absolute: valB - valA, percentage: calculatePercentageChange(valA, valB) };
          }

          const ctrA = metricsA.impressions > 0 ? (metricsA.clicks / metricsA.impressions) * 100 : 0;
          const ctrB = metricsB.impressions > 0 ? (metricsB.clicks / metricsB.impressions) * 100 : 0;
          changes["ctr"] = { absolute: ctrB - ctrA, percentage: calculatePercentageChange(ctrA, ctrB) };

          const cpcA = metricsA.clicks > 0 ? metricsA.costInUsd / metricsA.clicks : 0;
          const cpcB = metricsB.clicks > 0 ? metricsB.costInUsd / metricsB.clicks : 0;
          changes["costPerClick"] = { absolute: cpcB - cpcA, percentage: calculatePercentageChange(cpcA, cpcB) };

          const insights: string[] = [];
          if (changes.impressions.percentage !== null && Math.abs(changes.impressions.percentage) > 10) {
            insights.push(
              `Impressions ${changes.impressions.percentage > 0 ? "increased" : "decreased"} by ${Math.abs(changes.impressions.percentage).toFixed(1)}%`
            );
          }
          if (changes.ctr.percentage !== null && Math.abs(changes.ctr.percentage) > 10) {
            insights.push(
              `CTR ${changes.ctr.percentage > 0 ? "improved" : "declined"} by ${Math.abs(changes.ctr.percentage).toFixed(1)}%`
            );
          }
          if (changes.costPerClick.percentage !== null && Math.abs(changes.costPerClick.percentage) > 10) {
            insights.push(
              `Cost per click ${changes.costPerClick.percentage > 0 ? "increased" : "decreased"} by ${Math.abs(changes.costPerClick.percentage).toFixed(1)}%`
            );
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    comparisonType: params.comparisonType,
                    periodA: {
                      label: labelA,
                      metrics: {
                        impressions: metricsA.impressions || 0,
                        clicks: metricsA.clicks || 0,
                        costInUsd: metricsA.costInUsd || 0,
                        conversions: metricsA.conversions || 0,
                        ctr: ctrA.toFixed(2),
                        costPerClick: cpcA.toFixed(2),
                        averageDwellTime: metricsA.averageDwellTime || null,
                      },
                    },
                    periodB: {
                      label: labelB,
                      metrics: {
                        impressions: metricsB.impressions || 0,
                        clicks: metricsB.clicks || 0,
                        costInUsd: metricsB.costInUsd || 0,
                        conversions: metricsB.conversions || 0,
                        ctr: ctrB.toFixed(2),
                        costPerClick: cpcB.toFixed(2),
                        averageDwellTime: metricsB.averageDwellTime || null,
                      },
                    },
                    changes,
                    insights,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
        }
      }
    );

    // 2. get_daily_trends
    registry.register(
      {
        name: "linkedin_ads_get_daily_trends",
        description:
          "Retrieves daily performance trends over a specified period. Returns time-series data for visualizing performance patterns, identifying anomalies, and understanding day-of-week effects.",
        inputSchema: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "The LinkedIn Ad Account ID" },
            campaignIds: { type: "array", items: { type: "string" }, description: "Filter by specific campaigns" },
            startDate: { type: "string", description: "Start date in YYYY-MM-DD format" },
            endDate: { type: "string", description: "End date in YYYY-MM-DD format. Default: today" },
            metrics: {
              type: "array",
              items: { type: "string" },
              description: "Metrics to include. Default: impressions, clicks, costInUsd, conversions",
            },
            entityLevel: {
              type: "string",
              enum: ["ACCOUNT", "CAMPAIGN_GROUP", "CAMPAIGN"],
              description: "Level of aggregation. Default: ACCOUNT",
            },
          },
          required: ["accountId", "startDate"],
        },
      },
      async (args: unknown) => {
        const params = args as Record<string, any>;
        if (!params.accountId || !params.startDate) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "accountId and startDate are required" }) }],
            isError: true,
          };
        }

        try {
          const pivot =
            params.entityLevel === "CAMPAIGN"
              ? "CAMPAIGN"
              : params.entityLevel === "CAMPAIGN_GROUP"
                ? "CAMPAIGN_GROUP"
                : "ACCOUNT";

          const analytics = await this.apiClient.getAnalytics({
            accountId: params.accountId,
            pivot: pivot as any,
            startDate: params.startDate,
            endDate: params.endDate,
            timeGranularity: "DAILY",
            campaigns: params.campaignIds,
          });

          const byDate = new Map<string, Record<string, any>>();

          for (const record of analytics as any[]) {
            if (record.dateRange) {
              const date = `${record.dateRange.start.year}-${String(record.dateRange.start.month).padStart(2, "0")}-${String(record.dateRange.start.day).padStart(2, "0")}`;
              if (!byDate.has(date)) {
                byDate.set(date, {
                  impressions: 0,
                  clicks: 0,
                  costInUsd: 0,
                  conversions: 0,
                  averageDwellTime: null,
                  _dwellTimeCount: 0,
                });
              }
              const m = byDate.get(date)!;
              m.impressions += record.impressions || 0;
              m.clicks += record.clicks || 0;
              m.costInUsd += parseFloat(record.costInUsd) || 0;
              m.conversions += record.externalWebsiteConversions || 0;
              if (record.averageDwellTime != null) {
                m.averageDwellTime =
                  ((m.averageDwellTime || 0) * m._dwellTimeCount + record.averageDwellTime) / (m._dwellTimeCount + 1);
                m._dwellTimeCount += 1;
              }
            }
          }

          const dataPoints = Array.from(byDate.entries())
            .map(([date, metrics]) => ({
              date,
              metrics: {
                impressions: metrics.impressions,
                clicks: metrics.clicks,
                costInUsd: Number(metrics.costInUsd.toFixed(2)),
                conversions: metrics.conversions,
                ctr: metrics.impressions > 0 ? Number(((metrics.clicks / metrics.impressions) * 100).toFixed(2)) : 0,
                costPerConversion:
                  metrics.conversions > 0 ? Number((metrics.costInUsd / metrics.conversions).toFixed(2)) : null,
                averageDwellTime:
                  metrics.averageDwellTime != null ? Number(Number(metrics.averageDwellTime).toFixed(1)) : null,
              },
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

          const totals = dataPoints.reduce(
            (acc, dp) => ({
              impressions: acc.impressions + dp.metrics.impressions,
              clicks: acc.clicks + dp.metrics.clicks,
              costInUsd: acc.costInUsd + dp.metrics.costInUsd,
              conversions: acc.conversions + dp.metrics.conversions,
            }),
            { impressions: 0, clicks: 0, costInUsd: 0, conversions: 0 }
          );

          const averageDaily = {
            impressions: dataPoints.length > 0 ? Math.round(totals.impressions / dataPoints.length) : 0,
            clicks: dataPoints.length > 0 ? Math.round(totals.clicks / dataPoints.length) : 0,
            costInUsd: dataPoints.length > 0 ? Number((totals.costInUsd / dataPoints.length).toFixed(2)) : 0,
            conversions: dataPoints.length > 0 ? Number((totals.conversions / dataPoints.length).toFixed(2)) : 0,
          };

          let peakDay = dataPoints[0];
          let lowestDay = dataPoints[0];
          for (const dp of dataPoints) {
            if (dp.metrics.impressions > (peakDay?.metrics.impressions || 0)) peakDay = dp;
            if (dp.metrics.impressions < (lowestDay?.metrics.impressions || Infinity)) lowestDay = dp;
          }

          const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
          const weekdayData: Record<string, { impressions: number[]; clicks: number[] }> = Object.fromEntries(
            weekdayNames.map((d) => [d, { impressions: [], clicks: [] }])
          );

          for (const dp of dataPoints) {
            const day = weekdayNames[new Date(dp.date).getDay()];
            weekdayData[day].impressions.push(dp.metrics.impressions);
            weekdayData[day].clicks.push(dp.metrics.clicks);
          }

          const weekdayAverages: Record<string, { avgImpressions: number; avgClicks: number }> = {};
          for (const [day, data] of Object.entries(weekdayData)) {
            weekdayAverages[day] = {
              avgImpressions:
                data.impressions.length > 0
                  ? Math.round(data.impressions.reduce((a, b) => a + b, 0) / data.impressions.length)
                  : 0,
              avgClicks:
                data.clicks.length > 0 ? Math.round(data.clicks.reduce((a, b) => a + b, 0) / data.clicks.length) : 0,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    dateRange: {
                      start: params.startDate,
                      end: params.endDate || new Date().toISOString().split("T")[0],
                    },
                    granularity: "DAILY",
                    dataPoints,
                    summary: {
                      averageDaily,
                      peakDay: peakDay ? { date: peakDay.date, impressions: peakDay.metrics.impressions } : null,
                      lowestDay: lowestDay
                        ? { date: lowestDay.date, impressions: lowestDay.metrics.impressions }
                        : null,
                      weekdayAverages,
                      totals,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
        }
      }
    );
  }
}

function calculatePercentageChange(oldVal: number, newVal: number): number | null {
  if (oldVal === 0) return newVal > 0 ? 100 : null;
  return ((newVal - oldVal) / oldVal) * 100;
}

function formatDateForLabel(startDate: string, endDate?: string): string {
  const start = new Date(startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const end = endDate ? new Date(endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Today";
  return `${start} - ${end}`;
}

function aggregateMetrics(records: any[]): Record<string, number> {
  let dwellTimeSum = 0;
  let dwellTimeCount = 0;
  const totals = records.reduce(
    (acc, r) => {
      if (r.averageDwellTime != null) {
        dwellTimeSum += r.averageDwellTime;
        dwellTimeCount += 1;
      }
      return {
        impressions: acc.impressions + (r.impressions || 0),
        clicks: acc.clicks + (r.clicks || 0),
        costInUsd: acc.costInUsd + (parseFloat(r.costInUsd) || 0),
        conversions: acc.conversions + (r.externalWebsiteConversions || 0),
      };
    },
    { impressions: 0, clicks: 0, costInUsd: 0, conversions: 0 }
  );
  return { ...totals, averageDwellTime: dwellTimeCount > 0 ? dwellTimeSum / dwellTimeCount : 0 };
}

function getDefaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}
