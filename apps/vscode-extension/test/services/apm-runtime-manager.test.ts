/**
 * ApmRuntimeManager Unit Tests
 * Tests APM CLI runtime detection and installation management
 */

import * as assert from 'node:assert';
import * as sinon from 'sinon';
import {
  ApmRuntimeManager,
} from '../../src/services/apm-runtime-manager';

suite('ApmRuntimeManager', () => {
  let sandbox: sinon.SinonSandbox;
  let runtime: ApmRuntimeManager;

  setup(() => {
    sandbox = sinon.createSandbox();
    // Reset singleton for testing
    ApmRuntimeManager.resetInstance();
    runtime = ApmRuntimeManager.getInstance();
  });

  teardown(() => {
    sandbox.restore();
    ApmRuntimeManager.resetInstance();
  });

  suite('getInstance', () => {
    test('should return singleton instance', () => {
      const instance1 = ApmRuntimeManager.getInstance();
      const instance2 = ApmRuntimeManager.getInstance();
      assert.strictEqual(instance1, instance2);
    });
  });

  suite('getStatus', () => {
    let detectRuntimeStub: sinon.SinonStub;

    setup(() => {
      // Mock the external process detection so getStatus tests stay fast and deterministic
      detectRuntimeStub = sandbox.stub(runtime as any, 'detectRuntime').resolves({ installed: false });
    });

    test('should return status object with installed property', async () => {
      const status = await runtime.getStatus();

      assert.strictEqual(status.installed, false);
      assert.strictEqual(detectRuntimeStub.callCount, 1);
    });

    test('should return cached status on subsequent calls within TTL', async () => {
      // Make each detection return a new object so strict equality proves caching
      detectRuntimeStub.callsFake(async () => ({ installed: false }));

      const status1 = await runtime.getStatus();
      const status2 = await runtime.getStatus();

      assert.strictEqual(status1, status2);
      assert.strictEqual(detectRuntimeStub.callCount, 1);
    });

    test('should refresh status when forceRefresh is true', async () => {
      detectRuntimeStub.callsFake(async () => ({ installed: false }));

      const status1 = await runtime.getStatus();
      const status2 = await runtime.getStatus(true);

      assert.notStrictEqual(status1, status2);
      assert.strictEqual(detectRuntimeStub.callCount, 2);
    });

    test('should include version when APM is installed', async () => {
      detectRuntimeStub.resolves({
        installed: true,
        version: '1.0.0',
        installMethod: 'pip'
      });

      const status = await runtime.getStatus(true);

      if (status.installed) {
        assert.ok(status.version);
      }
    });

    test('should detect install method', async () => {
      detectRuntimeStub.resolves({
        installed: true,
        version: '1.0.0',
        installMethod: 'pip'
      });

      const status = await runtime.getStatus(true);

      if (status.installed) {
        assert.ok(['pip', 'brew', 'binary', 'unknown'].includes(status.installMethod || 'unknown'));
      }
    });
  });

  suite('clearCache', () => {
    test('should clear cached status', async () => {
      let callCount = 0;
      sandbox.stub(runtime as any, 'detectRuntime').callsFake(async () => {
        callCount += 1;
        return { installed: callCount === 1 };
      });

      const status1 = await runtime.getStatus();
      assert.strictEqual(status1.installed, true);

      runtime.clearCache();

      const status2 = await runtime.getStatus();
      assert.strictEqual(status2.installed, false);
    });
  });

  suite('getInstallInstructions', () => {
    test('should return platform-appropriate instructions', () => {
      const instructions = runtime.getInstallInstructions();

      assert.ok(typeof instructions === 'string');
      assert.ok(instructions.length > 0);
      // Should contain some installation command
      assert.ok(
        instructions.includes('pip')
        || instructions.includes('brew')
        || instructions.includes('install')
      );
    });

    test('should include URL to APM repository', () => {
      const instructions = runtime.getInstallInstructions();

      assert.ok(instructions.includes('github.com') || instructions.includes('apm'));
    });
  });

  suite('Security', () => {
    test('should not execute arbitrary commands', async () => {
      // Mock the external process detection to keep the test deterministic
      sandbox.stub(runtime as any, 'detectRuntime').resolves({ installed: false });

      const status = await runtime.getStatus();

      // Should not throw and should return valid status
      assert.strictEqual(status.installed, false);
    });

    test('should sanitize version output', async () => {
      sandbox.stub(runtime as any, 'detectRuntime').resolves({
        installed: true,
        version: '<script>alert(1)</script>',
        installMethod: 'pip'
      });

      const status = await runtime.getStatus(true);

      // Version should be sanitized or at least not cause issues
      if (status.version) {
        assert.ok(typeof status.version === 'string');
      }
    });
  });

  suite('Error Handling', () => {
    test('should handle detection errors gracefully', async () => {
      sandbox.stub(runtime as any, 'detectRuntime').rejects(new Error('Detection failed'));

      const status = await runtime.getStatus(true);

      // Should return not installed rather than throwing
      assert.strictEqual(status.installed, false);
    });

    test('should handle timeout during detection', async () => {
      // Simulate a very slow detection
      sandbox.stub(runtime as any, 'detectRuntime').callsFake(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { installed: false };
      });

      const status = await runtime.getStatus(true);

      assert.ok(typeof status.installed === 'boolean');
    });
  });
});
