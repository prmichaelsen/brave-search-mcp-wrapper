#!/usr/bin/env node

/**
 * Brave Search MCP Wrapper - Multi-tenant wrapper with Platform JWT auth
 *
 * This server wraps @brave/brave-search-mcp-server with authentication and multi-tenancy support.
 */

import { wrapServer } from '@prmichaelsen/mcp-auth';
import createBraveSearchServer from '@brave/brave-search-mcp-server/dist/server.js';
import { PlatformJWTProvider } from './auth/platform-jwt-provider.js';
import { PlatformTokenResolver } from './auth/platform-token-resolver.js';
import { transformTools } from './utils/schema-transformer.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Configuration
const config = {
  platform: {
    url: process.env.PLATFORM_URL,
    serviceToken: process.env.PLATFORM_SERVICE_TOKEN!
  },
  server: {
    port: parseInt(process.env.PORT || '8080')
  },
  braveApiKey: process.env.BRAVE_API_KEY
};

// Validate required configuration
if (!config.platform.serviceToken) {
  console.error('Error: PLATFORM_SERVICE_TOKEN environment variable is required');
  console.error('This should match the service_token stored in the platform database for this MCP server');
  process.exit(1);
}

if (!config.platform.url) {
  console.error('Error: PLATFORM_URL environment variable is required');
  process.exit(1);
}

console.log('🔧 Configuration:');
console.log(`  - API Key Mode: Platform API (Static Credentials)`);
console.log(`  - Platform URL: ${config.platform.url}`);
console.log(`  - Port: ${config.server.port}`);

// Create auth provider
const authProvider = new PlatformJWTProvider({
  serviceToken: config.platform.serviceToken,
  issuer: 'agentbase.me',
  audience: 'mcp-server',
  cacheResults: true,
  cacheTtl: 60000 // 60 seconds
});

// Create token resolver
const tokenResolver = new PlatformTokenResolver({
  platformUrl: config.platform.url,
  authProvider: authProvider,
  cacheTokens: true,
  cacheTtl: 300000 // 5 minutes
});

// Wrap server with authentication
const wrappedServer = wrapServer({
  serverFactory: (accessToken: string, userId: string) => {
    console.log(`[Factory] Creating Brave Search server for user: ${userId}`);
    
    // Use API key from platform (static credentials)
    const braveApiKey = accessToken;
    console.log(`[Factory] Using API key: ${braveApiKey.substring(0, 10)}...`);
    
    // Create base server with Brave API key
    const baseServer: any = createBraveSearchServer({
      config: {
        braveApiKey: braveApiKey,
        loggingLevel: 'info',
        stateless: true, // Important for multi-tenant deployments
      }
    });
    
    // Wrap the listTools method to transform schemas
    const originalListTools = baseServer.listTools?.bind(baseServer);
    if (originalListTools) {
      baseServer.listTools = async function() {
        console.log(`[Factory] Listing tools for user: ${userId}`);
        const result = await originalListTools();
        
        // Transform tools to remove outputSchema (prevents validation errors)
        if (result?.tools) {
          console.log(`[Factory] Transforming ${result.tools.length} tools`);
          result.tools = transformTools(result.tools);
        }
        
        return result;
      };
    }
    
    return baseServer;
  },
  authProvider,
  tokenResolver,
  resourceType: 'brave-search',
  transport: {
    type: 'sse',
    port: config.server.port,
    host: '0.0.0.0',
    basePath: '/mcp',
    cors: true,
    corsOrigin: process.env.CORS_ORIGIN || 'https://agentbase.me'
  },
  middleware: {
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60 * 60 * 1000 // 1 hour
    },
    logging: {
      enabled: true,
      level: 'info'
    }
  }
});

// Start server
async function main() {
  try {
    await wrappedServer.start();
    console.log(`✅ Brave Search MCP Wrapper started successfully`);
    console.log(`📡 Listening on port ${config.server.port}`);
    console.log(`🔗 Endpoint: http://0.0.0.0:${config.server.port}/mcp`);
    console.log(`🏥 Health check: http://0.0.0.0:${config.server.port}/mcp/health`);
    console.log(`🔐 Authentication: Platform JWT (agentbase.me)`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await wrappedServer.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await wrappedServer.stop();
  process.exit(0);
});

// Start the server
main();
