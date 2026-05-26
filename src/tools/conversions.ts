import type { LinkedInApiClient } from "../linkedin-client.js";
import type { ToolRegistry } from "../tool-registry.js";

export class ConversionsTools {
  private apiClient: LinkedInApiClient;

  constructor(apiClient: LinkedInApiClient) {
    this.apiClient = apiClient;
  }

  registerTools(registry: ToolRegistry): void {
    // 1. get_conversion_performance
    registry.register(
      {
        name: "linkedin_ads_get_conversion_performance",
        description:
          "Retrieves conversion metrics broken down by conversion type/action. Shows which conversions are being driven by which campaigns, with cost per conversion and conversion value.",
        inputSchema: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "The LinkedIn Ad Account ID" },
            campaignIds: { type: "array", items: { type: "string" }, description: "Filter by specific campaigns" },
            startDate: { type: "string", description: "Start date in YYYY-MM-DD format" },
            endDate: { type: "string", description: "End date in YYYY-MM-DD format. Default: today" },
            includePostView: { type: "boolean", description: "Include view-through conversions. Default: true" },
            timeGranularity: { type: "string", enum: ["ALL", "DAILY"], description: "Time granularity. Default: ALL" },
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
          const [analytics, conversionDefs] = await Promise.all([
            this.apiClient.getConversionPerformance({
              accountId: params.accountId,
              campaignIds: params.campaignIds,
              startDate: params.startDate,
              endDate: params.endDate,
              includePostView: params.includePostView,
              timeGranularity: params.timeGranularity,
            }),
            this.apiClient.listConversions(params.accountId),
          ]);

          const conversionMap = new Map(conversionDefs.map((c) => [c.id, c]));

          const results = analytics.map((record: any) => {
            const conversionUrn = record.pivotValues?.[0] || "";
            const conversionId = conversionUrn.split(":").pop() || "";
            const conversionDef = conversionMap.get(conversionId);
            const totalConversions = record.externalWebsiteConversions || 0;
            const cost = parseFloat(record.costInUsd) || 0;
            const conversionValue = parseFloat(record.conversionValueInLocalCurrency) || 0;

            return {
              conversionId,
              conversionName: conversionDef?.name || "Unknown",
              conversionType: conversionDef?.type || "Unknown",
              metrics: {
                totalConversions,
                postClickConversions: record.externalWebsitePostClickConversions || 0,
                postViewConversions: record.externalWebsitePostViewConversions || 0,
                conversionValue,
                costPerConversion: totalConversions > 0 ? cost / totalConversions : null,
              },
            };
          });

          const totals = results.reduce(
            (acc: any, r: any) => ({
              totalConversions: acc.totalConversions + r.metrics.totalConversions,
              totalValue: acc.totalValue + r.metrics.conversionValue,
              totalCost: acc.totalCost + (r.metrics.costPerConversion || 0) * r.metrics.totalConversions,
            }),
            { totalConversions: 0, totalValue: 0, totalCost: 0 }
          );

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
                    conversions: results,
                    totals: {
                      ...totals,
                      overallCostPerConversion:
                        totals.totalConversions > 0 ? totals.totalCost / totals.totalConversions : null,
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

    // 2. list_conversions
    registry.register(
      {
        name: "linkedin_ads_list_conversions",
        description:
          "Lists all conversion tracking rules configured for an account. Shows conversion names, types, attribution windows, and enabled status.",
        inputSchema: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "The LinkedIn Ad Account ID" },
            enabledOnly: { type: "boolean", description: "Only show enabled conversions. Default: false" },
          },
          required: ["accountId"],
        },
      },
      async (args: unknown) => {
        const params = args as Record<string, any>;
        if (!params.accountId) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "accountId is required" }) }],
            isError: true,
          };
        }

        try {
          const conversions = await this.apiClient.listConversions(params.accountId, params.enabledOnly);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    conversions: conversions.map((c) => ({
                      id: c.id,
                      name: c.name,
                      type: c.type,
                      conversionMethod: c.conversionMethod || "INSIGHT_TAG",
                      enabled: c.enabled,
                      postClickAttributionWindow: c.postClickAttributionWindowSize,
                      viewThroughAttributionWindow: c.viewThroughAttributionWindowSize,
                      attributionType: c.attributionType,
                    })),
                    totalCount: conversions.length,
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

    // 3. get_lead_gen_performance
    registry.register(
      {
        name: "linkedin_ads_get_lead_gen_performance",
        description:
          "Retrieves lead generation form performance including form submissions, qualified leads, and cost per lead. Essential for B2B marketers running lead gen campaigns.",
        inputSchema: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "The LinkedIn Ad Account ID" },
            campaignIds: { type: "array", items: { type: "string" }, description: "Filter by specific campaigns" },
            startDate: { type: "string", description: "Start date in YYYY-MM-DD format" },
            endDate: { type: "string", description: "End date in YYYY-MM-DD format. Default: today" },
            timeGranularity: { type: "string", enum: ["ALL", "DAILY"], description: "Time granularity. Default: ALL" },
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
          const analytics = await this.apiClient.getLeadGenPerformance({
            accountId: params.accountId,
            campaignIds: params.campaignIds,
            startDate: params.startDate,
            endDate: params.endDate,
            timeGranularity: params.timeGranularity,
          });

          const campaignIds = analytics.map((record: any) => record.pivotValues?.[0]?.split(":").pop()).filter(Boolean);
          const campaignMap = await this.apiClient.getCampaignsByIds(params.accountId, campaignIds);

          const results = analytics.map((record: any) => {
            const campaignUrn = record.pivotValues?.[0] || "";
            const campaignId = campaignUrn.split(":").pop() || "";
            const campaign = campaignMap.get(campaignId);
            const leads = record.oneClickLeads || 0;
            const formOpens = record.oneClickLeadFormOpens || 0;
            const qualifiedLeads = record.qualifiedLeads || 0;
            const cost = parseFloat(record.costInUsd) || 0;

            return {
              campaignId,
              campaignName: campaign?.name || "Unknown",
              metrics: {
                oneClickLeads: leads,
                oneClickLeadFormOpens: formOpens,
                qualifiedLeads,
                costPerLead: leads > 0 ? cost / leads : null,
                costPerQualifiedLead: qualifiedLeads > 0 ? cost / qualifiedLeads : null,
                formOpenToSubmitRate: formOpens > 0 ? ((leads / formOpens) * 100).toFixed(2) : null,
                leadQualificationRate: leads > 0 ? ((qualifiedLeads / leads) * 100).toFixed(2) : null,
              },
            };
          });

          const totals = results.reduce(
            (acc: any, r: any) => ({
              totalLeads: acc.totalLeads + r.metrics.oneClickLeads,
              totalFormOpens: acc.totalFormOpens + r.metrics.oneClickLeadFormOpens,
              totalQualifiedLeads: acc.totalQualifiedLeads + r.metrics.qualifiedLeads,
              totalCost: acc.totalCost + (r.metrics.costPerLead || 0) * r.metrics.oneClickLeads,
            }),
            { totalLeads: 0, totalFormOpens: 0, totalQualifiedLeads: 0, totalCost: 0 }
          );

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
                    leadMetrics: {
                      ...totals,
                      overallCostPerLead: totals.totalLeads > 0 ? totals.totalCost / totals.totalLeads : null,
                      overallFormOpenToSubmitRate:
                        totals.totalFormOpens > 0
                          ? ((totals.totalLeads / totals.totalFormOpens) * 100).toFixed(2)
                          : null,
                      overallLeadQualificationRate:
                        totals.totalLeads > 0
                          ? ((totals.totalQualifiedLeads / totals.totalLeads) * 100).toFixed(2)
                          : null,
                    },
                    byCampaign: results,
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

    // 4. list_lead_forms
    registry.register(
      {
        name: "linkedin_ads_list_lead_forms",
        description:
          "Lists all lead generation forms configured for an account with their questions and settings. Helps understand what forms are available and their configuration.",
        inputSchema: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "The LinkedIn Ad Account ID" },
            status: {
              type: "array",
              items: { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] },
              description: "Filter by status",
            },
            includeQuestions: { type: "boolean", description: "Include form questions. Default: true" },
          },
          required: ["accountId"],
        },
      },
      async (args: unknown) => {
        const params = args as Record<string, any>;
        if (!params.accountId) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "accountId is required" }) }],
            isError: true,
          };
        }

        try {
          const forms = await this.apiClient.listLeadForms(params.accountId, params.status);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    forms: forms.map((form) => {
                      const result: Record<string, unknown> = {
                        id: form.id,
                        name: form.name,
                        status: form.status,
                        headline: form.headline,
                        description: form.description,
                        thankYouMessage: form.thankYouMessage,
                        landingPageUrl: form.landingPageUrl,
                      };
                      if (params.includeQuestions !== false && form.questions) {
                        result.questions = form.questions.map((q) => ({
                          questionId: q.questionId,
                          questionType: q.questionType,
                          questionText: q.questionText,
                          required: q.required,
                          predefinedField: q.predefinedField,
                        }));
                      }
                      return result;
                    }),
                    totalCount: forms.length,
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
