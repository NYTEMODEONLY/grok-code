# Changelog

## [1.1.0] - 2025-09-26
### Added
- ESLint and Prettier for code quality
- Jest for testing
- CHANGELOG.md

### Changed
- Updated dependencies (openai to 5.x, inquirer to 12.x, etc.)
- Unified input handling to inquirer to fix crashes
- Removed unused src/ and test_*.js files

### Fixed
- CLI stability: No more 'readline closed' errors on exit
- Dependency vulnerabilities via npm audit fix

## [1.0.0] - 2025-09-26
- Initial release with RPG planning and CLI features
