import type { StandardMetrics } from "../types.js";

/**
 * Calculates a standardized set of performance metrics from a raw analytics record.
 * This ensures every tool returns consistent, human-readable KPIs.
 */
export function calculateStandardMetrics(record: any, estimatedAudienceSize?: number): StandardMetrics {
  const impressions = record.impressions || 0;
  const clicks = record.clicks || 0;
  const spend = parseFloat(record.costInUsd) || 0;
  const conversions = record.externalWebsiteConversions || 0;
  const engagements = record.totalEngagements || 0;
  const reach =
    record.approximateUniqueImpressions ||
    record.approximateMemberReach ||
    (impressions > 0 ? Math.round(impressions * 0.7) : 0);

  // Use native audiencePenetration when available (≤92 day range),
  // otherwise fall back to client-side calculation
  const nativeAudiencePenetration =
    record.audiencePenetration != null ? Number((Number(record.audiencePenetration) * 100).toFixed(2)) : null;
  const fallbackAudiencePenetration =
    estimatedAudienceSize && estimatedAudienceSize > 0
      ? Number(((reach / estimatedAudienceSize) * 100).toFixed(2))
      : null;

  return {
    spend,
    impressions,
    clicks,
    reach,
    frequency: reach > 0 ? Number((impressions / reach).toFixed(2)) : null,
    engagements,
    engagementRate: impressions > 0 ? Number(((engagements / impressions) * 100).toFixed(2)) : null,
    ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : null,
    cpm: impressions > 0 ? Number(((spend / impressions) * 1000).toFixed(2)) : null,
    cpc: clicks > 0 ? Number((spend / clicks).toFixed(2)) : null,
    conversions,
    conversionRate: clicks > 0 ? Number(((conversions / clicks) * 100).toFixed(2)) : null,
    costPerConversion: conversions > 0 ? Number((spend / conversions).toFixed(2)) : null,
    audiencePenetration: nativeAudiencePenetration ?? fallbackAudiencePenetration,
    averageDwellTime: record.averageDwellTime != null ? Number(Number(record.averageDwellTime).toFixed(2)) : null,
  };
}

// Demographic type name mapping
export const DEMOGRAPHIC_TYPE_MAP: Record<string, string> = {
  MEMBER_JOB_FUNCTION: "Job Function",
  MEMBER_SENIORITY: "Seniority",
  MEMBER_INDUSTRY: "Industry",
  MEMBER_COMPANY_SIZE: "Company Size",
  MEMBER_JOB_TITLE: "Job Title",
  MEMBER_COMPANY: "Company",
  MEMBER_COUNTRY: "Country",
  MEMBER_COUNTRY_V2: "Country",
  MEMBER_REGION: "Region",
  MEMBER_REGION_V2: "Region",
};
