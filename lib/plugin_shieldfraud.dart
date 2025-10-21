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
      String environment = "prod";
      switch (config.environment) {
        case ShieldEnvironment.dev:
          environment = "dev";
          break;
        case ShieldEnvironment.prod:
          environment = "prod";
          break;
        case ShieldEnvironment.staging:
          environment = "staging";
          break;
      }

      setCrossPlatformParameters();

      await _channel.invokeMethod("initShieldFraud", {
        "siteID": config.siteID,
        "key": config.key,
        "registerCallback": config.shieldCallback != null,
        "enableBackgroundListener": config.enableBackgroundListener,
        "enableMocking": config.enableMocking,
        "partnerId": config.partnerId,
        "environment": environment,
        "defaultBlockedDialog": config.defaultBlockedDialog != null
            ? {
                "title": config.defaultBlockedDialog!.title,
                "body": config.defaultBlockedDialog!.body,
              }
            : null,
        "logLevel": config.logLevel.toString()
      });
    } catch (_) {
      //something went wrong during initialization. nothing we can do
    }
    return;
  }

  static Future<void> setCrossPlatformParameters() async {
    await _channel.invokeMethod("setCrossPlatformParameters", {
      "name": PluginBuildInfo.pluginName,
      "version": PluginBuildInfo.pluginVersion
    });
  }

  static Future<String> get sessionId async {
    String sessionID = "";
    try {
      sessionID = await _channel.invokeMethod('getSessionID');
    } catch (_) {}
    return sessionID;
  }

  static ShieldError? latestError;
  static Future<Map<String, dynamic>?> get latestDeviceResult async {
    var result = "";
    try {
      result = await _channel.invokeMethod('getDeviceResult');
      latestError = null;
      return json.decode(result);
    } on PlatformException catch (e) {
      latestError =
          ShieldError(int.parse(e.code), e.message ?? "Unknown error");
    } catch (_) {
      latestError = ShieldError(0, "Unknown error");
    }
    return null;
  }

  static Future<bool> sendAttributes(
      String screenName, Map<String, String> data) async {
    var status = false;
    try {
      status = await _channel.invokeMethod(
          "sendAttributes", {"screenName": screenName, "attributes": data});
    } catch (_) {}
    return status;
  }

  static Future<bool> sendDeviceSignature(String screenName) async {
    var status = false;
    try {
      status = await _channel.invokeMethod("sendDeviceSignature", {
        "screenName": screenName
      }).timeout(const Duration(seconds: 5), onTimeout: () {
        //If the result not comeback in 5 seconds, just time out
        return false;
      });
    } catch (_) {}
    return status;
  }

  static Future<bool> get isShieldInitialized async {
    var isShieldInitialized = false;
    try {
      isShieldInitialized = await _channel.invokeMethod("isShieldInitialized");
    } catch (_) {}
    return isShieldInitialized;
  }

  static Future<void> _methodHandler(MethodCall call) async {
    try {
      switch (call.method) {
        case "setDeviceResult":
          {
            _shieldCallback?.onSuccess(json.decode(call.arguments));
            break;
          }
        case "setDeviceResultError":
          {
            ShieldError shieldError = ShieldError(call.arguments["code"] ?? 0,
                call.arguments["message"] ?? "Unknown error");
            _shieldCallback?.onError(shieldError);
            break;
          }
      }
    } on PlatformException catch (e) {
      ShieldError shieldError =
          ShieldError(int.parse(e.code), e.message ?? "Unknown error");
      _shieldCallback?.onError(shieldError);
    } catch (_) {
      ShieldError shieldError = ShieldError(0, "Unknown error");
      _shieldCallback?.onError(shieldError);
    }
  }
}
