import 'dart:async';

import 'package:flutter_shield_common/shield_config.dart';
import 'package:flutter_shield_common/shield_shared.dart';

export 'package:flutter_shield_common/shield_config.dart';

class Shield {
  static initShield(ShieldConfig config) async {
    ShieldCommon.initShield('plugin_shieldfraud', config);
    return;
  }

  static Future<String> get sessionId async {
    return ShieldCommon.sessionId;
  }

  static ShieldError? latestError;

  static Future<Map<String, dynamic>?> get latestDeviceResult async {
    await ShieldCommon.latestDeviceResult;
    latestError = ShieldCommon.latestError;
    return ShieldCommon.latestDeviceResult;
  }

  static Future<bool> sendAttributes(
      String screenName, Map<String, String> data) async {
    return ShieldCommon.sendAttributes(screenName, data);
  }

  static Future<bool> sendDeviceSignature(String screenName) async {
    return ShieldCommon.sendDeviceSignature(screenName);
  }

  static Future<bool> get isShieldInitialized async {
    return ShieldCommon.isShieldInitialized;
  }
}
