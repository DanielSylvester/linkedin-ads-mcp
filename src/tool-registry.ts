import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export interface McpTool extends Tool {}

export type ToolHandler = (args: unknown) => Promise<{
  content: Array<{ type: "text"; text: string }>;
}>;

export class ToolRegistry {
  private tools = new Map<string, McpTool>();
  private handlers = new Map<string, ToolHandler>();

  register(tool: McpTool, handler: ToolHandler): void {
    this.tools.set(tool.name, tool);
    this.handlers.set(tool.name, handler);
  }

  getToolList(): McpTool[] {
    return Array.from(this.tools.values());
  }

  getHandler(name: string): ToolHandler | undefined {
    return this.handlers.get(name);
  }
}
