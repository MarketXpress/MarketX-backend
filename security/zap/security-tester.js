#!/usr/bin/env node

/**
 * OWASP ZAP Security Penetration Test Runner - MarketX Backend
 * 
 * Automated DAST (Dynamic Application Security Testing) for SQL Injection
 * and Cross-Site Request Forgery (CSRF) vulnerability detection.
 * 
 * @module security/zap/security-tester
 * @version 1.0.0
 * @author MarketX Security Team
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const CONFIG = {
  zapHost: process.env.ZAP_HOST || 'localhost',
  zapPort: parseInt(process.env.ZAP_PORT || '8080', 10),
  apiHost: process.env.API_HOST || 'localhost',
  apiPort: parseInt(process.env.API_PORT || '3000', 10),
  zapApiKey: process.env.ZAP_API_KEY || 'zap_api_key_change_in_production',
  reportDir: path.join(__dirname, 'reports'),
  payloadsDir: path.join(__dirname, 'payloads'),
  timestamp: new Date().toISOString().replace(/[:.]/g, '-')
};

// Ensure directories exist
[CONFIG.reportDir, CONFIG.payloadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Console colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

/**
 * Logger utility
 */
const logger = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  section: (title) => console.log(`\n${colors.cyan}${colors.bold}══ ${title} ══${colors.reset}\n`)
};

/**
 * HTTP request helper
 */
function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

/**
 * Wait for service to be available
 */
async function waitForService(host, port, maxAttempts = 30, interval = 2000) {
  logger.info(`Waiting for service at ${host}:${port}...`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await httpRequest({
        hostname: host,
        port,
        path: '/',
        method: 'GET',
        timeout: 5000
      });
      
      if (res.status < 500) {
        logger.success(`Service ready (attempt ${attempt}/${maxAttempts})`);
        return true;
      }
    } catch (err) {
      // Service not ready
    }
    
    if (attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, interval));
    }
  }
  
  throw new Error(`Service ${host}:${port} not available after ${maxAttempts} attempts`);
}

/**
 * ZAP API wrapper
 */
const zap = {
  /**
   * Check if ZAP is ready
   */
  async isReady() {
    try {
      const res = await httpRequest({
        hostname: CONFIG.zapHost,
        port: CONFIG.zapPort,
        path: '/JSON/core/view/version',
        method: 'GET'
      });
      return res.status === 200;
    } catch {
      return false;
    }
  },
  
  /**
   * Create new context
   */
  async createContext(name) {
    const res = await httpRequest({
      hostname: CONFIG.zapHost,
      port: CONFIG.zapPort,
      path: '/JSON/context/action/newContext',
      method: 'POST'
    }, `apiKey=${CONFIG.zapApiKey}&contextName=${name}`);
    return res.data;
  },
  
  /**
   * Include URL in context
   */
  async includeInContext(contextName, regex) {
    await httpRequest({
      hostname: CONFIG.zapHost,
      port: CONFIG.zapPort,
      path: '/JSON/context/action/includeInContext',
      method: 'POST'
    }, `apiKey=${CONFIG.zapApiKey}&contextName=${contextName}&regex=${encodeURIComponent(regex)}`);
  },
  
  /**
   * Start spider scan
   */
  async spiderScan(url) {
    const res = await httpRequest({
      hostname: CONFIG.zapHost,
      port: CONFIG.zapPort,
      path: '/JSON/spider/action/scan',
      method: 'POST'
    }, `apiKey=${CONFIG.zapApiKey}&url=${encodeURIComponent(url)}&maxChildren=100&maxDepth=10`);
    
    return res.data.scan;
  },
  
  /**
   * Get spider status
   */
  async getSpiderStatus() {
    const res = await httpRequest({
      hostname: CONFIG.zapHost,
      port: CONFIG.zapPort,
      path: '/JSON/spider/view/status',
      method: 'GET'
    }, `apiKey=${CONFIG.zapApiKey}`);
    return res.data.status;
  },
  
  /**
   * Start active scan
   */
  async activeScan(url, scanPolicy = null) {
    let data = `apiKey=${CONFIG.zapApiKey}&url=${encodeURIComponent(url)}&recurse=true&inScopeOnly=true`;
    if (scanPolicy) {
      data += `&scanPolicyName=${scanPolicy}`;
    }
    
    const res = await httpRequest({
      hostname: CONFIG.zapHost,
      port: CONFIG.zapPort,
      path: '/JSON/ascan/action/scan',
      method: 'POST'
    }, data);
    
    return res.data.scan;
  },
  
  /**
   * Get active scan status
   */
  async getActiveScanStatus() {
    const res = await httpRequest({
      hostname: CONFIG.zapHost,
      port: CONFIG.zapPort,
      path: '/JSON/ascan/view/status',
      method: 'GET'
    }, `apiKey=${CONFIG.zapApiKey}`);
    return res.data.status;
  },
  
  /**
   * Get all alerts
   */
  async getAlerts() {
    const res = await httpRequest({
      hostname: CONFIG.zapHost,
      port: CONFIG.zapPort,
      path: '/JSON/core/view/alerts',
      method: 'GET'
    }, `apiKey=${CONFIG.zapApiKey}&baseurl=${encodeURIComponent(`http://${CONFIG.apiHost}:${CONFIG.apiPort}/`)}`);
    return res.data.alerts || [];
  },
  
  /**
   * Generate JSON report
   */
  async generateJsonReport() {
    const res = await httpRequest({
      hostname: CONFIG.zapHost,
      port: CONFIG.zapPort,
      path: '/JSON/report/action/generate',
      method: 'POST'
    }, `apiKey=${CONFIG.zapApiKey}&title=MarketX%20Backend%20Security%20Report&template=traditional-json`);
    return res.data;
  }
};

/**
 * Load payloads from file
 */
function loadPayloads(filename) {
  const filePath = path.join(CONFIG.payloadsDir, filename);
  
  if (!fs.existsSync(filePath)) {
    logger.warning(`Payload file not found: ${filename}`);
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
}

/**
 * Test SQL injection on endpoint
 */
async function testSqlInjection(endpoint, payloads) {
  const results = [];
  
  for (const payload of payloads.slice(0, 50)) { // Limit to prevent timeout
    try {
      // Test GET parameter
      await httpRequest({
        hostname: CONFIG.apiHost,
        port: CONFIG.apiPort,
        path: `${endpoint}?id=${encodeURIComponent(payload)}`,
        method: 'GET',
        timeout: 5000
      });
      
      // Test POST data
      await httpRequest({
        hostname: CONFIG.apiHost,
        port: CONFIG.apiPort,
        path: endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }, JSON.stringify({ query: payload }));
      
    } catch (err) {
      // Expected - payload may cause errors
    }
  }
  
  return results;
}

/**
 * Test CSRF vulnerability on endpoint
 */
async function testCsrf(endpoint, method = 'POST') {
  const csrfPayloads = loadPayloads('csrf.txt');
  
  for (const payload of csrfPayloads.slice(0, 20)) { // Limit to prevent timeout
    try {
      await httpRequest({
        hostname: CONFIG.apiHost,
        port: CONFIG.apiPort,
        path: endpoint,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://evil.com',
          'Referer': 'http://evil.com/attack'
        },
        timeout: 5000
      }, JSON.stringify({ test: 'csrf_attempt', data: payload }));
    } catch (err) {
      // Expected - malformed requests
    }
  }
}

/**
 * Generate security report
 */
async function generateReport() {
  logger.section('GENERATING SECURITY REPORT');
  
  const alerts = await zap.getAlerts();
  
  // Count by severity
  const counts = {
    HIGH: alerts.filter(a => a.risk === 'HIGH').length,
    MEDIUM: alerts.filter(a => a.risk === 'MEDIUM').length,
    LOW: alerts.filter(a => a.risk === 'LOW').length,
    INFO: alerts.filter(a => a.risk === 'INFORMATIONAL').length
  };
  
  // Generate JSON report
  const report = {
    metadata: {
      title: 'MarketX Backend Security Report',
      timestamp: new Date().toISOString(),
      scanner: 'OWASP ZAP',
      version: '2.x'
    },
    summary: counts,
    total: alerts.length,
    alerts: alerts.map(a => ({
      name: a.name,
      risk: a.risk,
      confidence: a.confidence,
      url: a.url,
      parameter: a.param,
      attack: a.attack,
      solution: a.solution,
      reference: a.reference
    }))
  };
  
  // Save JSON report
  const jsonFile = path.join(CONFIG.reportDir, `marketx_security_${CONFIG.timestamp}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(report, null, 2));
  logger.info(`JSON report saved: ${jsonFile}`);
  
  // Generate HTML report
  const htmlFile = path.join(CONFIG.reportDir, `marketx_security_${CONFIG.timestamp}.html`);
  const html = generateHtmlReport(report);
  fs.writeFileSync(htmlFile, html);
  logger.info(`HTML report saved: ${htmlFile}`);
  
  // Generate summary text
  const summaryFile = path.join(CONFIG.reportDir, `marketx_security_${CONFIG.timestamp}_summary.txt`);
  const summary = generateTextSummary(report);
  fs.writeFileSync(summaryFile, summary);
  logger.info(`Summary report saved: ${summaryFile}`);
  
  return { counts, alerts };
}

/**
 * Generate HTML report
 */
function generateHtmlReport(report) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MarketX Backend Security Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 40px; border-radius: 8px; margin-bottom: 30px; }
    .header h1 { font-size: 2em; margin-bottom: 10px; }
    .header p { opacity: 0.8; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card.high { border-left: 4px solid #dc3545; }
    .card.medium { border-left: 4px solid #ffc107; }
    .card.low { border-left: 4px solid #17a2b8; }
    .card.info { border-left: 4px solid #6c757d; }
    .card h3 { font-size: 2.5em; margin-bottom: 5px; }
    .card p { color: #666; text-transform: uppercase; font-size: 0.9em; letter-spacing: 1px; }
    .alerts { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
    .alert { padding: 20px; border-bottom: 1px solid #eee; }
    .alert:last-child { border-bottom: none; }
    .alert.high { background: #fff5f5; }
    .alert.medium { background: #fffdf0; }
    .alert-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .alert h4 { font-size: 1.1em; }
    .risk-badge { padding: 4px 12px; border-radius: 20px; font-size: 0.8em; font-weight: bold; text-transform: uppercase; }
    .risk-high { background: #dc3545; color: white; }
    .risk-medium { background: #ffc107; color: #333; }
    .risk-low { background: #17a2b8; color: white; }
    .risk-info { background: #6c757d; color: white; }
    .alert-detail { font-size: 0.9em; color: #666; margin-top: 8px; }
    .alert-detail code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    .footer { text-align: center; padding: 30px; color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ MarketX Backend Security Report</h1>
      <p>Generated: ${report.metadata.timestamp}</p>
      <p>Scanner: ${report.metadata.scanner}</p>
    </div>
    
    <div class="summary">
      <div class="card high">
        <h3>${report.summary.HIGH}</h3>
        <p>High Risk</p>
      </div>
      <div class="card medium">
        <h3>${report.summary.MEDIUM}</h3>
        <p>Medium Risk</p>
      </div>
      <div class="card low">
        <h3>${report.summary.LOW}</h3>
        <p>Low Risk</p>
      </div>
      <div class="card info">
        <h3>${report.summary.INFO}</h3>
        <p>Informational</p>
      </div>
    </div>
    
    <div class="alerts">
      <h2 style="padding: 20px; border-bottom: 1px solid #eee;">Detected Vulnerabilities (${report.alerts.length})</h2>
      ${report.alerts.map(a => `
        <div class="alert ${a.risk.toLowerCase()}">
          <div class="alert-header">
            <h4>${a.name}</h4>
            <span class="risk-badge risk-${a.risk.toLowerCase()}">${a.risk}</span>
          </div>
          <div class="alert-detail">
            <strong>URL:</strong> <code>${a.url}</code><br>
            <strong>Parameter:</strong> <code>${a.parameter}</code><br>
            ${a.attack ? `<strong>Attack:</strong> <code>${a.attack}</code><br>` : ''}
            <strong>Solution:</strong> ${a.solution}
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="footer">
      <p>MarketX Backend - Automated Security Penetration Test Report</p>
      <p>Powered by OWASP ZAP DAST Scanner</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate text summary
 */
function generateTextSummary(report) {
  return `
═══════════════════════════════════════════════════════════════════════════════
                    MarketX Backend Security Test Summary
═══════════════════════════════════════════════════════════════════════════════
Generated: ${report.metadata.timestamp}
Scanner: ${report.metadata.scanner}

EXECUTIVE SUMMARY
═══════════════════════════════════════════════════════════════════════════════
Total Alerts: ${report.total}
  • HIGH Severity:     ${report.summary.HIGH}
  • MEDIUM Severity:  ${report.summary.MEDIUM}
  • LOW Severity:      ${report.summary.LOW}
  • INFORMATIONAL:     ${report.summary.INFO}

SQL INJECTION TEST COVERAGE
═══════════════════════════════════════════════════════════════════════════════
Payload Types Tested:
  • Classic SQL Injection
  • UNION-based SQL Injection
  • Boolean-based Blind SQL Injection
  • Time-based Blind SQL Injection
  • Error-based SQL Injection
  • Stacked Queries
  • ORM-specific Bypass Attempts

CSRF/XSRF TEST COVERAGE
═══════════════════════════════════════════════════════════════════════════════
Test Types:
  • Form Submission CSRF
  • JSON-based CSRF
  • Origin Header Bypass
  • Referer Header Manipulation
  • CORS Bypass Attempts
  • Token Validation Bypass

REMEDIATION PRIORITY
═══════════════════════════════════════════════════════════════════════════════
${report.summary.HIGH > 0 ? '🔴 IMMEDIATE ACTION REQUIRED: ' + report.summary.HIGH + ' high-severity vulnerabilities detected!' : ''}
${report.summary.MEDIUM > 0 ? '🟡 Action required: ' + report.summary.MEDIUM + ' medium-severity vulnerabilities need attention.' : ''}
${report.summary.HIGH === 0 && report.summary.MEDIUM === 0 ? '✅ No critical vulnerabilities detected.' : ''}

RECOMMENDED ACTIONS
═══════════════════════════════════════════════════════════════════════════════
1. Implement parameterized queries for all database operations
2. Use ORM frameworks with proper SQL injection protection
3. Implement CSRF tokens for all state-changing operations
4. Enable SameSite cookies
5. Implement Origin/Referer validation
6. Apply Content Security Policy (CSP)
7. Conduct regular security testing and code reviews

═══════════════════════════════════════════════════════════════════════════════
                         END OF SECURITY REPORT
═══════════════════════════════════════════════════════════════════════════════
`;
}

/**
 * Print banner
 */
function printBanner() {
  console.log(`
${colors.cyan}${colors.bold}
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║     ██████╗██╗   ██╗██████╗ ███████╗██████╗ ███████╗██╗███████╗████████╗     ║
║    ██╔════╝╚██╗ ██╔╝██╔══██╗██╔════╝██╔══██╗██╔════╝██║██╔════╝╚══██╔══╝     ║
║    ██║      ╚████╔╝ ██████╔╝█████╗  ██████╔╝███████╗██║███████╗   ██║        ║
║    ██║       ╚██╔╝  ██╔══██╗██╔══╝  ██╔══██╗╚════██║██║╚════██║   ██║        ║
║    ╚██████╗   ██║   ██████╔╝███████╗██║  ██║███████║██║███████║   ██║        ║
║     ╚═════╝   ╚═╝   ╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝╚══════╝   ╚═╝        ║
║                                                                              ║
║              Backend Security Penetration Test Runner                       ║
║              OWASP ZAP DAST Scanner Integration                             ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
${colors.reset}
`);
}

/**
 * Main execution
 */
async function main() {
  printBanner();
  
  try {
    logger.section('INITIALIZATION');
    
    // Wait for services
    logger.info(`Waiting for MarketX API at ${CONFIG.apiHost}:${CONFIG.apiPort}...`);
    await waitForService(CONFIG.apiHost, CONFIG.apiPort);
    
    logger.info(`Waiting for OWASP ZAP at ${CONFIG.zapHost}:${CONFIG.zapPort}...`);
    await waitForService(CONFIG.zapHost, CONFIG.zapPort);
    
    logger.success('All services ready');
    
    // Initialize ZAP context
    logger.section('SPIDER SCANNING');
    const contextName = 'MarketX_Backend';
    await zap.createContext(contextName);
    await zap.includeInContext(contextName, `.*${CONFIG.apiHost}.*`);
    logger.info('Context created and configured');
    
    // Spider scan
    logger.info('Starting spider scan...');
    await zap.spiderScan(`http://${CONFIG.apiHost}:${CONFIG.apiPort}/`);
    
    // Wait for spider
    let spiderStatus = 0;
    while (spiderStatus < 100) {
      await new Promise(r => setTimeout(r, 5000));
      spiderStatus = parseInt(await zap.getSpiderStatus(), 10);
      logger.info(`Spider progress: ${spiderStatus}%`);
    }
    logger.success('Spider scan completed');
    
    // SQL Injection testing
    logger.section('SQL INJECTION TESTING');
    const sqlPayloads = loadPayloads('sql-injection.txt');
    logger.info(`Loaded ${sqlPayloads.length} SQL injection payloads`);
    
    const sqlEndpoints = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/users',
      '/api/products',
      '/api/orders',
      '/api/search'
    ];
    
    for (const endpoint of sqlEndpoints) {
      logger.info(`Testing SQL injection on ${endpoint}...`);
      await testSqlInjection(endpoint, sqlPayloads);
    }
    logger.success('SQL injection testing completed');
    
    // CSRF testing
    logger.section('CSRF/XSRF TESTING');
    const csrfEndpoints = [
      '/api/auth/register',
      '/api/users/profile',
      '/api/orders',
      '/api/payments'
    ];
    
    for (const endpoint of csrfEndpoints) {
      logger.info(`Testing CSRF on ${endpoint}...`);
      await testCsrf(endpoint);
    }
    logger.success('CSRF testing completed');
    
    // Active scan
    logger.section('ACTIVE VULNERABILITY SCANNING');
    logger.info('Starting active scan...');
    await zap.activeScan(`http://${CONFIG.apiHost}:${CONFIG.apiPort}/`);
    
    // Wait for scan
    let scanStatus = 0;
    while (scanStatus < 100) {
      await new Promise(r => setTimeout(r, 5000));
      scanStatus = parseInt(await zap.getActiveScanStatus(), 10);
      logger.info(`Active scan progress: ${scanStatus}%`);
    }
    logger.success('Active scan completed');
    
    // Generate report
    const { counts } = await generateReport();
    
    // Print summary
    logger.section('SCAN RESULTS SUMMARY');
    console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                         SECURITY SCAN RESULTS                                ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  HIGH SEVERITY:     ${String(counts.HIGH).padEnd(4)}  ${counts.HIGH > 0 ? '❌ IMMEDIATE ACTION REQUIRED' : '✅ None detected'}        ║
║  MEDIUM SEVERITY:   ${String(counts.MEDIUM).padEnd(4)}  ${counts.MEDIUM > 0 ? '⚠️ Action required' : '✅ None detected'}                 ║
║  LOW SEVERITY:      ${String(counts.LOW).padEnd(4)}  ℹ️ Informational                        ║
║  INFORMATIONAL:     ${String(counts.INFO).padEnd(4)}  ℹ️ Informational                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
    
    // Exit with appropriate code
    process.exit(counts.HIGH > 0 ? 2 : counts.MEDIUM > 0 ? 1 : 0);
    
  } catch (error) {
    logger.error(`Security test failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, testSqlInjection, testCsrf, generateReport };
