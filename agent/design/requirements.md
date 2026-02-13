# Brave Search MCP Wrapper - Requirements

**Project Name**: Brave Search MCP Wrapper
**Created**: 2026-02-13
**Status**: Active

---

## Overview

A multi-tenant wrapper for the Brave Search MCP server that enables Platform JWT authentication and per-user Brave API key management. This wrapper allows multiple users to access Brave Search functionality through a single deployed service, with each user's requests authenticated via JWT tokens and routed through their individual Brave API keys.

---

## Problem Statement

The existing [`@brave/brave-search-mcp-server`](https://github.com/brave/brave-search-mcp-server) package requires each user to run their own local instance with their own API key. This creates several challenges:

1. **Deployment Complexity**: Each user must install and configure the server locally
2. **No Multi-Tenancy**: Cannot serve multiple users from a single deployment
3. **No Authentication**: No built-in user authentication or authorization
4. **Management Overhead**: Users must manage their own API keys and server instances
5. **No Centralized Control**: Cannot enforce rate limits, logging, or monitoring across users

---

## Goals and Objectives

### Primary Goals
1. **Multi-Tenant Support**: Enable a single server deployment to serve multiple users
2. **Platform JWT Authentication**: Integrate with platform JWT-based authentication system
3. **Per-User API Keys**: Each user's requests use their own Brave API key
4. **Zero Modification**: Wrap existing `@brave/brave-search-mcp-server` without modifying it
5. **Cloud Deployment**: Deploy to Google Cloud Run for scalability

### Secondary Goals
1. **Rate Limiting**: Implement per-user rate limiting
2. **Audit Logging**: Track all operations with user attribution
3. **Monitoring**: Provide visibility into usage patterns and errors
4. **CORS Support**: Enable browser-based clients to connect

---

## Functional Requirements

### Core Features

1. **JWT Authentication**
   - Validate Platform JWT tokens on every request
   - Extract userId from JWT claims
   - Verify token signature, issuer, and audience
   - Cache authentication results for performance

2. **API Key Resolution**
   - Query platform API to retrieve user's Brave API key
   - Cache API keys to reduce platform API calls
   - Handle missing or invalid API keys gracefully
   - Support key rotation without downtime

3. **Server Factory Pattern**
   - Create isolated server instances per user
   - Pass user's API key to Brave Search server
   - No shared state between user instances
   - Proper cleanup of inactive instances

4. **MCP Protocol Support**
   - Support SSE (Server-Sent Events) transport
   - Handle all MCP protocol messages correctly
   - Maintain compatibility with MCP clients
   - Proper error handling and responses

### Additional Features

1. **Rate Limiting**
   - Per-user request limits (100 requests/hour)
   - Configurable limits via environment variables
   - Clear error messages when limits exceeded

2. **CORS Configuration**
   - Configurable allowed origins
   - Support for platform domain
   - Proper preflight handling

3. **Health Checks**
   - `/health` endpoint for monitoring
   - Readiness and liveness probes
   - Service status reporting

---

## Non-Functional Requirements

### Performance
- JWT validation < 10ms (cached)
- API key resolution < 50ms (cached)
- Server instance creation < 100ms
- Support 100+ concurrent users
- Cache hit rate > 90% for auth and tokens

### Security
- All JWT tokens validated with shared secret
- API keys never logged or exposed
- Complete isolation between user instances
- HTTPS only in production
- Secrets stored in Google Secret Manager
- No API keys in environment variables or code

### Scalability
- Horizontal scaling via Cloud Run
- Stateless design for easy scaling
- Auto-scaling based on load
- Support 1000+ requests/minute

### Reliability
- 99.9% uptime target
- Graceful degradation when platform API unavailable
- Automatic retry with exponential backoff
- Proper error handling and logging
- Health checks for monitoring

---

## Technical Requirements

### Technology Stack
- **Language**: TypeScript 5.x
- **Runtime**: Node.js 18+
- **Protocol**: Model Context Protocol (MCP)
- **Base Package**: `@brave/brave-search-mcp-server` v2.0.72+
- **Auth Framework**: `@prmichaelsen/mcp-auth` v7.0.0+
- **Platform**: Google Cloud Run
- **Container**: Docker

### Dependencies
- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `@brave/brave-search-mcp-server`: Underlying Brave Search server
- `@prmichaelsen/mcp-auth`: Multi-tenant authentication framework
- `jsonwebtoken`: JWT validation

### Integrations
- **Platform API**: User authentication and API key retrieval
- **Brave Search API**: Search functionality via user API keys
- **Google Cloud Run**: Deployment and hosting
- **Google Secret Manager**: Secure secret storage

---

## User Stories

### As a Platform User
1. I want to use Brave Search through the platform so that I don't need to run my own server
2. I want my searches to use my own API key so that I control my usage and billing
3. I want my data isolated from other users so that my privacy is protected
4. I want fast responses so that I can work efficiently

### As a Platform Administrator
1. I want to deploy one server for all users so that I minimize infrastructure costs
2. I want to monitor usage patterns so that I can optimize performance
3. I want to enforce rate limits so that I prevent abuse
4. I want audit logs so that I can track usage and troubleshoot issues

### As a Developer
1. I want clear error messages so that I can debug issues quickly
2. I want the wrapper to be maintainable so that I can update it easily
3. I want the base package to remain unmodified so that I can upgrade it independently
4. I want comprehensive documentation so that I can understand the architecture

---

## Constraints

### Technical Constraints
- Must use existing `@brave/brave-search-mcp-server` package without modification
- Must integrate with existing platform JWT authentication
- Must deploy to Google Cloud Run
- Must use SSE transport (stdio not suitable for remote deployment)
- Platform API must be available for API key resolution

### Business Constraints
- Must launch within 2 weeks
- Must support existing platform users
- Must comply with Brave API terms of service
- Must handle API key rotation gracefully

### Resource Constraints
- Single developer for implementation
- Limited budget for cloud infrastructure
- Must use existing platform infrastructure where possible

---

## Success Criteria

### MVP Success Criteria
- [ ] Users can authenticate with Platform JWT tokens
- [ ] User API keys are retrieved from platform API
- [ ] Brave Search tools work correctly for authenticated users
- [ ] Multiple users can use the service simultaneously
- [ ] Deployed to Cloud Run and accessible via HTTPS
- [ ] Basic monitoring and logging in place

### Full Release Success Criteria
- [ ] All core and additional features implemented
- [ ] Rate limiting enforced per user
- [ ] Comprehensive error handling
- [ ] Security audit passed
- [ ] 10+ active users with positive feedback
- [ ] Documentation complete (README, deployment guide)
- [ ] Monitoring dashboard configured

---

## Out of Scope

1. **Custom Search Features**: Only features provided by base package
2. **User Management**: Handled by platform, not this wrapper
3. **API Key Management UI**: Users manage keys through platform
4. **Advanced Analytics**: Basic logging only, no complex analytics
5. **Multiple Search Providers**: Brave Search only
6. **On-Premise Deployment**: Cloud Run only for MVP

---

## Assumptions

1. Platform API is reliable and available
2. Users have valid Brave API keys configured in platform
3. Platform JWT tokens are properly signed and valid
4. Google Cloud Run will scale to meet demand
5. Brave Search API remains stable and available
6. Users understand they need their own Brave API keys

---

## Risks

| Risk | Impact | Probability | Mitigation Strategy |
|------|--------|-------------|---------------------|
| Platform API downtime | High | Low | Cache API keys aggressively, implement fallback |
| Brave API rate limits | Medium | Medium | Enforce per-user limits, clear error messages |
| JWT token compromise | High | Low | Regular secret rotation, monitoring for abuse |
| Cloud Run costs escalate | Medium | Low | Implement rate limiting, monitor usage |
| Base package breaking changes | Medium | Low | Pin version, test upgrades thoroughly |

---

## Timeline

### Phase 1: Foundation (Days 1-3)
- Project setup and structure
- Authentication providers implementation
- Basic wrapper functionality

### Phase 2: Integration (Days 4-7)
- Platform API integration
- Server factory implementation
- Testing with real users

### Phase 3: Deployment (Days 8-10)
- Docker containerization
- Cloud Run deployment
- Monitoring setup

### Phase 4: Polish (Days 11-14)
- Documentation
- Bug fixes
- Performance optimization

---

## Stakeholders

| Role | Name/Team | Responsibilities |
|------|-----------|------------------|
| Product Owner | Platform Team | Define requirements, prioritize features |
| Lead Developer | Agent | Architecture, implementation, deployment |
| Platform Users | End Users | Provide feedback, report issues |
| Platform Admin | Platform Team | Monitor service, manage infrastructure |

---

## References

- [Brave Search MCP Server](https://github.com/brave/brave-search-mcp-server): Base package
- [mcp-auth Framework](https://github.com/prmichaelsen/mcp-auth): Authentication framework
- [Instagram MCP Wrapper](https://github.com/prmichaelsen/agentbase-mcp-server): Reference implementation
- [Model Context Protocol](https://modelcontextprotocol.io): MCP specification
- [Google Cloud Run](https://cloud.google.com/run): Deployment platform

---

**Status**: Active - Ready for implementation
**Last Updated**: 2026-02-13
**Next Review**: After MVP completion
