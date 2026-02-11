import 'dart:async';
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter_shieldfraud/generated/plugin_version_info.dart';
import 'shield_config.dart';

class Shield {
  static const MethodChannel _channel = MethodChannel('plugin_shieldfraud');
  static ShieldCallback? _shieldCallback;

  static initShield(ShieldConfig config) async {
    try {
      if (config.shieldCallback != null) {
        _channel.setMethodCallHandler(_methodHandler);
        _shieldCallback = config.shieldCallback;
      }

      // ✅ Send enum NAME directly (important)
      String environment = config.environment.name;
      String logLevel = config.logLevel.name;

      setCrossPlatformParameters();

      await _channel.invokeMethod("initShieldFraud", {
        "siteID": config.siteID,
        "key": config.key,
        "registerCallback": config.shieldCallback != null,
        "enableBackgroundListener": config.enableBackgroundListener,
        "enableMocking": config.enableMocking,
        "partnerId": config.partnerId,
        "environment": environment,
        "logLevel": logLevel,
        "defaultBlockedDialog": config.defaultBlockedDialog != null
            ? {
          "title": config.defaultBlockedDialog!.title,
          "body": config.defaultBlockedDialog!.body,
        }
            : null,
      });
    } catch (_) {}
  }

  static Future<void> setCrossPlatformParameters() async {
    await _channel.invokeMethod("setCrossPlatformParameters", {
      "name": PluginBuildInfo.pluginName,
      "version": PluginBuildInfo.pluginVersion
    });
  }

  static Future<String> get sessionId async {
    try {
      return await _channel.invokeMethod('getSessionID');
    } catch (_) {
      return "";
    }
  }

  static ShieldError? latestError;

  static Future<Map<String, dynamic>?> get latestDeviceResult async {
    try {
      final result = await _channel.invokeMethod('getDeviceResult');
      latestError = null;
      return json.decode(result);
    } on PlatformException catch (e) {
      latestError =
          ShieldError(int.tryParse(e.code) ?? 0, e.message ?? "Unknown error");
    } catch (_) {
      latestError = ShieldError(0, "Unknown error");
    }
    return null;
  }

  static Future<String?> sendAttributes(
      String screenName,
      Map<String, String> data,
      ) async {
    try {
      final result = await _channel.invokeMethod(
        "sendAttributes",
        {
          "screenName": screenName,
          "attributes": data,
        },
      );

      return result as String?;
    } catch (e) {
      return null;
    }
  }


  static Future<bool> sendDeviceSignature(String screenName) async {
    try {
      return await _channel.invokeMethod("sendDeviceSignature", {
        "screenName": screenName
      }).timeout(const Duration(seconds: 30), onTimeout: () => false);
    } catch (_) {
      return false;
    }
  }

  static Future<bool> get isShieldInitialized async {
    try {
      return await _channel.invokeMethod("isShieldInitialized");
    } catch (_) {
      return false;
    }
  }

  static Future<void> _methodHandler(MethodCall call) async {
    try {
      switch (call.method) {
        case "setDeviceResult":
          _shieldCallback?.onSuccess(json.decode(call.arguments));
          break;

        case "setDeviceResultError":
          ShieldError shieldError = ShieldError(
              call.arguments["code"] ?? 0,
              call.arguments["message"] ?? "Unknown error");
          _shieldCallback?.onError(shieldError);
          break;
      }
    } catch (_) {
      _shieldCallback?.onError(ShieldError(0, "Unknown error"));
    }
  }
}
