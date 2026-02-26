/**
 * Schema Transformer
 * 
 * Removes outputSchema from tool definitions to prevent validation errors.
 * The platform's schema validator can't handle complex nested schemas.
 */

export interface Tool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: any;
  annotations?: any;
}

/**
 * Transform tools by removing outputSchema
 * 
 * The MCP spec makes outputSchema optional, and it's not needed for tool execution.
 * Removing it prevents schema validation errors on the platform side.
 */
export function transformTools(tools: Tool[]): Tool[] {
  return tools.map(tool => {
    // Create a copy without outputSchema
    const { ...cleanTool } = tool;
    
    // Remove outputSchema if it exists
    if ('outputSchema' in cleanTool) {
      delete (cleanTool as any).outputSchema;
    }
    
    console.log(`[Transformer] Cleaned tool: ${tool.name}`);
    return cleanTool;
  });
}
