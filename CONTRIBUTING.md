# Contributing to Evara

Thank you for your interest in contributing to Evara.

## Code Standards

1. **Vendor Independence**: Never introduce proprietary runtime dependencies, hardcoded cloud services, or platform-specific APIs.
2. **TypeScript & Strict Types**: All code must pass `pnpm check` without errors.
3. **Automated Testing**: Write unit and integration tests for new business logic, security constraints, and database queries.
4. **Data Ownership**: Ensure all new health or private user endpoints are scoped strictly to `ctx.user.id`.
5. **Fail Closed**: Session, authorization, and cryptographic operations must always fail closed.

## Pull Request Checklist

Before submitting a PR, verify:
- [ ] `pnpm check` passes
- [ ] `pnpm test` passes (all test suites succeed)
- [ ] `pnpm build` succeeds
- [ ] No secrets or `.env` files committed
- [ ] Documentation updated if adding environment variables or architectural components
