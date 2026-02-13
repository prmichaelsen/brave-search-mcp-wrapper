# Brave Search MCP Wrapper

Multi-tenant wrapper for the Brave Search MCP server with Platform JWT authentication. Enables multiple users to access Brave Search functionality through a single deployed service, with each user's requests authenticated via JWT tokens and routed through their individual Brave API keys.

## Overview

This project wraps the [`@brave/brave-search-mcp-server`](https://github.com/brave/brave-search-mcp-server) package to provide:

- **Multi-Tenant Support**: Single server deployment serves multiple users
- **Platform JWT Authentication**: Secure authentication via platform JWT tokens
- **Per-User API Keys**: Each user's searches use their own Brave API key
- **Zero Modification**: Base package remains unmodified for easy upgrades
- **Cloud Deployment**: Deployed to Google Cloud Run for scalability

## Architecture

```
Client (Platform JWT)
  ↓
Platform JWT Provider (validates JWT → userId)
  ↓
Platform Token Resolver (userId → Brave API key via platform API)
  ↓
Brave Search Server Factory (creates per-user server instance)
  ↓
Brave Search API (via user's API key)
```

## Project Status

**Status**: 🚧 In Planning - Not yet implemented

See [`agent/progress.yaml`](agent/progress.yaml) for detailed progress tracking.

### Milestones

- [ ] **M1: Project Foundation** - Project setup, authentication providers, server factory
- [ ] **M2: Core Implementation** - Main entry point, integration, testing
- [ ] **M3: Deployment & Documentation** - Cloud Run deployment, documentation

## Documentation

This project uses the [Agent Context Protocol (ACP)](AGENT.md) for documentation and planning:

- **Requirements**: [`agent/design/requirements.md`](agent/design/requirements.md)
- **Bootstrap Pattern**: [`agent/design/bootstrap.md`](agent/design/bootstrap.md)
- **Progress Tracking**: [`agent/progress.yaml`](agent/progress.yaml)

## Quick Start (Coming Soon)

Once implemented, the server will be deployed to Cloud Run and accessible via:

```bash
# Example usage with MCP client
curl -X POST https://brave-search-mcp-wrapper.run.app/mcp/message \
  -H "Authorization: Bearer <platform-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

## Development

### Prerequisites

- Node.js 18+
- TypeScript 5.x
- Valid Brave API key for testing
- Platform JWT token for authentication

### Setup (Coming Soon)

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev

# Run tests
npm test
```

## Environment Variables

See [`.env.example`](.env.example) (to be created) for required environment variables:

- `PLATFORM_SERVICE_TOKEN`: Shared secret for JWT validation
- `PLATFORM_URL`: Platform API URL for user API key resolution
- `PORT`: Server port (default: 8080)
- `CORS_ORIGIN`: Allowed CORS origin

## Deployment

Deployment to Google Cloud Run will be configured via:

- [`Dockerfile`](Dockerfile) - Container configuration
- [`cloudbuild.yaml`](cloudbuild.yaml) - Build and deployment pipeline

## Reference Projects

- [Instagram MCP Wrapper](https://github.com/prmichaelsen/agentbase-mcp-server) - Similar wrapper implementation
- [mcp-auth Framework](https://github.com/prmichaelsen/mcp-auth) - Authentication framework used
- [Brave Search MCP Server](https://github.com/brave/brave-search-mcp-server) - Base package being wrapped

## Contributing

This project follows the Agent Context Protocol (ACP) for development:

1. Read [`AGENT.md`](AGENT.md) to understand the development methodology
2. Check [`agent/progress.yaml`](agent/progress.yaml) for current status
3. Review design documents in [`agent/design/`](agent/design/)
4. Follow patterns documented in [`agent/patterns/`](agent/patterns/)

## License

MIT

## Author

Patrick Michaelsen
