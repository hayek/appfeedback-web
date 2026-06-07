# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

## [0.1.0]

Initial release (pending npm publish). The four `@appfeedback/*` packages:

### Added
- `@appfeedback/core` — the byte-exact wire format (formatter + parser, shared
  with the Apple/Android SDKs via the golden-fixture conformance suite), plus
  `RelayTransport` and the gated `DirectGitHubTransport`.
- `@appfeedback/relay` — `handleFeedback` + `createFetchHandler` (with optional
  CORS) and Firebase/Appwrite adapters for an adopter-hosted relay.
- `@appfeedback/widget` — the framework-agnostic, accessible feedback widget.
- `@appfeedback/react` — the `<FeedbackForm>` wrapper.
