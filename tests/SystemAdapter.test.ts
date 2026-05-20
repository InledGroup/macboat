import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemAdapter } from '../src/backend/infrastructure/system/SystemAdapter';
import { exec } from 'child_process';
import os from 'os';

// Mocking util.promisify to just return the function passed to it
// because SystemAdapter uses import { promisify } from 'util'
vi.mock('util', () => ({
  promisify: (fn: any) => fn,
}));

// Mocking child_process.exec as an async function (because of our promisify mock)
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('os', () => ({
  default: {
    platform: vi.fn(),
  },
}));

describe('SystemAdapter', () => {
  let adapter: SystemAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default platform to linux
    vi.mocked(os.platform).mockReturnValue('linux');
    adapter = new SystemAdapter();
  });

  it('should detect docker not installed', async () => {
    const mockExec = vi.mocked(exec);
    mockExec.mockRejectedValue(new Error('command not found'));

    const status = await adapter.getStatus();
    expect(status.dockerInstalled).toBe(false);
  });

  it('should detect docker installed but not running', async () => {
    const mockExec = vi.mocked(exec);
    mockExec.mockImplementation(async (cmd) => {
      if (cmd === 'docker --version') return { stdout: 'version 20.10', stderr: '' };
      if (cmd === 'docker info') throw new Error('daemon not running');
      return { stdout: '', stderr: '' };
    });

    const status = await adapter.getStatus();
    expect(status.dockerInstalled).toBe(true);
    expect(status.dockerRunning).toBe(false);
  });

  it('should detect user NOT in docker group on Linux', async () => {
    const mockExec = vi.mocked(exec);
    mockExec.mockImplementation(async (cmd) => {
      if (cmd === 'groups') return { stdout: 'user sudo adm', stderr: '' };
      return { stdout: '', stderr: '' };
    });

    const status = await adapter.getStatus();
    expect(status.userInDockerGroup).toBe(false);
  });

  it('should detect user in docker group on Linux', async () => {
    const mockExec = vi.mocked(exec);
    mockExec.mockImplementation(async (cmd) => {
      if (cmd === 'groups') return { stdout: 'user docker sudo', stderr: '' };
      return { stdout: '', stderr: '' };
    });

    const status = await adapter.getStatus();
    expect(status.userInDockerGroup).toBe(true);
  });

  it('should return true for docker group check on non-linux', async () => {
    vi.mocked(os.platform).mockReturnValue('win32');
    const status = await adapter.getStatus();
    expect(status.userInDockerGroup).toBe(true);
  });
});
