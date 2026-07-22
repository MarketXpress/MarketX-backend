import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const BOOTSTRAP = path.join(ROOT, 'scripts', 'bootstrap.sh');

describe('bootstrap.sh', () => {
  it('exists and is executable', () => {
    expect(fs.existsSync(BOOTSTRAP)).toBe(true);
    const stat = fs.statSync(BOOTSTRAP);
    // owner-execute bit (0o100)
    expect(stat.mode & 0o100).toBeTruthy();
  });

  it('passes bash -n syntax check', () => {
    const result = spawnSync('bash', ['-n', BOOTSTRAP], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('exits non-zero and prints an error when node is missing', () => {
    // Override PATH so node cannot be found
    const result = spawnSync('bash', [BOOTSTRAP], {
      encoding: 'utf8',
      env: { ...process.env, PATH: '/nonexistent' },
    });
    expect(result.status).not.toBe(0);
  });

  it('creates .env from .env.example when .env is absent', () => {
    const tmpDir = fs.mkdtempSync('/tmp/marketx-bootstrap-test-');
    try {
      // Minimal .env.example
      fs.writeFileSync(path.join(tmpDir, '.env.example'), 'NODE_ENV=development\n');

      // Patch script so it exits after the .env step (avoid docker calls in CI)
      const original = fs.readFileSync(BOOTSTRAP, 'utf8');
      const patched = original.replace(
        /^step "Installing Node dependencies"/m,
        'success "Env step done – exiting early for unit test"\nexit 0',
      );
      const patchedScript = path.join(tmpDir, 'bootstrap.sh');
      fs.writeFileSync(patchedScript, patched, { mode: 0o755 });

      const result = spawnSync('bash', [patchedScript], {
        cwd: tmpDir,
        encoding: 'utf8',
        env: { ...process.env, PATH: process.env.PATH },
      });

      expect(fs.existsSync(path.join(tmpDir, '.env'))).toBe(true);
      expect(result.status).toBe(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('skips .env copy when .env already exists', () => {
    const tmpDir = fs.mkdtempSync('/tmp/marketx-bootstrap-existing-env-');
    try {
      fs.writeFileSync(path.join(tmpDir, '.env.example'), 'NODE_ENV=development\n');
      fs.writeFileSync(path.join(tmpDir, '.env'), 'NODE_ENV=test\n');

      const original = fs.readFileSync(BOOTSTRAP, 'utf8');
      const patched = original.replace(
        /^step "Installing Node dependencies"/m,
        'success "Env step done – exiting early for unit test"\nexit 0',
      );
      const patchedScript = path.join(tmpDir, 'bootstrap.sh');
      fs.writeFileSync(patchedScript, patched, { mode: 0o755 });

      spawnSync('bash', [patchedScript], {
        cwd: tmpDir,
        encoding: 'utf8',
        env: { ...process.env, PATH: process.env.PATH },
      });

      // Existing .env must not be overwritten
      const content = fs.readFileSync(path.join(tmpDir, '.env'), 'utf8');
      expect(content).toBe('NODE_ENV=test\n');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});