import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:yaml/yaml.dart';
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
        default:
          environment = "prod";
          break;
      }

      print("\n ayonya before initShieldFraud call in dart");

      Future<Map> conf = loadConfig('../pubspec.yaml');
      conf.then((Map config) {
        print(config['name']);
        print(config['description']);
        print(config['version']);
        print(config['author']);
        print(config['homepage']);
        print(config['dependencies']);
      });

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

  static Future<Map<String, dynamic>> loadConfig(String filePath) async {
    try {
      final File file = File('/Users/ayonya/github/flutter-copy/shield-f-plugin/pubspec.yaml');
      final String yamlString = await file.readAsString();

      print(yamlString); // Print the content of the pubspec.yaml

      final content = await rootBundle.loadString(filePath);
      final yamlMap = loadYaml(content);
      print("\nayonya yaml Map  = " + yamlMap );

      return Map<String, dynamic>.from(yamlMap);
    } catch (e) {
      print("Error reading the file: $e");
      return {};
    }
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
