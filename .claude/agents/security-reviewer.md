# Security Reviewer Agent

Automated security review for pre-submission checks.

## Trigger
```
/security-review
```

## Checks
### Auth & Access
- [ ] All routes have authentication where needed
- [ ] Authorization checks (not just authn)
- [ ] JWT secrets not hardcoded
- [ ] Session tokens not logged

### Input Validation
- [ ] User inputs validated/sanitized
- [ ] SQL queries use parameterized statements (no string concat)
- [ ] File uploads restricted by type + size

### Secrets & Config
- [ ] No API keys/secrets in code (check with `git grep -i "secret\|password\|api_key"`)
- [ ] `.env` in `.gitignore`
- [ ] No credentials in git history

### Dependencies
- [ ] `npm audit` run
- [ ] No known vulnerable packages

### API Security
- [ ] CORS configured correctly (not `*` in production)
- [ ] Rate limiting on auth endpoints
- [ ] Error messages don't leak stack traces

### XSS / Injection
- [ ] No `dangerouslySetInnerHTML` with user data
- [ ] Content Security Policy header set
- [ ] Inputs escaped before rendering

## Run
```bash
git grep -rn "password\|secret\|api_key\|token" --include="*.js" --include="*.ts" --include="*.env"
npm audit
```
