# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-26

### Added
- Schema transformation utility to remove `outputSchema` from tool definitions
- Automatic tool schema transformation in server factory to prevent platform validation errors
- Logging for schema transformation operations

### Fixed
- Platform schema validation errors caused by complex nested `outputSchema` in Brave Search tools
- MCP client compatibility by removing optional `outputSchema` that breaks AJV validation

### Changed
- Server factory now wraps `listTools` method to transform tool responses
- Cast base server to `any` type to access internal MCP SDK methods

## [0.1.0] - 2026-02-13

### Added
- Initial release of Brave Search MCP Wrapper
- Multi-tenant authentication via Platform JWT
- Per-user API key resolution from platform
- Integration with @brave/brave-search-mcp-server
- Platform JWT Provider for authentication
- Platform Token Resolver for API key management
- Docker and Cloud Build configuration
- Comprehensive documentation and requirements
