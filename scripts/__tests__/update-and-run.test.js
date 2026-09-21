/**
 * Unit tests for scripts/update-and-run.js
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  loadEnv,
  parseCliArgs,
  parseConfig,
  updateAndroidVersion,
  updateIosVersion,
  cleanPodfileLock,
  parseSimctlDevices,
  discoverIosDevice,
  parseAdbDevices,
  discoverAndroidDevice,
  injectCredentials,
  restoreMainDart,
  buildFlutterRunArgs,
  extractSessionId,
  resetOutputJson,
  saveVerificationResult,
  openOutputFile,
} = require('../update-and-run');

describe('Update & Run Automation Suite', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shield-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  });

  // -------------------------------------------------------------
  // 1. Configuration & .env Parsing Tests
  // -------------------------------------------------------------
  describe('Configuration & .env Parsing', () => {
    it('should parse .env files with single and double quotes, comments, and empty lines', () => {
      const envPath = path.join(tmpDir, '.env');
      const envContent = `
# Shield Test Credentials
SHIELD_SITE_ID="test_site_123"
SHIELD_SECRET_KEY='test_secret_abc'
OTHER_KEY=plain_value

# Empty line above
`;
      fs.writeFileSync(envPath, envContent);

      const parsed = loadEnv(envPath);
      assert.strictEqual(parsed.SHIELD_SITE_ID, 'test_site_123');
      assert.strictEqual(parsed.SHIELD_SECRET_KEY, 'test_secret_abc');
      assert.strictEqual(parsed.OTHER_KEY, 'plain_value');
    });

    it('should return empty object if .env file does not exist', () => {
      const parsed = loadEnv(path.join(tmpDir, 'nonexistent.env'));
      assert.deepStrictEqual(parsed, {});
    });

    it('should parse CLI arguments correctly', () => {
      const cliArgs = parseCliArgs([
        '--androidVersion=2.9.0',
        '--iosVersion=2.1.0',
        '--platform=android',
        '--dry-run',
      ]);

      assert.strictEqual(cliArgs.androidVersion, '2.9.0');
      assert.strictEqual(cliArgs.iosVersion, '2.1.0');
      assert.strictEqual(cliArgs.platform, 'android');
      assert.strictEqual(cliArgs['dry-run'], true);
    });

    it('should load shield-config.json and merge with CLI arguments and .env', () => {
      const configPath = path.join(tmpDir, 'shield-config.json');
      const envPath = path.join(tmpDir, '.env');

      fs.writeFileSync(
        configPath,
        JSON.stringify({
          androidVersion: '2.8.0',
          iosVersion: '2.0.1',
          platform: 'both',
        })
      );

      fs.writeFileSync(
        envPath,
        'SHIELD_SITE_ID=env_site\nSHIELD_SECRET_KEY=env_secret'
      );

      const config = parseConfig({
        configPath,
        envPath,
        cliArgs: { androidVersion: '2.9.0' }, // Overrides file config
      });

      assert.strictEqual(config.androidVersion, '2.9.0');
      assert.strictEqual(config.iosVersion, '2.0.1');
      assert.strictEqual(config.platform, 'both');
      assert.strictEqual(config.siteId, 'env_site');
      assert.strictEqual(config.secretKey, 'env_secret');
    });

    it('should throw an error for invalid platform names', () => {
      const configPath = path.join(tmpDir, 'shield-config.json');
      fs.writeFileSync(configPath, JSON.stringify({ platform: 'windows' }));

      assert.throws(
        () => parseConfig({ configPath, envPath: path.join(tmpDir, '.env'), cliArgs: {} }),
        /Invalid platform "windows"/
      );
    });
  });

  // -------------------------------------------------------------
  // 2. Native Version Updates Tests
  // -------------------------------------------------------------
  describe('Native Dependency Version Updates', () => {
    it('should update Android build.gradle dependency version', () => {
      const gradlePath = path.join(tmpDir, 'build.gradle');
      const sampleGradle = `
dependencies {
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1"
    implementation ("com.shield.android:shield-fraud:2.7.0")
}
`;
      fs.writeFileSync(gradlePath, sampleGradle);

      const result = updateAndroidVersion(gradlePath, '2.8.0');
      assert.strictEqual(result.updated, true);
      assert.strictEqual(result.oldVersion, '2.7.0');
      assert.strictEqual(result.newVersion, '2.8.0');

      const updatedFile = fs.readFileSync(gradlePath, 'utf-8');
      assert.ok(updatedFile.includes('implementation ("com.shield.android:shield-fraud:2.8.0")'));
    });

    it('should update Android shield-alpha dependency version without parentheses', () => {
      const gradlePath = path.join(tmpDir, 'build.gradle');
      const sampleGradle = `
dependencies {
    implementation "com.shield.android:shield-alpha:1.5.0"
}
`;
      fs.writeFileSync(gradlePath, sampleGradle);

      const result = updateAndroidVersion(gradlePath, '1.6.0');
      assert.strictEqual(result.updated, true);
      assert.strictEqual(result.oldVersion, '1.5.0');
      assert.strictEqual(result.newVersion, '1.6.0');

      const updatedFile = fs.readFileSync(gradlePath, 'utf-8');
      assert.ok(updatedFile.includes('implementation "com.shield.android:shield-alpha:1.6.0"'));
    });

    it('should report not updated if Android version is already matching', () => {
      const gradlePath = path.join(tmpDir, 'build.gradle');
      fs.writeFileSync(gradlePath, 'implementation ("com.shield.android:shield-fraud:2.8.0")');

      const result = updateAndroidVersion(gradlePath, '2.8.0');
      assert.strictEqual(result.updated, false);
      assert.strictEqual(result.reason, 'Version already matches');
    });

    it('should update iOS podspec dependency version', () => {
      const podspecPath = path.join(tmpDir, 'flutter_shieldfraud.podspec');
      const samplePodspec = `
Pod::Spec.new do |s|
  s.name             = 'flutter_shieldfraud'
  s.dependency 'Flutter'
  s.dependency "ShieldFraud", "= 2.0.0"
  s.platform = :ios, '12.0'
end
`;
      fs.writeFileSync(podspecPath, samplePodspec);

      const result = updateIosVersion(podspecPath, '2.0.1');
      assert.strictEqual(result.updated, true);
      assert.strictEqual(result.oldVersion, '2.0.0');
      assert.strictEqual(result.newVersion, '2.0.1');

      const updatedFile = fs.readFileSync(podspecPath, 'utf-8');
      assert.ok(updatedFile.includes('s.dependency "ShieldFraud", "= 2.0.1"'));
    });

    it('should clean Podfile.lock when present', () => {
      const lockPath = path.join(tmpDir, 'Podfile.lock');
      fs.writeFileSync(lockPath, 'PODS:\n  - ShieldFraud (2.0.0)');

      const result = cleanPodfileLock(lockPath);
      assert.strictEqual(result.deleted, true);
      assert.strictEqual(fs.existsSync(lockPath), false);

      // Running again when missing
      const result2 = cleanPodfileLock(lockPath);
      assert.strictEqual(result2.deleted, false);
    });
  });

  // -------------------------------------------------------------
  // 3. Device / Simulator Discovery & Parser Tests
  // -------------------------------------------------------------
  describe('Device / Simulator Discovery', () => {
    it('should parse simctl json output and separate booted from available devices', () => {
      const sampleSimctlJson = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-5': [
            {
              udid: '1111-2222-3333-4444',
              name: 'iPhone 15',
              state: 'Shutdown',
              isAvailable: true,
            },
            {
              udid: '5555-6666-7777-8888',
              name: 'iPhone 15 Pro',
              state: 'Booted',
              isAvailable: true,
            },
          ],
          'com.apple.CoreSimulator.SimRuntime.watchOS-10-0': [
            {
              udid: '9999-0000-1111-2222',
              name: 'Apple Watch Series 9',
              state: 'Shutdown',
              isAvailable: true,
            },
          ],
        },
      };

      const { booted, available } = parseSimctlDevices(sampleSimctlJson);
      assert.strictEqual(booted.length, 1);
      assert.strictEqual(booted[0].name, 'iPhone 15 Pro');
      assert.strictEqual(booted[0].udid, '5555-6666-7777-8888');

      assert.strictEqual(available.length, 2);
      const iosAvailable = available.filter((d) => d.isIos);
      assert.strictEqual(iosAvailable.length, 1);
      assert.strictEqual(iosAvailable[0].name, 'iPhone 15');
    });

    it('should discover already booted iOS simulator', async () => {
      const mockExec = (cmd) => {
        if (cmd.includes('simctl list devices')) {
          return JSON.stringify({
            devices: {
              'com.apple.CoreSimulator.SimRuntime.iOS-18-0': [
                {
                  udid: 'UDID-BOOTED-123',
                  name: 'iPhone 16 Pro',
                  state: 'Booted',
                  isAvailable: true,
                },
              ],
            },
          });
        }
        return '';
      };

      const result = await discoverIosDevice(mockExec);
      assert.strictEqual(result.deviceId, 'UDID-BOOTED-123');
      assert.strictEqual(result.name, 'iPhone 16 Pro');
      assert.strictEqual(result.wasBooted, true);
    });

    it('should auto-boot available iOS simulator when none are booted', async () => {
      const executedCommands = [];
      const mockExec = (cmd) => {
        executedCommands.push(cmd);
        if (cmd.includes('simctl list devices')) {
          return JSON.stringify({
            devices: {
              'com.apple.CoreSimulator.SimRuntime.iOS-18-0': [
                {
                  udid: 'UDID-SHUTDOWN-456',
                  name: 'iPhone 16',
                  state: 'Shutdown',
                  isAvailable: true,
                },
              ],
            },
          });
        }
        return '';
      };

      const result = await discoverIosDevice(mockExec);
      assert.strictEqual(result.deviceId, 'UDID-SHUTDOWN-456');
      assert.strictEqual(result.name, 'iPhone 16');
      assert.strictEqual(result.wasBooted, false);
      assert.ok(executedCommands.some((c) => c.includes('xcrun simctl boot UDID-SHUTDOWN-456')));
    });

    it('should parse adb devices output correctly', () => {
      const adbOutput = `
List of devices attached
emulator-5554	device
offline-device-1	offline
192.168.1.50:5555	device
`;
      const devices = parseAdbDevices(adbOutput);
      assert.strictEqual(devices.length, 2);
      assert.strictEqual(devices[0].id, 'emulator-5554');
      assert.strictEqual(devices[1].id, '192.168.1.50:5555');
    });

    it('should discover already running Android emulator', async () => {
      const mockExec = (cmd) => {
        if (cmd.includes('adb devices')) {
          return 'List of devices attached\nemulator-5554\tdevice\n';
        }
        return '';
      };

      const result = await discoverAndroidDevice(mockExec);
      assert.strictEqual(result.deviceId, 'emulator-5554');
      assert.strictEqual(result.wasBooted, true);
    });
  });

  // -------------------------------------------------------------
  // 4. Safe Credential Injection & Restoration Tests
  // -------------------------------------------------------------
  describe('Safe Credential Injection & Guaranteed Cleanup', () => {
    it('should backup main.dart, inject credentials, and restore cleanly', () => {
      const mainDartPath = path.join(tmpDir, 'main.dart');
      const initialContent = `
void main() {
  final config = ShieldConfig(
    siteID: "SITE_ID",
    key: "SECRET_KEY",
    environment: ShieldEnvironment.prod,
  );
}
`;
      fs.writeFileSync(mainDartPath, initialContent);

      // 1. Inject credentials
      const injectRes = injectCredentials(mainDartPath, 'LIVE_SITE_XYZ', 'LIVE_SECRET_987');
      assert.strictEqual(injectRes.injected, true);
      assert.strictEqual(fs.existsSync(injectRes.backupPath), true);

      // Verify injected values
      const injectedContent = fs.readFileSync(mainDartPath, 'utf-8');
      assert.ok(injectedContent.includes('siteID: "LIVE_SITE_XYZ"'));
      assert.ok(injectedContent.includes('key: "LIVE_SECRET_987"'));
      assert.ok(!injectedContent.includes('"SITE_ID"'));

      // 2. Restore
      const restoreRes = restoreMainDart(mainDartPath, injectRes.backupPath);
      assert.strictEqual(restoreRes.restored, true);
      assert.strictEqual(restoreRes.fromBackup, true);
      assert.strictEqual(fs.existsSync(injectRes.backupPath), false);

      // Verify restored content matches original
      const restoredContent = fs.readFileSync(mainDartPath, 'utf-8');
      assert.strictEqual(restoredContent, initialContent);
    });

    it('should fallback to replacing credentials if backup file does not exist', () => {
      const mainDartPath = path.join(tmpDir, 'main.dart');
      fs.writeFileSync(
        mainDartPath,
        'final config = ShieldConfig(siteID: "LEAKED_SITE", key: "LEAKED_KEY");'
      );

      const restoreRes = restoreMainDart(mainDartPath, path.join(tmpDir, 'missing.backup'));
      assert.strictEqual(restoreRes.restored, true);
      assert.strictEqual(restoreRes.fromBackup, false);

      const cleanedContent = fs.readFileSync(mainDartPath, 'utf-8');
      assert.ok(cleanedContent.includes('siteID: "SITE_ID"'));
      assert.ok(cleanedContent.includes('key: "SECRET_KEY"'));
    });
  });

  // -------------------------------------------------------------
  // 5. Device Intelligence Log Observer & Session ID Extraction
  // -------------------------------------------------------------
  describe('Device Intelligence Log Observer', () => {
    it('should extract 32-character hex session IDs from various log outputs', () => {
      const validSessionId = '4b5c89d7a2e1f03456789abcdef01234';

      // Standard log formats
      const logs = [
        `[ShieldFlutterExample] Signature success = true ::: sessionId = ${validSessionId}`,
        `[ShieldFlutterExample] Attributes SUCCESS - sessionId = ${validSessionId}`,
        `{"session_id": "${validSessionId}", "status": "success"}`,
        `[Shield] onSuccess: sessionId: ${validSessionId}`,
        `[ShieldFlutterExample] SHIELD_VERIFIED_SESSION_ID: ${validSessionId}`,
        `I/flutter: [ShieldFlutterExample] Device Result SUCCESS: {app_store: com.android.shell, device_intelligence: {global_shield_id: 43a6bc77a07ee5755f91e80cd84caf05, shield_id: 4c0fb91057c99f9cf6580de4dede9d9a}, session_id: ${validSessionId}}`,
      ];

      for (const log of logs) {
        const extracted = extractSessionId(log);
        assert.strictEqual(extracted, validSessionId, `Failed to extract from: ${log}`);
      }
    });

    it('should accurately extract session_id when global_shield_id and shield_id are present', () => {
      const payload = `I/flutter ( 4406): [ShieldFlutterExample] Device Result SUCCESS: {app_store: com.android.shell, device_intelligence: {app_tampering: false, auto_clicker_enabled: false, call_state_active: false, debugging: true, device_score: 10, global_shield_id: 43a6bc77a07ee5755f91e80cd84caf05, hooking: false, is_device_masked: false, is_emulated: true, is_jailbroken: false, is_proxy: false, request_payload_tampered: false, root_mgr_installed: false, running_clone_apps: false, running_gps_spoofers: false, running_screen_sharing: false, running_vpn_spoofers: false, secondary_user: false, shield_id: 4c0fb91057c99f9cf6580de4dede9d9a, sus_sdk_conn: false, suspicious_factory_reset: false, virtual_os: false}, device_used_by_more_than_2_users: false, is_payload_tampered: false, platform: Android, pmx_id: , session_id: d81d2911c5274d4c8d1e635d181ca19e, timestamp: 1789980453, user_id: , version: 1.1.0}`;
      const sid = extractSessionId(payload);
      assert.strictEqual(sid, 'd81d2911c5274d4c8d1e635d181ca19e');
    });

    it('should return null for invalid or incomplete session IDs', () => {
      const invalidLogs = [
        'Signature failed with error',
        'sessionId = 12345', // too short
        'sessionId = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"', // non-hex
        '',
        null,
      ];

      for (const log of invalidLogs) {
        assert.strictEqual(extractSessionId(log), null);
      }
    });
  });

  // -------------------------------------------------------------
  // 6. Argument Builder & Verification Result Saving
  // -------------------------------------------------------------
  describe('Argument Builder & Output Saving', () => {
    it('should build correct flutter run arguments with dart defines', () => {
      const args = buildFlutterRunArgs('emulator-5554', 'lib/main.dart', 'android', 'site_123', 'secret_456');
      assert.deepStrictEqual(args, [
        'run',
        '-d',
        'emulator-5554',
        '--target',
        'lib/main.dart',
        '--dart-define=SHIELD_SITE_ID=site_123',
        '--dart-define=SHIELD_SECRET_KEY=secret_456',
        '--android-skip-build-dependency-validation',
      ]);
    });

    it('should save and merge verification results for both android and ios', () => {
      const outputPath = path.join(tmpDir, 'shield-output.json');
      const executedCommands = [];
      const mockExec = (cmd) => executedCommands.push(cmd);

      const androidResult = {
        platform: 'android',
        deviceId: 'emulator-5554',
        sessionId: '4b5c89d7a2e1f03456789abcdef01234',
        androidVersion: '2.8.0',
        iosVersion: '2.1.0',
        timestamp: '2026-09-21T12:00:00.000Z',
        status: 'SUCCESS',
      };

      const iosResult = {
        platform: 'ios',
        deviceId: 'iPhone 16 Pro (UDID-123)',
        sessionId: '5c6d7e8f90123456789abcdef0123456',
        androidVersion: '2.8.0',
        iosVersion: '2.1.0',
        timestamp: '2026-09-21T12:05:00.000Z',
        status: 'SUCCESS',
      };

      saveVerificationResult(androidResult, outputPath, mockExec);
      saveVerificationResult(iosResult, outputPath, mockExec);

      assert.strictEqual(fs.existsSync(outputPath), true);
      const savedJson = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      assert.strictEqual(savedJson.status, 'SUCCESS');
      assert.strictEqual(savedJson.android.sessionId, '4b5c89d7a2e1f03456789abcdef01234');
      assert.strictEqual(savedJson.ios.sessionId, '5c6d7e8f90123456789abcdef0123456');
      assert.ok(executedCommands.some((c) => c.includes('git add')));
      // shield-output.json should NOT be staged into git because it is gitignored
      assert.ok(executedCommands.every((c) => !c.includes('shield-output.json')));
    });

    it('should reset and delete previous shield-output.json file at the start of a run', () => {
      const outputPath = path.join(tmpDir, 'shield-output.json');
      fs.writeFileSync(outputPath, JSON.stringify({ old: 'data' }), 'utf-8');
      assert.strictEqual(fs.existsSync(outputPath), true);

      const res = resetOutputJson(outputPath);
      assert.strictEqual(res.cleared, true);
      assert.strictEqual(fs.existsSync(outputPath), false);
    });

    it('should automatically open the output file using the system launcher', () => {
      const outputPath = path.join(tmpDir, 'shield-output.json');
      fs.writeFileSync(outputPath, JSON.stringify({ status: 'SUCCESS' }), 'utf-8');

      const executedCommands = [];
      const mockExec = (cmd) => executedCommands.push(cmd);

      const res = openOutputFile(outputPath, mockExec);
      assert.strictEqual(res.opened, true);
      assert.strictEqual(executedCommands.length, 1);
      assert.ok(
        executedCommands[0].includes('open') ||
        executedCommands[0].includes('start') ||
        executedCommands[0].includes('xdg-open')
      );
    });
  });
});
