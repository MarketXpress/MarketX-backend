# MarketX Backend Security Testing Guide

## Overview

This module provides automated Dynamic Application Security Testing (DAST) for the MarketX Backend using OWASP ZAP. It focuses on detecting SQL Injection and Cross-Site Request Forgery (CSRF/XSRF) vulnerabilities.

## Quick Start

### Run Full Security Scan

```bash
# Start all services including ZAP scanner
npm run security:docker

# Or run with specific scanner
npm run security:zap

# For full comprehensive scan
npm run security:zap-full
```

### Run Node.js Security Tester

```bash
# Ensure API is running first
npm run start:dev

# In another terminal
npm run security:scan
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Security Testing Network                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐        ┌─────────────┐       ┌──────────┐   │
│   │ OWASP ZAP    │───────▶│ MarketX API │       │ Reports  │   │
│   │ Scanner      │        │ (Target)    │       │ Storage  │   │
│   └──────────────┘        └─────────────┘       └──────────┘   │
│         │                                               ▲       │
│         │              ┌─────────────┐                   │       │
│         └─────────────▶│ PostgreSQL │───────────────────┘       │
│                        └─────────────┘                            │
│         │              ┌─────────────┐                            │
│         └─────────────▶│   Redis     │                            │
│                        └─────────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Security Test Coverage

### SQL Injection Testing

| Category | Description | Payload Count |
|----------|-------------|---------------|
| Classic SQLi | Basic injection patterns | 30+ |
| UNION-based | Complex UNION attacks | 20+ |
| Blind Boolean | True/false based | 15+ |
| Time-based | SLEEP/BENCHMARK attacks | 10+ |
| Error-based | Database error exploitation | 15+ |
| Stacked Queries | Multiple statements | 20+ |
| ORM Bypass | Framework-specific | 25+ |
| Malformed Payloads | Heavy obfuscation | 100+ |

### CSRF/XSRF Testing

| Test Type | Description |
|-----------|-------------|
| Form CSRF | Standard form submission attacks |
| JSON CSRF | JSON payload attacks |
| XML CSRF | XML/SOAP injection |
| Origin Bypass | Origin header manipulation |
| Referer Bypass | Referer validation bypass |
| CORS Exploitation | Cross-origin attacks |
| Token Bypass | CSRF token validation |

## Configuration

### Environment Variables

```env
ZAP_HOST=zap              # ZAP container hostname
ZAP_PORT=8080             # ZAP API port
ZAP_API_KEY=your_api_key  # ZAP API key (change in production!)
API_HOST=api              # Target API hostname
API_PORT=3000             # Target API port
```

### ZAP Configuration

Edit [`zap-baseline.conf`](security/zap/zap-baseline.conf) to customize:

- Scan policies
- Attack strength
- Alert thresholds
- Custom payloads

## Payloads

### SQL Injection Payloads

Located in [`security/zap/payloads/sql-injection.txt`](security/zap/payloads/sql-injection.txt):

- Classic injection: `' OR '1'='1`
- Malformed: `';;;DROP TABLE users;;`
- Time-based: `' AND SLEEP(5)--`
- Stacked: `'; SELECT * FROM users; --`

### CSRF Payloads

Located in [`security/zap/payloads/csrf.txt`](security/zap/payloads/csrf.txt):

- Form submissions without CSRF tokens
- JSON payloads with malicious origins
- XML payloads with injected content

## Reports

Reports are generated in multiple formats:

- **JSON**: Machine-readable format
- **HTML**: Human-readable with styling
- **XML**: Compatible with CI/CD tools

### Report Locations

```
security/zap/reports/
├── marketx_security_20260329_123456.json
├── marketx_security_20260329_123456.html
├── marketx_security_20260329_123456_summary.txt
└── zap_report.json
```

## Usage

### Docker Compose

```bash
# Start infrastructure + ZAP scanner
docker compose --profile security-test up -d

# View ZAP reports
ls -la security/zap/reports/

# Stop services
docker compose --profile security-test down
```

### Standalone Script

```bash
# Make executable
chmod +x security/zap/scripts/run-security-tests.sh

# Run
./security/zap/scripts/run-security-tests.sh
```

### Node.js Runner

```bash
# Run full test suite
node security/zap/security-tester.js

# With custom configuration
ZAP_HOST=localhost ZAP_PORT=8080 node security/zap/security-tester.js
```

## CI/CD Integration

### GitHub Actions

Add to your workflow:

```yaml
security-test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    
    - name: Start Infrastructure
      run: docker compose up -d
    
    - name: Run Security Scan
      run: |
        sleep 10
        docker compose run --rm zap || true
    
    - name: Upload Reports
      uses: actions/upload-artifact@v3
      with:
        name: security-reports
        path: security/zap/reports/
```

### GitLab CI

```yaml
security_scan:
  stage: test
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker compose up -d
    - docker compose run --rm zap
  artifacts:
    paths:
      - security/zap/reports/
```

## Alert Severity Levels

| Level | Description | Action Required |
|-------|-------------|-----------------|
| HIGH | Direct exploitation possible | Immediate |
| MEDIUM | Could lead to exploitation | Soon |
| LOW | Potential issue | Investigate |
| INFO | Informational | Review |

## Remediation Checklist

- [ ] Implement parameterized queries
- [ ] Enable ORM SQL injection protection
- [ ] Add CSRF tokens to all forms
- [ ] Enable SameSite cookies
- [ ] Implement Origin/Referer validation
- [ ] Apply Content Security Policy (CSP)
- [ ] Regular security audits

## Troubleshooting

### ZAP not starting

```bash
# Check ZAP logs
docker compose logs zap

# Verify network connectivity
docker exec marketx_zap_scanner ping api
```

### API not responding to scanner

```bash
# Ensure API is healthy
docker compose ps api

# Check API logs
docker compose logs api
```

### Scan timeout

Increase timeout in configuration:

```yaml
ascan:
  maxDuration: 120  # Increase from 60
```

## License

Part of MarketX Backend - Security Testing Module
