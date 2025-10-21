enum ShieldLogLevel { none, info, debug, verbose }

enum ShieldEnvironment { dev, prod, staging }

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

class BlockedDialog {
  final String title;
  final String body;

  BlockedDialog({required this.title, required this.body});
}

class ShieldConfig {
  final String siteID;
  final String key;
  bool enableMocking = false;
  ShieldLogLevel logLevel = ShieldLogLevel.none;
  ShieldEnvironment environment = ShieldEnvironment.prod;
  bool enableBackgroundListener = false;
  String? partnerId = "";
  ShieldCallback? shieldCallback;
  BlockedDialog? defaultBlockedDialog;

  ShieldConfig(
      {required this.siteID,
      required this.key,
      this.shieldCallback,
      this.enableBackgroundListener = false,
      this.enableMocking = false,
      this.partnerId,
      this.environment = ShieldEnvironment.prod,
      this.logLevel = ShieldLogLevel.none,
      this.defaultBlockedDialog});
}
