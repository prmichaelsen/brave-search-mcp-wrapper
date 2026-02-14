#!/usr/bin/env node

/**
 * Brave Search MCP Wrapper - Multi-tenant wrapper with Platform JWT auth
 * 
 * This server wraps @brave/brave-search-mcp-server with authentication and multi-tenancy support.
 */

import { wrapServer, SimpleTokenResolver } from '@prmichaelsen/mcp-auth';
import createBraveSearchServer from '@brave/brave-search-mcp-server/dist/server.js';
import { PlatformJWTProvider } from './auth/platform-jwt-provider.js';

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

// Validate API key configuration
if (!config.braveApiKey && !config.platform.url) {
  console.error('Error: Either BRAVE_API_KEY or PLATFORM_URL must be configured');
  console.error('- BRAVE_API_KEY: Use a shared API key for all users (simple)');
  console.error('- PLATFORM_URL: Use per-user API keys from platform API (advanced)');
  process.exit(1);
}

console.log('🔧 Configuration:');
console.log(`  - API Key Mode: ${config.braveApiKey ? 'Shared' : 'Per-User (Platform API)'}`);
console.log(`  - Port: ${config.server.port}`);

// Create auth provider
const authProvider = new PlatformJWTProvider({
  serviceToken: config.platform.serviceToken,
  issuer: 'agentbase.me',
  audience: 'mcp-server',
  cacheResults: true,
  cacheTtl: 60000 // 60 seconds
});

// Wrap server with authentication
const wrappedServer = wrapServer({
  serverFactory: (_accessToken: string, userId: string) => {
    console.log(`[Factory] Creating Brave Search server for user: ${userId}`);
    
    // Use shared BRAVE_API_KEY from environment for all users
    const braveApiKey = config.braveApiKey!;
    
    // Create server with shared Brave API key
    return createBraveSearchServer({
      config: {
        braveApiKey: braveApiKey,
        loggingLevel: 'info',
        stateless: true, // Important for multi-tenant deployments
      }
    });
  },
  authProvider,
  resourceType: 'brave-search',
  // No tokenResolver for static servers - we use shared key from environment
  transport: {
    type: 'http',
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
