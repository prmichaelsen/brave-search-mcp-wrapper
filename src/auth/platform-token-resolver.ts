#!/usr/bin/env node

/**
 * Platform Token Resolver
 * 
 * Resolves tokens by calling the platform's credentials API with the user's JWT token.
 */

import type { ResourceTokenResolver } from '@prmichaelsen/mcp-auth';
import type { PlatformJWTProvider } from './platform-jwt-provider.js';

export interface PlatformTokenResolverConfig {
  platformUrl: string;
  authProvider: PlatformJWTProvider;
  cacheTokens?: boolean;
  cacheTtl?: number;
}

interface CachedToken {
  apiKey: string;
  expiresAt: number;
}

/**
 * Platform Token Resolver
 * 
 * Resolves Brave API keys from platform API using the user's JWT token.
 */
export class PlatformTokenResolver implements ResourceTokenResolver {
  private config: PlatformTokenResolverConfig;
  private tokenCache = new Map<string, CachedToken>();
  
  constructor(config: PlatformTokenResolverConfig) {
    this.config = config;
  }
  
  async initialize(): Promise<void> {
    console.log('[PlatformTokenResolver] Initialized');
  }
  
  async resolveToken(userId: string, resourceType: string): Promise<string | null> {
    try {
      const cacheKey = `${userId}:${resourceType}`;
      
      // Check cache
      if (this.config.cacheTokens !== false) {
        const cached = this.tokenCache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
          return cached.apiKey;
        }
      }
      
      // Get JWT token from auth provider
      const jwtToken = this.config.authProvider.getJWTToken(userId);
      if (!jwtToken) {
        console.warn(`[PlatformTokenResolver] No JWT token for user ${userId}`);
        return null;
      }
      
      // Call platform API to get credentials
      const url = `${this.config.platformUrl}/api/credentials/${resourceType}`;
      console.log(`[PlatformTokenResolver] Calling ${url} for user ${userId}`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[PlatformTokenResolver] API error: ${response.status}`, errorText);
        return null;
      }
      
      const data = await response.json() as { access_token?: string; BRAVE_API_KEY?: string };
      
      // Extract API key from response
      const apiKey = data.access_token || data.BRAVE_API_KEY;
      
      if (!apiKey) {
        console.warn('[PlatformTokenResolver] No API key in response');
        return null;
      }
      
      // Cache API key
      if (this.config.cacheTokens !== false) {
        const ttl = this.config.cacheTtl || 300000; // 5 minutes
        this.tokenCache.set(cacheKey, {
          apiKey,
          expiresAt: Date.now() + ttl
        });
      }
      
      console.log(`[PlatformTokenResolver] Resolved API key for user ${userId}`);
      return apiKey;
      
    } catch (error) {
      console.error('[PlatformTokenResolver] Failed to resolve token:', error);
      return null;
    }
  }
  
  async cleanup(): Promise<void> {
    this.tokenCache.clear();
  }
}
