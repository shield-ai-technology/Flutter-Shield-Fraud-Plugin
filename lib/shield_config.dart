enum ShieldLogLevel { none, info, debug, verbose }

enum ShieldEnvironment { dev, prod }

typedef OnSuccess = Function(Map<String, dynamic>);
typedef OnError = Function(ShieldError);

class ShieldError {
  String message;
  int code;
  ShieldError(this.code, this.message);
}

class ShieldCallback {
  late OnSuccess onSuccess;
  late OnError onError;

  ShieldCallback(this.onSuccess, this.onError);
}

class ShieldConfig {
  final String siteID;
  final String key;
  bool enableMocking = false;
  ShieldLogLevel logLevel = ShieldLogLevel.none;
  ShieldEnvironment environment = ShieldEnvironment.prod;
  bool enableShieldProcess = false;
  bool enableBackgroundListener = false;
  String? partnerId = "";
  ShieldCallback? shieldCallback;

  ShieldConfig(
      {required this.siteID,
      required this.key,
      this.shieldCallback,
      this.enableBackgroundListener = false,
      this.enableShieldProcess = false,
      this.enableMocking = false,
      this.partnerId,
      this.environment = ShieldEnvironment.prod,
      this.logLevel = ShieldLogLevel.none});
}
