# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-16

### Added
- Initial release
- Multi-agent communication system via YAML files
- VS Code Extension for terminal control (port 3773)
- `relay-init` command for project initialization
- `relay-start` command for starting agents
- Leader and Member role templates
- Event-driven notification using fswatch
- Two-phase send approach for human-like input simulation
- Support for 2+ terminal panes configuration

### Security
- HTTP server runs on localhost only (no network exposure)
- No authentication required (local development only)
