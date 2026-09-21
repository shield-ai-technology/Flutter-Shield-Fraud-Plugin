#!/usr/bin/env node

/**
 * Automated End-to-End Version Update and Verification Script
 * For Flutter Shield Fraud Plugin.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync, spawnSync } = require('child_process');

// Default paths relative to workspace root
const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT_DIR, 'shield-config.json');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const ANDROID_GRADLE_PATH = path.join(ROOT_DIR, 'android', 'build.gradle');
const IOS_PODSPEC_PATH = path.join(ROOT_DIR, 'ios', 'flutter_shieldfraud.podspec');
const EXAMPLE_DIR = path.join(ROOT_DIR, 'example');
const EXAMPLE_IOS_DIR = path.join(EXAMPLE_DIR, 'ios');
const PODFILE_LOCK_PATH = path.join(EXAMPLE_IOS_DIR, 'Podfile.lock');
const MAIN_DART_PATH = path.join(EXAMPLE_DIR, 'lib', 'main.dart');
const MAIN_DART_BACKUP_PATH = path.join(EXAMPLE_DIR, 'lib', 'main.dart.backup');
const OUTPUT_JSON_PATH = path.join(EXAMPLE_DIR, 'shield-output.json');

// Android & iOS package/bundle identifiers
const ANDROID_PACKAGE_NAME = 'com.example.plugin_shieldfraud_example';
const IOS_BUNDLE_ID = 'com.example.pluginShieldfraudExample';

/**
 * Augment process.env.PATH with common Flutter, Android SDK, and system tool locations
 */
/**
 * Augment process.env.PATH with common Flutter, Android SDK, and system tool locations
 */
function getAugmentedEnv(customFlutterPath) {
  const home = os.homedir();
  const extraPaths = [
    ...(customFlutterPath ? [path.dirname(customFlutterPath)] : []),
    path.join(home, 'development', 'flutter', 'bin'),
    path.join(home, 'Developer', 'flutter', 'bin'),
    path.join(home, 'flutter', 'bin'),
    path.join(home, '.flutter', 'bin'),
    path.join(home, 'Library', 'Flutter', 'bin'),
    path.join(home, 'fvm', 'default', 'bin'),
    path.join(home, '.fvm', 'default', 'bin'),
    path.join(home, '.pub-cache', 'bin'),
    path.join(home, 'sdk', 'flutter', 'bin'),
    '/Applications/flutter/bin',
    '/Applications/Development/flutter/bin',
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    path.join(home, 'Library', 'Android', 'sdk', 'platform-tools'),
    path.join(home, 'Library', 'Android', 'sdk', 'emulator'),
    path.join(home, 'Library', 'Android', 'sdk', 'tools'),
    path.join(home, 'Library', 'Android', 'sdk', 'tools', 'bin'),
    path.join(home, 'Library', 'Android', 'sdk', 'cmdline-tools', 'latest', 'bin'),
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
  ];

  const currentPath = process.env.PATH || '';
  const currentPathArr = currentPath.split(path.delimiter).filter(Boolean);

  const finalPaths = [...currentPathArr];
  for (const p of extraPaths) {
    if (p && !finalPaths.includes(p)) {
      finalPaths.push(p);
    }
  }

  return { ...process.env, PATH: finalPaths.join(path.delimiter) };
}

/**
 * Locate the Flutter executable across standard installation paths
 */
function findFlutterBin(configuredPath) {
  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath;
  }

  const explicitEnv = process.env.FLUTTER_PATH || process.env.FLUTTER_BIN;
  if (explicitEnv && fs.existsSync(explicitEnv)) {
    return explicitEnv;
  }

  const home = os.homedir();
  const searchLocations = [
    path.join(home, 'development', 'flutter', 'bin', 'flutter'),
    path.join(home, 'Developer', 'flutter', 'bin', 'flutter'),
    path.join(home, 'flutter', 'bin', 'flutter'),
    path.join(home, '.flutter', 'bin', 'flutter'),
    path.join(home, 'Library', 'Flutter', 'bin', 'flutter'),
    path.join(home, 'fvm', 'default', 'bin', 'flutter'),
    path.join(home, '.fvm', 'default', 'bin', 'flutter'),
    path.join(home, 'sdk', 'flutter', 'bin', 'flutter'),
    '/Applications/flutter/bin/flutter',
    '/Applications/Development/flutter/bin/flutter',
    '/opt/homebrew/bin/flutter',
    '/usr/local/bin/flutter',
  ];

  for (const loc of searchLocations) {
    if (fs.existsSync(loc)) {
      return loc;
    }
  }

  // Check via PATH
  const env = getAugmentedEnv();
  const paths = (env.PATH || '').split(path.delimiter);
  for (const p of paths) {
    const candidate = path.join(p, 'flutter');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Check via login shell
  try {
    const shell = process.env.SHELL || '/bin/zsh';
    const whichOut = execSync(`${shell} -l -c "which flutter"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    if (whichOut && fs.existsSync(whichOut)) {
      return whichOut;
    }
  } catch (_) {}

  return 'flutter';
}

/**
 * Parse .env file into key-value pairs
 */
function loadEnv(filePath = ENV_PATH) {
  const env = {};
  let targetPath = filePath;
  if (!fs.existsSync(targetPath)) {
    const exampleEnvPath = path.join(EXAMPLE_DIR, '.env');
    if (filePath === ENV_PATH && fs.existsSync(exampleEnvPath)) {
      targetPath = exampleEnvPath;
    } else {
      return env;
    }
  }
  const content = fs.readFileSync(targetPath, 'utf-8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equalsIdx = trimmed.indexOf('=');
    if (equalsIdx === -1) continue;
    const key = trimmed.substring(0, equalsIdx).trim();
    let val = trimmed.substring(equalsIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

/**
 * Parse CLI args into an object
 */
function parseCliArgs(args = process.argv.slice(2)) {
  const parsed = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const match = arg.slice(2).match(/^([^=]+)(?:=(.*))?$/);
      if (match) {
        const key = match[1];
        const val = match[2] !== undefined ? match[2] : true;
        parsed[key] = val;
      }
    }
  }
  return parsed;
}

/**
 * Load and merge config from shield-config.json, .env, process.env, and CLI args
 */
function parseConfig(options = {}) {
  const cliArgs = options.cliArgs || parseCliArgs();
  const configPath = cliArgs.config || options.configPath || CONFIG_PATH;
  const envPath = cliArgs.env || options.envPath || ENV_PATH;

  let fileConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      console.warn(`[ShieldUpdate] Warning: Failed to parse ${configPath}: ${e.message}`);
    }
  }

  const dotEnv = loadEnv(envPath);

  const androidVersion =
    cliArgs.androidVersion ||
    fileConfig.androidVersion ||
    process.env.SHIELD_ANDROID_VERSION ||
    null;

  const iosVersion =
    cliArgs.iosVersion ||
    fileConfig.iosVersion ||
    process.env.SHIELD_IOS_VERSION ||
    null;

  let platform =
    cliArgs.platform ||
    fileConfig.platform ||
    process.env.SHIELD_PLATFORM ||
    'both';

  platform = String(platform).toLowerCase();
  if (!['android', 'ios', 'both', 'all'].includes(platform)) {
    throw new Error(`Invalid platform "${platform}". Must be 'android', 'ios', 'both', or 'all'.`);
  }

  const siteId =
    cliArgs.siteId ||
    cliArgs.siteID ||
    fileConfig.siteId ||
    fileConfig.siteID ||
    dotEnv.SHIELD_SITE_ID ||
    dotEnv.SITE_ID ||
    dotEnv.siteId ||
    dotEnv.siteID ||
    process.env.SHIELD_SITE_ID ||
    process.env.SITE_ID ||
    '';

  const secretKey =
    cliArgs.secretKey ||
    fileConfig.secretKey ||
    dotEnv.SHIELD_SECRET_KEY ||
    dotEnv.SECRET_KEY ||
    dotEnv.secretKey ||
    process.env.SHIELD_SECRET_KEY ||
    process.env.SECRET_KEY ||
    '';

  const isDryRun = Boolean(cliArgs['dry-run'] || cliArgs.dryRun || options.isDryRun);
  const isSkipRun = Boolean(cliArgs['skip-run'] || cliArgs.skipRun || options.isSkipRun);

  const timeoutMs =
    (cliArgs.timeout ? Number(cliArgs.timeout) * 1000 : null) ||
    (fileConfig.timeoutSeconds ? Number(fileConfig.timeoutSeconds) * 1000 : null) ||
    (fileConfig.timeout ? Number(fileConfig.timeout) * 1000 : null) ||
    600000; // 10 minutes default

  const flutterPath =
    cliArgs.flutterPath ||
    fileConfig.flutterPath ||
    dotEnv.FLUTTER_PATH ||
    process.env.FLUTTER_PATH ||
    '';

  return {
    androidVersion,
    iosVersion,
    platform,
    siteId,
    secretKey,
    flutterPath,
    timeoutMs,
    isDryRun,
    isSkipRun,
    configPath,
    envPath,
  };
}

/**
 * Update Android dependency in build.gradle
 */
function updateAndroidVersion(gradlePath = ANDROID_GRADLE_PATH, newVersion) {
  if (!newVersion) return { updated: false, reason: 'No androidVersion specified' };
  if (!fs.existsSync(gradlePath)) {
    throw new Error(`Android build.gradle not found at ${gradlePath}`);
  }

  const content = fs.readFileSync(gradlePath, 'utf-8');
  // Matches implementation ("com.shield.android:shield-fraud:2.7.0") or implementation "com.shield.android:shield-alpha:..."
  const depRegex = /(implementation\s*\(?\s*["']com\.shield\.android:(shield-[a-zA-Z0-9_-]+):)([^"'\)]+)(["']\s*\)?)/;
  const match = content.match(depRegex);

  if (!match) {
    return { updated: false, reason: 'Shield Android dependency pattern not found' };
  }

  const oldVersion = match[3];
  if (oldVersion === newVersion) {
    return { updated: false, oldVersion, newVersion, reason: 'Version already matches' };
  }

  const updatedContent = content.replace(depRegex, `$1${newVersion}$4`);
  fs.writeFileSync(gradlePath, updatedContent, 'utf-8');
  return { updated: true, oldVersion, newVersion, content: updatedContent };
}

/**
 * Update iOS dependency in *.podspec
 */
function updateIosVersion(podspecPath = IOS_PODSPEC_PATH, newVersion) {
  if (!newVersion) return { updated: false, reason: 'No iosVersion specified' };
  if (!fs.existsSync(podspecPath)) {
    throw new Error(`Podspec file not found at ${podspecPath}`);
  }

  const content = fs.readFileSync(podspecPath, 'utf-8');
  // Matches s.dependency "ShieldFraud", "= 2.0.0" or s.dependency 'ShieldAlpha', '2.0.0'
  const podRegex = /(s\.dependency\s+["'](Shield[A-Za-z0-9_-]+)["']\s*,\s*["'])(?:=\s*)?([^"']+)(["'])/;
  const match = content.match(podRegex);

  if (!match) {
    return { updated: false, reason: 'Shield iOS pod dependency pattern not found' };
  }

  const oldVersion = match[3].trim();
  if (oldVersion === newVersion) {
    return { updated: false, oldVersion, newVersion, reason: 'Version already matches' };
  }

  const updatedContent = content.replace(podRegex, `$1= ${newVersion}$4`);
  fs.writeFileSync(podspecPath, updatedContent, 'utf-8');
  return { updated: true, oldVersion, newVersion, content: updatedContent };
}

/**
 * Remove Podfile.lock if it exists
 */
function cleanPodfileLock(lockPath = PODFILE_LOCK_PATH) {
  if (fs.existsSync(lockPath)) {
    fs.unlinkSync(lockPath);
    return { deleted: true, path: lockPath };
  }
  return { deleted: false, path: lockPath };
}

/**
 * Parse output from `xcrun simctl list devices --json`
 */
function parseSimctlDevices(jsonString) {
  let data;
  try {
    data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
  } catch (e) {
    return { booted: [], available: [] };
  }

  const booted = [];
  const available = [];

  if (data && data.devices) {
    for (const [runtime, devList] of Object.entries(data.devices)) {
      if (!Array.isArray(devList)) continue;
      // Filter for iOS devices
      const isIos = runtime.includes('iOS') || runtime.includes('simruntime.ios');
      for (const dev of devList) {
        if (dev.isAvailable === false || dev.availabilityError) continue;
        const info = {
          udid: dev.udid,
          name: dev.name,
          state: dev.state,
          runtime,
          isIos,
        };
        if (dev.state === 'Booted') {
          booted.push(info);
        } else {
          available.push(info);
        }
      }
    }
  }

  return { booted, available };
}

/**
 * Discover or auto-boot an iOS Simulator
 */
async function discoverIosDevice(exec = execSync) {
  const env = getAugmentedEnv();
  let simctlJson = '';
  try {
    simctlJson = exec('xcrun simctl list devices available --json', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'], env });
  } catch (e) {
    try {
      simctlJson = exec('xcrun simctl list devices --json', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'], env });
    } catch (err) {
      throw new Error(`Failed to list iOS simulators via xcrun simctl: ${err.message}`);
    }
  }

  const { booted, available } = parseSimctlDevices(simctlJson);

  // If already booted, select it (prefer iOS devices)
  const bootedIos = booted.find((d) => d.isIos) || booted[0];
  if (bootedIos) {
    console.log(`[ShieldUpdate] Found already booted iOS Simulator: ${bootedIos.name} (${bootedIos.udid})`);
    return { deviceId: bootedIos.udid, name: bootedIos.name, wasBooted: true };
  }

  // Find candidate simulator (prefer iPhone models)
  const iosCandidates = available.filter((d) => d.isIos);
  const iphoneCandidates = iosCandidates.filter((d) => d.name.toLowerCase().includes('iphone'));
  const candidate = iphoneCandidates[iphoneCandidates.length - 1] || iosCandidates[0] || available[0];

  if (!candidate) {
    throw new Error('No available iOS Simulator found on this machine.');
  }

  console.log(`[ShieldUpdate] Auto-booting iOS Simulator: ${candidate.name} (${candidate.udid})...`);
  try {
    exec(`xcrun simctl boot ${candidate.udid}`, { env });
  } catch (e) {
    console.warn(`[ShieldUpdate] simctl boot notice: ${e.message}`);
  }

  // Optionally trigger simulator app to open window
  try {
    exec(`open -a Simulator --args -CurrentDeviceUDID ${candidate.udid}`, { stdio: 'ignore', env });
  } catch (_) {}

  return { deviceId: candidate.udid, name: candidate.name, wasBooted: false };
}

/**
 * Parse output from `adb devices`
 */
function parseAdbDevices(adbOutput) {
  const lines = String(adbOutput).trim().split(/\r?\n/);
  const devices = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length >= 2 && parts[1] === 'device') {
      devices.push({ id: parts[0], status: parts[1] });
    }
  }
  return devices;
}

/**
 * Discover or auto-boot an Android Emulator
 */
async function discoverAndroidDevice(exec = execSync, spawnFn = spawn) {
  const env = getAugmentedEnv();
  let adbOut = '';
  try {
    adbOut = exec('adb devices', { encoding: 'utf-8', env });
  } catch (e) {
    console.warn(`[ShieldUpdate] adb command warning: ${e.message}`);
  }

  const runningDevices = parseAdbDevices(adbOut);
  if (runningDevices.length > 0) {
    const dev = runningDevices[0];
    console.log(`[ShieldUpdate] Found already running Android device/emulator: ${dev.id}`);
    try {
      exec(`adb -s ${dev.id} shell cmd -w wifi connect-network AndroidWifi open`, { env, stdio: 'ignore' });
    } catch (_) {}
    return { deviceId: dev.id, name: dev.id, wasBooted: true };
  }

  // Discover available AVDs
  let avdsList = '';
  try {
    avdsList = exec('emulator -list-avds', { encoding: 'utf-8', env });
  } catch (e) {
    try {
      const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(os.homedir(), 'Library/Android/sdk');
      avdsList = exec(`${path.join(androidHome, 'emulator/emulator')} -list-avds`, { encoding: 'utf-8', env });
    } catch (err) {
      throw new Error(`Failed to list Android AVDs: ${err.message}`);
    }
  }

  const avds = avdsList
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (avds.length === 0) {
    throw new Error('No Android Virtual Devices (AVDs) found. Please create an AVD in Android Studio.');
  }

  const targetAvd = avds[0];
  console.log(`[ShieldUpdate] Auto-booting Android Emulator @${targetAvd}...`);

  // Spawn emulator in background
  const emuProcess = spawnFn('emulator', ['@' + targetAvd, '-dns-server', '8.8.8.8,1.1.1.1', '-no-snapshot-load', '-no-audio'], {
    detached: true,
    stdio: 'ignore',
    env,
  });
  emuProcess.unref();

  console.log('[ShieldUpdate] Waiting for Android device to boot...');
  try {
    exec('adb wait-for-device', { timeout: 60000, env });
  } catch (e) {
    console.warn('[ShieldUpdate] adb wait-for-device timeout or warning.');
  }

  // Check boot completed
  let bootCompleted = false;
  const startTime = Date.now();
  while (!bootCompleted && Date.now() - startTime < 60000) {
    try {
      const res = exec('adb shell getprop sys.boot_completed', { encoding: 'utf-8', env }).trim();
      if (res === '1') {
        bootCompleted = true;
        break;
      }
    } catch (_) {}
    // Sleep 1.5s
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  const bootedDevices = parseAdbDevices(exec('adb devices', { encoding: 'utf-8', env }));
  const emulatorDev = bootedDevices[0] || { id: 'emulator-5554' };

  // Ensure Android emulator has working Wi-Fi & DNS connection
  try {
    exec(`adb -s ${emulatorDev.id} shell cmd -w wifi connect-network AndroidWifi open`, { env, stdio: 'ignore' });
  } catch (_) {}

  return { deviceId: emulatorDev.id, name: targetAvd, wasBooted: false };
}

/**
 * Backup example/lib/main.dart and inject credentials
 */
function injectCredentials(mainDartPath = MAIN_DART_PATH, siteId, secretKey) {
  if (!fs.existsSync(mainDartPath)) {
    throw new Error(`main.dart not found at ${mainDartPath}`);
  }

  const backupPath = mainDartPath + '.backup';
  const originalContent = fs.readFileSync(mainDartPath, 'utf-8');

  // Always write the backup before modifying
  fs.writeFileSync(backupPath, originalContent, 'utf-8');

  let updatedContent = originalContent;

  if (siteId) {
    updatedContent = updatedContent
      .replace(
        /(fromEnvironment\(\s*['"]SHIELD_SITE_ID['"],\s*defaultValue:\s*)["'][^"']*["']/g,
        `$1"${siteId}"`
      )
      .replace(
        /siteID:\s*["'][^"']*["']/g,
        `siteID: "${siteId}"`
      );
  }

  if (secretKey) {
    updatedContent = updatedContent
      .replace(
        /(fromEnvironment\(\s*['"]SHIELD_SECRET_KEY['"],\s*defaultValue:\s*)["'][^"']*["']/g,
        `$1"${secretKey}"`
      )
      .replace(
        /key:\s*["'][^"']*["']/g,
        `key: "${secretKey}"`
      );
  }

  // Ensure callback logs the result so stdout observer catches it instantly on init
  if (!updatedContent.includes('SHIELD_VERIFIED_SESSION_ID')) {
    updatedContent = updatedContent.replace(
      /\(Map<String,\s*dynamic>\s*result\)\s*\{/,
      '(Map<String, dynamic> result) {\n          final sid = result["session_id"] ?? result["sessionId"];\n          log("SHIELD_VERIFIED_SESSION_ID: $sid");'
    );
  }

  fs.writeFileSync(mainDartPath, updatedContent, 'utf-8');
  return { backupPath, injected: true };
}

/**
 * Restore example/lib/main.dart from backup and delete backup
 */
function restoreMainDart(mainDartPath = MAIN_DART_PATH, backupPath = MAIN_DART_BACKUP_PATH) {
  if (fs.existsSync(backupPath)) {
    const backupContent = fs.readFileSync(backupPath, 'utf-8');
    fs.writeFileSync(mainDartPath, backupContent, 'utf-8');
    try {
      fs.unlinkSync(backupPath);
    } catch (_) {}
    return { restored: true, fromBackup: true };
  }

  // Fallback placeholder cleanup if backup not found
  if (fs.existsSync(mainDartPath)) {
    let content = fs.readFileSync(mainDartPath, 'utf-8');
    // If it contains non-placeholder siteID/key, reset to placeholders
    content = content.replace(/siteID:\s*"[^"]*"/g, 'siteID: "SITE_ID"');
    content = content.replace(/key:\s*"[^"]*"/g, 'key: "SECRET_KEY"');
    fs.writeFileSync(mainDartPath, content, 'utf-8');
    return { restored: true, fromBackup: false };
  }

  return { restored: false };
}

// Global cleanup tracker to guarantee single invocation
let cleanupRegistered = false;
let isCleanedUp = false;

function setupCleanupHandlers(mainDartPath = MAIN_DART_PATH, backupPath = MAIN_DART_BACKUP_PATH) {
  if (cleanupRegistered) return;
  cleanupRegistered = true;

  const performCleanup = (source) => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    try {
      restoreMainDart(mainDartPath, backupPath);
      console.log(`\n[ShieldUpdate] Safe cleanup completed (${source}). main.dart restored.`);
    } catch (e) {
      console.error(`[ShieldUpdate] Cleanup error: ${e.message}`);
    }
  };

  process.on('exit', () => performCleanup('exit'));
  process.on('SIGINT', () => {
    performCleanup('SIGINT');
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    performCleanup('SIGTERM');
    process.exit(143);
  });
  process.on('uncaughtException', (err) => {
    console.error(`[ShieldUpdate] Uncaught exception:`, err);
    performCleanup('uncaughtException');
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    console.error(`[ShieldUpdate] Unhandled rejection:`, reason);
    performCleanup('unhandledRejection');
    process.exit(1);
  });
}

/**
 * Uninstall previous test app from simulator or emulator
 */
function uninstallPreviousApp(platform, deviceId, exec = execSync) {
  const env = getAugmentedEnv();
  try {
    if (platform === 'android') {
      console.log(`[ShieldUpdate] Uninstalling previous Android app (${ANDROID_PACKAGE_NAME})...`);
      exec(`adb -s ${deviceId} uninstall ${ANDROID_PACKAGE_NAME}`, { stdio: 'ignore', env });
    } else if (platform === 'ios') {
      console.log(`[ShieldUpdate] Uninstalling previous iOS app (${IOS_BUNDLE_ID})...`);
      exec(`xcrun simctl uninstall ${deviceId} ${IOS_BUNDLE_ID}`, { stdio: 'ignore', env });
    }
  } catch (_) {
    // Ignore if app is not installed
  }
}

/**
 * Run pod install --repo-update in example/ios
 */
function cleanAndInstallPods(exampleIosDir = EXAMPLE_IOS_DIR, exec = execSync, customFlutterPath) {
  const flutterBin = findFlutterBin(customFlutterPath);
  const env = getAugmentedEnv(flutterBin);
  cleanPodfileLock(path.join(exampleIosDir, 'Podfile.lock'));

  // Ensure iOS engine artifacts exist
  try {
    exec(`${flutterBin} precache --ios`, { stdio: 'inherit', env });
  } catch (_) {}

  console.log('[ShieldUpdate] Running pod install --repo-update in example/ios...');
  try {
    exec('pod install --repo-update', {
      cwd: exampleIosDir,
      stdio: 'inherit',
      env,
    });
  } catch (e) {
    if (fs.existsSync(path.join(exampleIosDir, 'Gemfile')) || fs.existsSync(path.join(ROOT_DIR, 'Gemfile'))) {
      console.log('[ShieldUpdate] Retrying with bundle exec pod install...');
      exec('bundle exec pod install --repo-update', {
        cwd: exampleIosDir,
        stdio: 'inherit',
        env,
      });
    } else {
      throw e;
    }
  }
}

/**
 * Run flutter pub get in root and example
 */
function runFlutterPubGet(rootDir = ROOT_DIR, exampleDir = EXAMPLE_DIR, exec = execSync, customFlutterPath) {
  const flutterBin = findFlutterBin(customFlutterPath);
  const env = getAugmentedEnv(flutterBin);

  console.log('[ShieldUpdate] Running flutter pub get in root...');
  exec(`${flutterBin} pub get`, { cwd: rootDir, stdio: 'inherit', env });

  const genVersionPath = path.join(rootDir, 'lib', 'generate_version.dart');
  if (fs.existsSync(genVersionPath)) {
    try {
      console.log('[ShieldUpdate] Generating version file...');
      exec(`dart run lib/generate_version.dart`, { cwd: rootDir, stdio: 'ignore', env });
    } catch (_) {}
  }

  console.log('[ShieldUpdate] Running flutter pub get in example/...');
  exec(`${flutterBin} pub get`, { cwd: exampleDir, stdio: 'inherit', env });
}

/**
 * Build Flutter CLI args
 */
function buildFlutterRunArgs(deviceId, target = 'lib/main.dart', platform = '', siteId = '', secretKey = '') {
  const args = ['run', '-d', deviceId, '--target', target];
  if (siteId) {
    args.push(`--dart-define=SHIELD_SITE_ID=${siteId}`);
  }
  if (secretKey) {
    args.push(`--dart-define=SHIELD_SECRET_KEY=${secretKey}`);
  }
  if (platform === 'android') {
    args.push('--android-skip-build-dependency-validation');
  }
  return args;
}

/**
 * Extract Session ID from device logs / Flutter stdout
 */
function extractSessionId(logChunk) {
  if (!logChunk || typeof logChunk !== 'string') return null;

  // 1. Explicit SHIELD_VERIFIED_SESSION_ID tag from main.dart
  const verifiedTagMatch = logChunk.match(/SHIELD_VERIFIED_SESSION_ID:\s*([a-fA-F0-9]{32})/i);
  if (verifiedTagMatch && verifiedTagMatch[1] && verifiedTagMatch[1].length === 32) {
    return verifiedTagMatch[1].toLowerCase();
  }

  // 2. Explicit key-value pairs matching session_id or sessionId specifically
  // Examples: session_id: "32hex", sessionId = 32hex, "session_id": "32hex"
  const patterns = [
    /(?:^|[^\w])session_?id\s*[:=]\s*["']?([a-fA-F0-9]{32})["']?/i,
    /(?:Signature success|Attributes SUCCESS).*?sessionId\s*=\s*([a-fA-F0-9]{32})/i,
    /["']session_id["']\s*:\s*["']?([a-fA-F0-9]{32})["']?/i,
    /\[Shield.*?\][^\n\r]*?session_?id\s*[:=]\s*["']?([a-fA-F0-9]{32})["']?/i,
  ];

  for (const pattern of patterns) {
    const match = logChunk.match(pattern);
    if (match && match[1] && match[1].length === 32) {
      return match[1].toLowerCase();
    }
  }

  return null;
}

/**
 * Print prominent success banner
 */
function printSuccessBanner(platform, deviceId, sessionId) {
  const line = '═'.repeat(68);
  console.log('\n' + line);
  console.log('║' + ' '.repeat(18) + '🎯 SHIELD VERIFICATION SUCCESS!' + ' '.repeat(18) + '║');
  console.log('╠' + line.slice(1, -1) + '╣');
  console.log(`║  Platform:      ${platform.toUpperCase().padEnd(48)}║`);
  console.log(`║  Target Device: ${String(deviceId).padEnd(48)}║`);
  console.log(`║  Session ID:    ${String(sessionId).padEnd(48)}║`);
  console.log(`║  Timestamp:     ${new Date().toISOString().padEnd(48)}║`);
  console.log(line + '\n');
}

/**
 * Clear existing verification results before starting a new run
 */
function resetOutputJson(outputJsonPath = OUTPUT_JSON_PATH) {
  if (fs.existsSync(outputJsonPath)) {
    try {
      fs.unlinkSync(outputJsonPath);
      console.log(`[ShieldUpdate] Cleared previous output file: ${outputJsonPath}`);
      return { cleared: true, path: outputJsonPath };
    } catch (e) {
      console.warn(`[ShieldUpdate] Warning: Failed to clear ${outputJsonPath}: ${e.message}`);
      return { cleared: false, error: e.message };
    }
  }
  return { cleared: false, path: outputJsonPath };
}

/**
 * Write output verification JSON and stage in git
 */
function saveVerificationResult(resultData, outputJsonPath = OUTPUT_JSON_PATH, exec = execSync) {
  const env = getAugmentedEnv();
  let combinedOutput = {};
  if (fs.existsSync(outputJsonPath)) {
    try {
      combinedOutput = JSON.parse(fs.readFileSync(outputJsonPath, 'utf-8'));
    } catch (_) {
      combinedOutput = {};
    }
  }

  const now = new Date().toISOString();
  combinedOutput.status = 'SUCCESS';
  combinedOutput.lastUpdated = now;

  const platform = resultData.platform;
  if (platform) {
    combinedOutput[platform] = {
      deviceId: resultData.deviceId || null,
      sessionId: resultData.sessionId,
      timestamp: resultData.timestamp || now,
      status: resultData.status || 'SUCCESS',
    };
  }

  fs.writeFileSync(outputJsonPath, JSON.stringify(combinedOutput, null, 2), 'utf-8');
  console.log(`[ShieldUpdate] Verification results saved to ${outputJsonPath}`);

  // Stage updated files in git (without commit or push). Note: shield-output.json is git-ignored.
  try {
    exec(`git add ${ANDROID_GRADLE_PATH} ${IOS_PODSPEC_PATH} ${CONFIG_PATH}`, {
      cwd: ROOT_DIR,
      stdio: 'ignore',
      env,
    });
    console.log('[ShieldUpdate] Updated files staged in Git.');
  } catch (e) {
    console.warn(`[ShieldUpdate] Git add warning: ${e.message}`);
  }

  return combinedOutput;
}

/**
 * Automatically open the output JSON file in default system viewer/editor
 */
function openOutputFile(outputJsonPath = OUTPUT_JSON_PATH, exec = execSync) {
  if (!fs.existsSync(outputJsonPath)) {
    return { opened: false, reason: 'File does not exist' };
  }
  try {
    const isDarwin = process.platform === 'darwin';
    const isWin = process.platform === 'win32';
    const cmd = isDarwin ? `open "${outputJsonPath}"` : isWin ? `start "" "${outputJsonPath}"` : `xdg-open "${outputJsonPath}"`;
    exec(cmd, { stdio: 'ignore' });
    console.log(`[ShieldUpdate] Opened output file: ${outputJsonPath}`);
    return { opened: true, path: outputJsonPath };
  } catch (e) {
    console.warn(`[ShieldUpdate] Could not automatically open ${outputJsonPath}: ${e.message}`);
    return { opened: false, error: e.message };
  }
}

/**
 * Run verification on a specific platform
 */
async function runPlatformVerification(targetPlatform, config, options = {}) {
  const { androidVersion, iosVersion, siteId, secretKey, flutterPath } = config;
  const timeoutMs = options.timeoutMs || config.timeoutMs || 600000; // 10 minute default verification timeout

  console.log(`\n======================================================`);
  console.log(`  Starting Verification for Platform: ${targetPlatform.toUpperCase()}`);
  console.log(`======================================================\n`);

  // 1. Discover target device
  let targetDevice;
  if (targetPlatform === 'android') {
    targetDevice = await discoverAndroidDevice();
  } else {
    targetDevice = await discoverIosDevice();
  }

  const deviceId = targetDevice.deviceId;

  // 2. Uninstall previous app installation
  uninstallPreviousApp(targetPlatform, deviceId);

  // 3. Pub get in root and example (must run before pod install so plugins are symlinked)
  runFlutterPubGet(ROOT_DIR, EXAMPLE_DIR, execSync, flutterPath);

  // 4. iOS clean pod install if iOS
  if (targetPlatform === 'ios') {
    cleanAndInstallPods(EXAMPLE_IOS_DIR, execSync, flutterPath);
  }

  // 5. Inject credentials
  injectCredentials(MAIN_DART_PATH, siteId, secretKey);

  // 6. Launch Flutter process and observe stdout
  return new Promise((resolve, reject) => {
    let verifiedSessionId = null;
    let timer = null;
    let heartbeatInterval = null;
    const startTime = Date.now();

    const flutterBin = findFlutterBin(flutterPath);
    const env = getAugmentedEnv(flutterBin);
    const runArgs = buildFlutterRunArgs(deviceId, 'lib/main.dart', targetPlatform, siteId, secretKey);
    console.log(`[ShieldUpdate] Executing: ${flutterBin} ${runArgs.join(' ')} in example/`);

    const flutterProc = spawn(flutterBin, runArgs, {
      cwd: EXAMPLE_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });

    let logcatProc = null;
    if (targetPlatform === 'android') {
      try {
        // Clear logcat buffer first
        try { execSync(`adb -s ${deviceId} logcat -c`, { env, stdio: 'ignore' }); } catch (_) {}
        logcatProc = spawn('adb', ['-s', deviceId, 'logcat', '-v', 'time', '-T', '1'], {
          env,
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        // Check logcat quietly without dumping full system logs to stdout
        logcatProc.stdout.on('data', (data) => {
          const text = data.toString();
          if (!verifiedSessionId) {
            const sessionId = extractSessionId(text);
            if (sessionId) {
              verifiedSessionId = sessionId;
              printSuccessBanner(targetPlatform, deviceId, sessionId);
              const resultData = {
                platform: targetPlatform,
                deviceId,
                sessionId,
                androidVersion: androidVersion || null,
                iosVersion: iosVersion || null,
                timestamp: new Date().toISOString(),
                status: 'SUCCESS',
              };
              saveVerificationResult(resultData);
              cleanupAndFinish(null, sessionId);
            }
          }
        });
      } catch (_) {}
    }

    const cleanupAndFinish = (err, sessionId) => {
      if (timer) clearTimeout(timer);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      restoreMainDart(MAIN_DART_PATH, MAIN_DART_BACKUP_PATH);

      if (logcatProc && !logcatProc.killed) {
        try {
          logcatProc.kill('SIGTERM');
        } catch (_) {}
      }

      if (flutterProc && !flutterProc.killed) {
        try {
          // If verification succeeded, detach ('d') so the app remains running live on the simulator/emulator
          if (sessionId) {
            console.log(`[ShieldUpdate] Detaching Flutter CLI session. App remains open and running on ${targetPlatform} simulator/emulator.`);
            flutterProc.stdin.write('d\n');
          } else {
            flutterProc.stdin.write('q\n');
          }
        } catch (_) {}
        setTimeout(() => {
          try {
            if (!flutterProc.killed) {
              flutterProc.kill('SIGTERM');
            }
          } catch (_) {}
        }, 1500);
      }

      if (err) {
        reject(err);
      } else {
        resolve(sessionId);
      }
    };

    heartbeatInterval = setInterval(() => {
      if (!verifiedSessionId) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`[ShieldUpdate] Compiling / running on ${targetPlatform} (${elapsed}s elapsed)...`);
      }
    }, 20000);

    timer = setTimeout(() => {
      cleanupAndFinish(new Error(`Verification timed out after ${timeoutMs / 1000}s waiting for Shield Session ID.`));
    }, timeoutMs);

    const onFlutterDataChunk = (data) => {
      const text = data.toString();
      process.stdout.write(text);

      if (!verifiedSessionId) {
        const sessionId = extractSessionId(text);
        if (sessionId) {
          verifiedSessionId = sessionId;
          printSuccessBanner(targetPlatform, deviceId, sessionId);

          const resultData = {
            platform: targetPlatform,
            deviceId,
            sessionId,
            androidVersion: androidVersion || null,
            iosVersion: iosVersion || null,
            timestamp: new Date().toISOString(),
            status: 'SUCCESS',
          };
          saveVerificationResult(resultData);

          // Gracefully complete
          cleanupAndFinish(null, sessionId);
        }
      }
    };

    flutterProc.stdout.on('data', onFlutterDataChunk);
    flutterProc.stderr.on('data', (data) => {
      const text = data.toString();
      process.stderr.write(text);
      if (!verifiedSessionId) {
        const sessionId = extractSessionId(text);
        if (sessionId) {
          verifiedSessionId = sessionId;
          printSuccessBanner(targetPlatform, deviceId, sessionId);
          const resultData = {
            platform: targetPlatform,
            deviceId,
            sessionId,
            androidVersion: androidVersion || null,
            iosVersion: iosVersion || null,
            timestamp: new Date().toISOString(),
            status: 'SUCCESS',
          };
          saveVerificationResult(resultData);
          cleanupAndFinish(null, sessionId);
        }
      }
    });

    flutterProc.on('error', (err) => {
      console.error(`[ShieldUpdate] Flutter process error: ${err.message}`);
      cleanupAndFinish(err);
    });

    flutterProc.on('close', (code) => {
      if (!verifiedSessionId) {
        cleanupAndFinish(new Error(`Flutter process exited prematurely with code ${code} without emitting a Session ID.`));
      }
    });
  });
}

/**
 * Main Orchestrator
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       Shield Fraud Flutter Plugin Automation Suite           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Register guaranteed cleanup handlers
  setupCleanupHandlers(MAIN_DART_PATH, MAIN_DART_BACKUP_PATH);

  // 1. Parse configuration
  const config = parseConfig();
  console.log('[ShieldUpdate] Active Configuration:');
  console.log(`  • Platform:        ${config.platform}`);
  console.log(`  • Android Version: ${config.androidVersion || '(unchanged)'}`);
  console.log(`  • iOS Version:     ${config.iosVersion || '(unchanged)'}`);
  console.log(`  • Site ID:         ${config.siteId ? '******' : '(not set)'}`);
  console.log(`  • Secret Key:      ${config.secretKey ? '******' : '(not set)'}`);
  console.log(`  • Dry Run:         ${config.isDryRun}`);
  console.log(`  • Skip Run:        ${config.isSkipRun}\n`);

  // Clear previous output file so output.json only contains current run's data
  if (!config.isDryRun && !config.isSkipRun) {
    resetOutputJson(OUTPUT_JSON_PATH);
  }

  // 2. Apply Android version update
  if (config.androidVersion) {
    console.log(`[ShieldUpdate] Updating Android dependency version to ${config.androidVersion}...`);
    if (!config.isDryRun) {
      const res = updateAndroidVersion(ANDROID_GRADLE_PATH, config.androidVersion);
      if (res.updated) {
        console.log(`[ShieldUpdate] Updated Android build.gradle (${res.oldVersion} -> ${res.newVersion})`);
      } else {
        console.log(`[ShieldUpdate] Android build.gradle: ${res.reason}`);
      }
    } else {
      console.log(`[ShieldUpdate] [Dry-Run] Skipped Android build.gradle update.`);
    }
  }

  // 3. Apply iOS version update & delete Podfile.lock
  if (config.iosVersion) {
    console.log(`[ShieldUpdate] Updating iOS pod dependency version to ${config.iosVersion}...`);
    if (!config.isDryRun) {
      const res = updateIosVersion(IOS_PODSPEC_PATH, config.iosVersion);
      if (res.updated) {
        console.log(`[ShieldUpdate] Updated iOS podspec (${res.oldVersion} -> ${res.newVersion})`);
      } else {
        console.log(`[ShieldUpdate] iOS podspec: ${res.reason}`);
      }
      const lockRes = cleanPodfileLock(PODFILE_LOCK_PATH);
      if (lockRes.deleted) {
        console.log(`[ShieldUpdate] Deleted ${lockRes.path} for fresh CocoaPods resolution.`);
      }
    } else {
      console.log(`[ShieldUpdate] [Dry-Run] Skipped iOS podspec update and Podfile.lock deletion.`);
    }
  }

  // If dry-run or skip-run is requested, finish here
  if (config.isDryRun || config.isSkipRun) {
    console.log('\n[ShieldUpdate] Completed version updates (dry-run or skip-run active).');
    return;
  }

  // Determine platforms to verify
  const platformsToRun = [];
  if (config.platform === 'both' || config.platform === 'all') {
    platformsToRun.push('android', 'ios');
  } else {
    platformsToRun.push(config.platform);
  }

  // Run verification sequentially for selected platforms
  for (const plat of platformsToRun) {
    try {
      await runPlatformVerification(plat, config);
    } catch (e) {
      console.error(`\n[ShieldUpdate] Verification failed on ${plat}: ${e.message}`);
      process.exit(1);
    }
  }

  console.log('\n[ShieldUpdate] All platform verifications successfully completed!');
  openOutputFile(OUTPUT_JSON_PATH);
}

// Module exports for testing
module.exports = {
  getAugmentedEnv,
  findFlutterBin,
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
  setupCleanupHandlers,
  uninstallPreviousApp,
  cleanAndInstallPods,
  runFlutterPubGet,
  buildFlutterRunArgs,
  extractSessionId,
  printSuccessBanner,
  resetOutputJson,
  saveVerificationResult,
  openOutputFile,
  runPlatformVerification,
  main,
  PATHS: {
    ROOT_DIR,
    CONFIG_PATH,
    ENV_PATH,
    ANDROID_GRADLE_PATH,
    IOS_PODSPEC_PATH,
    EXAMPLE_DIR,
    EXAMPLE_IOS_DIR,
    PODFILE_LOCK_PATH,
    MAIN_DART_PATH,
    MAIN_DART_BACKUP_PATH,
    OUTPUT_JSON_PATH,
  },
};

// Execute if run directly from CLI
if (require.main === module) {
  main().catch((err) => {
    console.error(`\n[ShieldUpdate] Fatal error: ${err.message}`);
    process.exit(1);
  });
}
