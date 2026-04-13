# Contributing

Thanks for your interest in improving Home Lab Room Monitor.

## Ground Rules

- Keep secrets out of commits (`secrets.h`, `.env*`, tokens, Wi-Fi credentials).
- Prefer small, focused pull requests.
- Update documentation (`README.md` or `worker/README.md`) when behavior changes.
- Test both dashboard and API paths before opening a PR.

## Development Workflow

1. Fork and create a feature branch.
2. Make your changes.
3. Verify:
   - frontend still loads charts and cards
   - Worker endpoints return expected payloads
4. Open a pull request with clear context.

## Pull Request Checklist

- [ ] No credentials or private data committed
- [ ] Changes are documented
- [ ] Manual testing completed
- [ ] Existing behavior not broken

## Reporting Issues

When reporting a bug, include:
- what you expected
- what happened
- browser/device information
- logs or API response snippets (without secrets)
