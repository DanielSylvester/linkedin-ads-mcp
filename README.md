# LinkedIn Ads MCP Server

A Model Context Protocol (MCP) server that exposes the LinkedIn Marketing API as AI-callable tools. Manage campaigns, analyze demographics, track conversions, and optimize ad performance — all via natural language.

## Features

- **25+ MCP Tools** covering accounts, campaigns, creatives, audiences, conversions, analytics, and full campaign management
- **Standard Metrics on Every Report** — CTR, CPC, CPM, conversion rate, cost per conversion, audience penetration, average dwell time
- **Audience Demographics** — Break down performance by job function, seniority, industry, company size, geography
- **Conversions & Lead Gen** — Track conversion actions, lead form submissions, qualified leads, cost/lead
- **Advanced Analytics** — Period comparisons, daily trends with weekday analysis
- **Production-Grade API Client** — Exponential backoff, rate limit handling, RestLi partial updates, batch fetching
- **Creative Content Resolution** — Automatically resolves post/share content, image URLs, detects content type
- **Image Upload** — Upload images for use in inline ads
- **Draft-Aware Deletes** — Draft entities delete immediately; live entities set to PENDING_DELETION

## Prerequisites

- Node.js >= 20.0.0
- LinkedIn Marketing API OAuth 2.0 access token

## Installation

```bash
npm install
npm run build
```

## Configuration

Set the following environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LINKEDIN_ACCESS_TOKEN` | Yes | — | LinkedIn OAuth 2.0 access token |
| `LINKEDIN_API_VERSION` | No | `202407` | LinkedIn API version header |
| `MCP_SERVER_NAME` | No | `linkedin-ads-mcp` | Server identifier |
| `MCP_SERVER_VERSION` | No | `1.1.0` | Server version |

```bash
export LINKEDIN_ACCESS_TOKEN="your_token_here"
node dist/index.js
```

## Available Tools

### Account Management
| Tool | Description |
|------|-------------|
| `linkedin_ads_list_accounts` | List ad accounts (filter by status, type, include test) |
| `linkedin_ads_get_account` | Get detailed account configuration |

### Campaign Groups
| Tool | Description |
|------|-------------|
| `linkedin_ads_list_campaign_groups` | List groups with optional performance |
| `linkedin_ads_get_campaign_group` | Get a single group |
| `linkedin_ads_create_campaign_group` | Create a new group |
| `linkedin_ads_update_campaign_group` | Partial update (status, budget, schedule) |
| `linkedin_ads_delete_campaign_group` | Draft-aware delete |

### Campaigns
| Tool | Description |
|------|-------------|
| `linkedin_ads_list_campaigns` | List ALL campaigns including drafts/paused |
| `linkedin_ads_get_campaign` | Get a single campaign |
| `linkedin_ads_create_campaign` | Create with targeting, budget, objective |
| `linkedin_ads_update_campaign` | Partial update |
| `linkedin_ads_delete_campaign` | Draft-aware delete |
| `linkedin_ads_get_campaign_performance` | Standard KPIs with campaign names resolved |

### Creatives
| Tool | Description |
|------|-------------|
| `linkedin_ads_list_creatives` | List creatives for campaign/account |
| `linkedin_ads_get_creative` | Get a single creative |
| `linkedin_ads_create_creative` | Create from existing post/share |
| `linkedin_ads_create_inline_ad` | Create ad with inline content (text, image, CTA) |
| `linkedin_ads_update_creative_status` | Activate, pause, or archive |
| `linkedin_ads_get_creative_performance` | Standard KPIs + engagement + video metrics |
| `linkedin_ads_upload_image` | Upload image for ads (PNG, JPG, GIF) |

### Audience & Demographics
| Tool | Description |
|------|-------------|
| `linkedin_ads_get_audience_demographics` | Breakdown by job function, industry, seniority, geo, etc. |
| `linkedin_ads_get_audience_reach` | Unique reach, frequency, audience penetration (≤92 days) |
| `linkedin_ads_list_saved_audiences` | Matched, lookalike, predictive audiences |

### Conversions & Lead Gen
| Tool | Description |
|------|-------------|
| `linkedin_ads_get_conversion_performance` | Conversions by action with post-click/post-view split |
| `linkedin_ads_list_conversions` | Conversion tracking rules and attribution windows |
| `linkedin_ads_get_lead_gen_performance` | Leads, qualified leads, cost/lead, form open→submit rate |
| `linkedin_ads_list_lead_forms` | Lead form configs including questions |

### Advanced Analytics
| Tool | Description |
|------|-------------|
| `linkedin_ads_compare_performance` | Compare periods, campaigns, or campaign groups with % changes |
| `linkedin_ads_get_daily_trends` | Daily time-series with weekday averages, peak/lowest days |
| `linkedin_ads_get_analytics` | Full-power analytics with 16+ pivot dimensions |
| `linkedin_ads_get_campaign_stats` | Simplified stats for campaign IDs (last 30 days default) |

## Standard Metrics

Every performance report includes these calculated KPIs:

| Metric | Description |
|--------|-------------|
| **Spend** | Total cost in USD |
| **Impressions** | Times ads were shown |
| **Clicks** | Total clicks |
| **CTR** | Click-through rate (%) |
| **Reach** | Approximate unique impressions |
| **Frequency** | Avg impressions per unique |
| **Engagements** | Likes, comments, shares, etc. |
| **Engagement Rate** | Engagements / Impressions (%) |
| **CPM** | Cost per 1,000 impressions |
| **CPC** | Cost per click |
| **Conversions** | Total conversion events |
| **Conversion Rate** | Conversions / Clicks (%) |
| **Cost per Conversion** | Spend / Conversions |
| **Audience Penetration** | Reach / target audience (%) |
| **Average Dwell Time** | Seconds with >50% ad visible |

## Example Prompts

```
"List my LinkedIn ad accounts"
"Show me all ACTIVE campaigns"
"Get campaign performance for the last 30 days"
"Which job functions are responding best to my ads?"
"Compare this week's performance vs last week"
"What's my cost per lead for lead gen campaigns?"
"Show me daily trends for the last 14 days"
"List my saved audiences"
"Upload an image for my new ad"
"Create an inline ad with this text and image"
```

## Project Structure

```
src/
├── index.ts              # Entry point
├── server.ts             # MCP server setup
├── config.ts             # Environment configuration
├── types.ts              # LinkedIn API TypeScript types
├── errors.ts             # Custom error classes
├── linkedin-client.ts    # LinkedIn API HTTP client
├── tool-registry.ts      # Tool registration system
├── lib/
│   └── metrics.ts        # Standard metrics calculator
└── tools/
    ├── accounts.ts       # Ad account tools
    ├── campaign-groups.ts # Campaign group tools
    ├── campaigns.ts      # Campaign tools + performance
    ├── creatives.ts      # Creative tools + performance + image upload
    ├── reporting.ts      # Analytics & raw reporting
    ├── demographics.ts   # Audience demographics + reach + saved audiences
    ├── conversions.ts    # Conversions + lead gen
    └── analytics.ts      # Compare performance + daily trends
```

## License

MIT
