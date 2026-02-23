import 'dart:async';
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter_shieldfraud/generated/plugin_version_info.dart';
import 'package:flutter/foundation.dart';
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

      unawaited(setCrossPlatformParameters());

      await _channel.invokeMethod("initShieldFraud", {
        "siteID": config.siteID,
        "key": config.key,
        "registerCallback": config.shieldCallback != null,
        "needBackgroundListener": config.needBackgroundListener,
        "blockScreenRecording": config.blockScreenRecording,
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
    } catch (e,s) {
      // Need a method to log this error
      _internalLog("initShield failed", e, s);
    }
  }

  static Future<void> setCrossPlatformParameters() async {
    try {
      await _channel.invokeMethod("setCrossPlatformParameters", {
        "name": PluginBuildInfo.pluginName,
        "version": PluginBuildInfo.pluginVersion
      });
    } catch (e, s) {
      _internalLog("setCrossPlatformParameters failed", e, s);
    }
  }

  static Future<String> get sessionId async {
    try {
      return await _channel.invokeMethod('getSessionID');
    } catch (e,s) {
      _internalLog("getSessionID failed", e, s);
      return "";
    }
  }

  static ShieldError? latestError;

  static Future<Map<String, dynamic>?> get latestDeviceResult async {
    try {
      final result = await _channel.invokeMethod('getDeviceResult');
      latestError = null;
      if (result == null) return null;
      return json.decode(result);
    } on PlatformException catch (e) {
      latestError =
          ShieldError(int.tryParse(e.code) ?? 0, e.message ?? "Unknown error");
    } catch (e,s) {
      _internalLog("latestDeviceResult failed", e, s);
      latestError = ShieldError(0, "Unknown error ${e.toString()}");
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
    } catch (e,s) {
      _internalLog("sendAttributes failed", e, s);
      return null;
    }
  }


  static Future<String?> sendDeviceSignature(String screenName) async {
    try {
      final result = await _channel
          .invokeMethod<String>(
        "sendDeviceSignature",
        {"screenName": screenName},
      )
          .timeout(
        const Duration(seconds: 30),
        onTimeout: () => null,
      );

      return result;
    }  catch (e, s) {
      _internalLog("sendDeviceSignature failed", e, s);
      return null;
    }
  }

  static Future<bool> get isShieldInitialized async {
    try {
      return await _channel.invokeMethod("isShieldInitialized");
    } catch (e,s) {
      _internalLog("isShieldInitialized failed", e, s);
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
    } catch (e,s) {
      _internalLog("methodHandler failed", e, s);
      _shieldCallback?.onError(ShieldError(0, "Unknown error: ${e.toString()}"));
    }
  }

  static void _internalLog(String message, Object error, StackTrace stack) {
    assert(() {
      debugPrint("[ShieldFlutter] $message → $error");
      debugPrintStack(stackTrace: stack);
      return true;
    }());
  }
}
