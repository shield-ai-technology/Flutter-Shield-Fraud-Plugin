import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_shieldfraud/generated/plugin_version_info.dart';
import 'shield_config.dart';

class Shield {
  static const MethodChannel _channel = MethodChannel('plugin_shieldfraud');
  static ShieldCallback? _shieldCallback;

  // --------------------------------------------------------
  // INIT
  // --------------------------------------------------------

  static Future<void> initShield(ShieldConfig config) async {
    try {
      if (config.shieldCallback != null) {
        _channel.setMethodCallHandler(_methodHandler);
        _shieldCallback = config.shieldCallback;
      }

      final environment = _serializeEnvironment(config.environment);
      final logLevel = _serializeLogLevel(config.logLevel);

      unawaited(setCrossPlatformParameters());

      final dialogMap = config.defaultBlockedDialog != null
          ? {
        "title": config.defaultBlockedDialog!.title,
        "body": config.defaultBlockedDialog!.body,
      }
          : null;

      final args = <String, dynamic>{
        "siteID": config.siteID,
        "key": config.key,
        "registerCallback": config.shieldCallback != null,
        "partnerId": config.partnerId,
        "environment": environment,
        "logLevel": logLevel,
        "defaultBlockedDialog": dialogMap,
      };

      // Android 2.x.x
      if (Platform.isAndroid) {
        args["needBackgroundListener"] = config.enableBackgroundListener;
        args["blockScreenRecording"] = config.blockScreenRecording;
      }

      // iOS 1.x.x
      if (Platform.isIOS) {
        args["enableBackgroundListener"] = config.enableBackgroundListener;
        args["enableMocking"] = config.enableMocking;
      }

      await _channel.invokeMethod("initShieldFraud", args);
    } catch (e, s) {
      _internalLog("initShield failed", e, s);
    }
  }

  // --------------------------------------------------------
  // CROSS PLATFORM PARAMS (fire & forget safe)
  // --------------------------------------------------------

  static Future<void> setCrossPlatformParameters() async {
    try {
      await _channel.invokeMethod("setCrossPlatformParameters", {
        "name": PluginBuildInfo.pluginName,
        "version": PluginBuildInfo.pluginVersion,
      });
    } catch (e, s) {
      _internalLog("setCrossPlatformParameters failed", e, s);
    }
  }

  // --------------------------------------------------------
  // SESSION
  // --------------------------------------------------------

  static Future<String> get sessionId async {
    try {
      final result = await _channel.invokeMethod('getSessionID');
      latestError = null;
      return result?.toString() ?? "";
    } on PlatformException catch (e, s) {
      _internalLog("getSessionID failed", e, s);
      latestError = ShieldError(
        e.code,
        e.message ?? e.details?.toString() ?? "Unknown error",
        exception: e.details?.toString(),
      );
      return "";
    } catch (e, s) {
      _internalLog("getSessionID failed", e, s);
      latestError = ShieldError(
        "0",
        e.toString().isNotEmpty
            ? e.toString()
            : (s.toString().isNotEmpty ? s.toString() : "Unknown error"),
      );
      return "";
    }
  }

  // --------------------------------------------------------
  // DEVICE RESULT
  // --------------------------------------------------------

  static ShieldError? latestError;

  static Future<Map<String, dynamic>?> get latestDeviceResult async {
    try {
      final result = await _channel.invokeMethod('getDeviceResult');
      latestError = null;

      if (result == null) return null;

      return _parseMap(result);
    } on PlatformException catch (e, s) {
      _internalLog("latestDeviceResult failed", e, s);
      latestError = ShieldError(
        e.code,
        e.message ?? e.details?.toString() ?? "Unknown error",
        exception: e.details?.toString(),
      );
    } catch (e, s) {
      _internalLog("latestDeviceResult failed", e, s);
      latestError = ShieldError(
        "0",
        e.toString().isNotEmpty
            ? e.toString()
            : (s.toString().isNotEmpty ? s.toString() : "Unknown error"),
      );
    }
    return null;
  }

  // --------------------------------------------------------
  // SEND ATTRIBUTES
  // --------------------------------------------------------

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

      latestError = null;

      // iOS old SDK → bool
      if (result is bool) {
        if (!result) {
          latestError = const ShieldError("0", "sendAttributes failed");
          return null;
        }
        return await sessionId;
      }

      // Android new SDK → sessionId
      return result?.toString();
    } on PlatformException catch (e, s) {
      _internalLog("sendAttributes failed", e, s);
      latestError = ShieldError(
        e.code,
        e.message ?? e.details?.toString() ?? "Unknown error",
        exception: e.details?.toString(),
      );
      return null;
    } catch (e, s) {
      _internalLog("sendAttributes failed", e, s);
      latestError = ShieldError(
        "0",
        e.toString().isNotEmpty
            ? e.toString()
            : (s.toString().isNotEmpty ? s.toString() : "Unknown error"),
      );
      return null;
    }
  }

  // --------------------------------------------------------
  // SEND SIGNATURE
  // --------------------------------------------------------

  static Future<String?> sendDeviceSignature(String screenName) async {
    try {
      final result = await _channel
          .invokeMethod(
        "sendDeviceSignature",
        {"screenName": screenName},
      )
          .timeout(const Duration(seconds: 30), onTimeout: () => null);

      latestError = null;

      // timeout case
      if (result == null) {
        latestError = const ShieldError(
          "0",
          "sendDeviceSignature timed out or failed",
        );
        return null;
      }

      // iOS old SDK → bool
      if (result is bool) {
        if (!result) {
          latestError = const ShieldError("0", "sendDeviceSignature failed");
          return null;
        }
        return await sessionId;
      }

      return result?.toString();
    } on PlatformException catch (e, s) {
      _internalLog("sendDeviceSignature failed", e, s);
      latestError = ShieldError(
        e.code,
        e.message ?? e.details?.toString() ?? "Unknown error",
        exception: e.details?.toString(),
      );
      return null;
    } catch (e, s) {
      _internalLog("sendDeviceSignature failed", e, s);
      latestError = ShieldError(
        "0",
        e.toString().isNotEmpty
            ? e.toString()
            : (s.toString().isNotEmpty ? s.toString() : "Unknown error"),
      );
      return null;
    }
  }

  // --------------------------------------------------------
  // INIT CHECK
  // --------------------------------------------------------

  static Future<bool> get isShieldInitialized async {
    try {
      return await _channel.invokeMethod("isShieldInitialized") ?? false;
    } catch (e, s) {
      _internalLog("isShieldInitialized failed", e, s);
      return false;
    }
  }

  // --------------------------------------------------------
  // CALLBACK HANDLER
  // --------------------------------------------------------

  static Future<void> _methodHandler(MethodCall call) async {
    try {
      switch (call.method) {
        case "setDeviceResult":
          final data = _parseMap(call.arguments);
          _shieldCallback?.onSuccess(data);
          break;

        case "setDeviceResultError":
          final data = _parseMap(call.arguments);
          final shieldError = ShieldError(
            _parseCode(data["code"]),
            data["message"]?.toString() ?? "Unknown error",
            exception: data["exception"]?.toString(),
          );
          latestError = shieldError;
          _shieldCallback?.onError(shieldError);
          break;
      }
    } catch (e, s) {
      _internalLog(
        "methodHandler failed. method=${call.method}, args=${call.arguments}, type=${call.arguments.runtimeType}",
        e,
        s,
      );
      final shieldError = ShieldError(
        "0",
        "Unknown error: ${e.toString()}",
      );
      latestError = shieldError;
      _shieldCallback?.onError(shieldError);
    }
  }

  // --------------------------------------------------------
  // SERIALIZERS (cross-SDK safe)
  // --------------------------------------------------------

  static String _serializeEnvironment(ShieldEnvironment env) {
    switch (env) {
      case ShieldEnvironment.dev:
        return "dev";
      case ShieldEnvironment.staging:
        return "staging";
      case ShieldEnvironment.prod:
      default:
        return "prod";
    }
  }

  static String _serializeLogLevel(ShieldLogLevel level) {
    // iOS 1.x expects enum.toString()
    if (Platform.isIOS) {
      return level.toString();
    }

    // Android 2.x expects enum.name
    return level.name;
  }

  static Map<String, dynamic> _parseMap(dynamic value) {
    if (value == null) return <String, dynamic>{};

    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }

    if (value is String) {
      final decoded = json.decode(value);
      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
    }

    throw FormatException(
      "Expected Map or JSON String, got ${value.runtimeType}",
    );
  }

  static String _parseCode(dynamic code) {
    if (code == null) return "0";
    return code.toString();
  }

  // --------------------------------------------------------
  // INTERNAL LOGGER
  // --------------------------------------------------------

  static void _internalLog(String message, Object error, StackTrace stack) {
    assert(() {
      debugPrint("[ShieldFlutter] $message → $error");
      debugPrintStack(stackTrace: stack);
      return true;
    }());
  }
}