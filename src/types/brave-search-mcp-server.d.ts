// Type declarations for @brave/brave-search-mcp-server
declare module '@brave/brave-search-mcp-server' {
  import { Server } from '@modelcontextprotocol/sdk/server/index.js';
  
  export interface SmitheryConfig {
    braveApiKey: string;
    enabledTools?: string[];
    disabledTools?: string[];
    loggingLevel?: 'debug' | 'error' | 'info' | 'notice' | 'warning' | 'critical' | 'alert' | 'emergency';
    stateless?: boolean;
  }
  
  export interface CreateMcpServerOptions {
    config: SmitheryConfig;
  }
  
  export default function createMcpServer(options?: CreateMcpServerOptions): Server;
  
  export const configSchema: any;
}
