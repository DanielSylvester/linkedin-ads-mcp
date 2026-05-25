export interface Config {
  LINKEDIN_ACCESS_TOKEN: string;
  LINKEDIN_API_VERSION: string;
  MCP_SERVER_NAME: string;
  MCP_SERVER_VERSION: string;
}

export function loadConfig(): Config {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      "Missing required environment variable: LINKEDIN_ACCESS_TOKEN"
    );
  }

  return {
    LINKEDIN_ACCESS_TOKEN: accessToken,
    LINKEDIN_API_VERSION: process.env.LINKEDIN_API_VERSION ?? "202407",
    MCP_SERVER_NAME: process.env.MCP_SERVER_NAME ?? "linkedin-ads-mcp",
    MCP_SERVER_VERSION: process.env.MCP_SERVER_VERSION ?? "1.0.0",
  };
}
