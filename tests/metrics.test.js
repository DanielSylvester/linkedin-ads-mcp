#!/usr/bin/env node
/**
 * Unit tests for src/lib/metrics.ts
 * Uses Node.js built-in test runner (node:test) — no extra dependencies.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { calculateStandardMetrics, DEMOGRAPHIC_TYPE_MAP } from "../dist/lib/metrics.js";

describe("calculateStandardMetrics", () => {
  it("returns zeroed metrics for an empty record", () => {
    const result = calculateStandardMetrics({});
    assert.strictEqual(result.spend, 0);
    assert.strictEqual(result.impressions, 0);
    assert.strictEqual(result.clicks, 0);
    assert.strictEqual(result.reach, 0);
    assert.strictEqual(result.frequency, null);
    assert.strictEqual(result.engagements, 0);
    assert.strictEqual(result.engagementRate, null);
    assert.strictEqual(result.ctr, null);
    assert.strictEqual(result.cpm, null);
    assert.strictEqual(result.cpc, null);
    assert.strictEqual(result.conversions, 0);
    assert.strictEqual(result.conversionRate, null);
    assert.strictEqual(result.costPerConversion, null);
    assert.strictEqual(result.audiencePenetration, null);
    assert.strictEqual(result.averageDwellTime, null);
  });

  it("calculates CTR, CPM, CPC correctly with typical values", () => {
    const record = {
      impressions: 10000,
      clicks: 150,
      costInUsd: "250.00",
      totalEngagements: 300,
      externalWebsiteConversions: 5,
    };
    const result = calculateStandardMetrics(record);

    assert.strictEqual(result.spend, 250);
    assert.strictEqual(result.impressions, 10000);
    assert.strictEqual(result.clicks, 150);
    assert.strictEqual(result.ctr, 1.5); // 150/10000*100
    assert.strictEqual(result.cpm, 25); // 250/10000*1000
    assert.strictEqual(result.cpc, 1.67); // 250/150
    assert.strictEqual(result.engagementRate, 3); // 300/10000*100
    assert.strictEqual(result.conversionRate, 3.33); // 5/150*100
    assert.strictEqual(result.costPerConversion, 50); // 250/5
  });

  it("falls back to 70% of impressions for reach when not provided", () => {
    const record = { impressions: 1000 };
    const result = calculateStandardMetrics(record);
    assert.strictEqual(result.reach, 700);
    assert.strictEqual(result.frequency, 1.43); // 1000/700
  });

  it("uses approximateUniqueImpressions when available", () => {
    const record = { impressions: 1000, approximateUniqueImpressions: 800 };
    const result = calculateStandardMetrics(record);
    assert.strictEqual(result.reach, 800);
    assert.strictEqual(result.frequency, 1.25); // 1000/800
  });

  it("uses approximateMemberReach when approximateUniqueImpressions is missing", () => {
    const record = { impressions: 1000, approximateMemberReach: 750 };
    const result = calculateStandardMetrics(record);
    assert.strictEqual(result.reach, 750);
  });

  it("handles zero impressions without division-by-zero", () => {
    const record = { impressions: 0, clicks: 0, costInUsd: "0" };
    const result = calculateStandardMetrics(record);
    assert.strictEqual(result.ctr, null);
    assert.strictEqual(result.cpm, null);
    assert.strictEqual(result.engagementRate, null);
  });

  it("handles zero clicks without division-by-zero", () => {
    const record = { impressions: 1000, clicks: 0, costInUsd: "100" };
    const result = calculateStandardMetrics(record);
    assert.strictEqual(result.cpc, null);
    assert.strictEqual(result.conversionRate, null);
  });

  it("handles zero conversions without division-by-zero", () => {
    const record = { impressions: 1000, clicks: 100, costInUsd: "100", externalWebsiteConversions: 0 };
    const result = calculateStandardMetrics(record);
    assert.strictEqual(result.costPerConversion, null);
  });

  it("parses costInUsd from string", () => {
    const result = calculateStandardMetrics({ costInUsd: "123.45" });
    assert.strictEqual(result.spend, 123.45);
  });

  it("handles malformed costInUsd gracefully", () => {
    const result = calculateStandardMetrics({ costInUsd: "not-a-number" });
    assert.strictEqual(result.spend, 0);
  });

  it("calculates audiencePenetration from estimatedAudienceSize fallback", () => {
    const record = { impressions: 1000, approximateUniqueImpressions: 500 };
    const result = calculateStandardMetrics(record, 10000);
    assert.strictEqual(result.audiencePenetration, 5); // 500/10000*100
  });

  it("prefers native audiencePenetration over fallback", () => {
    const record = {
      impressions: 1000,
      approximateUniqueImpressions: 500,
      audiencePenetration: 0.075,
    };
    const result = calculateStandardMetrics(record, 10000);
    assert.strictEqual(result.audiencePenetration, 7.5); // native: 0.075*100
  });

  it("rounds averageDwellTime to 2 decimals", () => {
    const record = { averageDwellTime: 3.14159 };
    const result = calculateStandardMetrics(record);
    assert.strictEqual(result.averageDwellTime, 3.14);
  });

  it("returns null averageDwellTime when missing", () => {
    const result = calculateStandardMetrics({});
    assert.strictEqual(result.averageDwellTime, null);
  });
});

describe("DEMOGRAPHIC_TYPE_MAP", () => {
  it("contains expected pivot names", () => {
    assert.strictEqual(DEMOGRAPHIC_TYPE_MAP.MEMBER_JOB_FUNCTION, "Job Function");
    assert.strictEqual(DEMOGRAPHIC_TYPE_MAP.MEMBER_SENIORITY, "Seniority");
    assert.strictEqual(DEMOGRAPHIC_TYPE_MAP.MEMBER_INDUSTRY, "Industry");
    assert.strictEqual(DEMOGRAPHIC_TYPE_MAP.MEMBER_COUNTRY, "Country");
    assert.strictEqual(DEMOGRAPHIC_TYPE_MAP.MEMBER_REGION_V2, "Region");
  });
});
