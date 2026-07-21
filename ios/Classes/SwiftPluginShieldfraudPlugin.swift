import Flutter
import ShieldFraud

public class SwiftPluginShieldfraudPlugin: NSObject, FlutterPlugin {

    static var channel: FlutterMethodChannel?

    private var shield: Shield?

    public static func register(with registrar: FlutterPluginRegistrar) {
        channel = FlutterMethodChannel(
            name: "plugin_shieldfraud",
            binaryMessenger: registrar.messenger()
        )

        if let channel = channel {
            let instance = SwiftPluginShieldfraudPlugin()
            registrar.addMethodCallDelegate(instance, channel: channel)
            registrar.addApplicationDelegate(instance)
        }
    }

    public func handle(
        _ call: FlutterMethodCall,
        result: @escaping FlutterResult
    ) {
        if call.method == "setCrossPlatformParameters" {
            if let args = call.arguments as? [String: Any],
               let pluginName = args["name"] as? String,
               let pluginVersion = args["version"] as? String {
                let params = ShieldCrossPlatformParams(
                    name: pluginName,
                    version: pluginVersion
                )
                ShieldCrossPlatformHelper.setCrossPlatformParameters(params)
            }

        } else if call.method == "initShieldFraud" {
            self.initShieldFraud(call.arguments, result)

        } else if call.method == "getSessionID" {
            guard let shield = self.shield else {
                result(FlutterError(
                    code: "100",
                    message: "Initialize sdk before calling getSessionId",
                    details: nil
                ))
                return
            }

            result(shield.sessionId)

        } else if call.method == "getDeviceResult" {
            self.getDeviceResult(result)

        } else if call.method == "sendAttributes" {
            guard let args = call.arguments as? [String: Any],
                  let screenName = args["screenName"] as? String,
                  let data = args["attributes"] as? [String: String] else {
                return
            }

            self.sendAttributes(
                screenName: screenName,
                data: data,
                result
            )

        } else if call.method == "sendDeviceSignature" {
            guard let args = call.arguments as? [String: Any],
                  let screenName = args["screenName"] as? String else {
                result(FlutterError(
                    code: "SHIELD_ERROR",
                    message: "Invalid arguments",
                    details: nil
                ))
                return
            }

            let userId = args["userId"] as? String

            self.sendDeviceSignature(
                screenName: screenName,
                userId: userId,
                result
            )

        } else if call.method == "isShieldInitialized" {
            result(self.shield != nil)

        } else {
            result(FlutterMethodNotImplemented)
        }
    }
}

extension SwiftPluginShieldfraudPlugin {

    private func initShieldFraud(
        _ arguments: Any?,
        _ result: @escaping FlutterResult
    ) {
        if self.shield != nil {
            result(nil)
            return
        }

        guard let args = arguments as? [String: Any],
              let siteID = args["siteID"] as? String,
              let key = args["key"] as? String,
              !siteID.isEmpty,
              !key.isEmpty else {
            result(FlutterError(
                code: "SHIELD_ERROR",
                message: "Missing siteID or key",
                details: nil
            ))
            return
        }

        let config = ShieldConfig(
            siteId: siteID,
            secretKey: key
        )

        if let partnerId = args["partnerId"] as? String {
            config.partnerId = partnerId
        }

        if let environment = args["environment"] as? String {
            if environment == "dev" {
                config.environment = Environment.dev
            } else if environment == "staging" {
                config.environment = Environment.stag
            } else {
                config.environment = Environment.prod
            }
        }

        if let logLevel = args["logLevel"] as? String {
            if logLevel == "debug" || logLevel == "verbose" {
                config.logLevel = LogLevel.debug
            } else if logLevel == "info" {
                config.logLevel = LogLevel.info
            } else {
                config.logLevel = LogLevel.none
            }
        }

        if let defaultBlockedDialog =
        args["defaultBlockedDialog"] as? [String: String],
           let title = defaultBlockedDialog["title"],
           let body = defaultBlockedDialog["body"] {
            config.defaultBlockedDialog = BlockedDialog(
                title: title,
                body: body
            )
        }

        let createdShield = ShieldFactory.createShield(config: config)
        self.shield = createdShield

        let registerCallback =
            args["registerCallback"] as? Bool == true

        if registerCallback {
            createdShield.onDeviceResult { [weak self] deviceIntelligence, error in
                if let error = error {
                    self?.emitDeviceResultError(error)
                    return
                }

                if let deviceIntelligence = deviceIntelligence {
                    self?.emitDeviceResult(deviceIntelligence.data)
                }
            }
        }

        result(nil)
    }

    private func getDeviceResult(
        _ result: @escaping FlutterResult
    ) {
        guard let shield = self.shield else {
            result(FlutterError(
                code: "100",
                message: "Initialize sdk before calling getDeviceResult",
                details: nil
            ))
            return
        }

        guard let deviceIntelligence =
        shield.getLatestDeviceResult() else {
            result(nil)
            return
        }

        guard let jsonData = try? JSONSerialization.data(
            withJSONObject: deviceIntelligence.data,
            options: []
        ) else {
            result(FlutterError(
                code: "0",
                message: "Failed to serialize device result",
                details: nil
            ))
            return
        }

        let dataString =
            String(bytes: jsonData, encoding: .utf8) ?? ""

        result(dataString)
    }

    private func sendAttributes(
        screenName: String,
        data: [String: String],
        _ result: @escaping FlutterResult
    ) {
        guard let shield = self.shield else {
            result(FlutterError(
                code: "SHIELD_ERROR",
                message: "Shield not initialized",
                details: nil
            ))
            return
        }

        shield.sendAttributes(
            screenName: screenName,
            data: data
        ) { sessionId, error in
            DispatchQueue.main.async {
                if let error = error {
                    result(self.flutterError(from: error))
                } else {
                    result(sessionId)
                }
            }
        }
    }

    private func sendDeviceSignature(
        screenName: String,
        userId: String?,
        _ result: @escaping FlutterResult
    ) {
        guard let shield = self.shield else {
            result(FlutterError(
                code: "SHIELD_ERROR",
                message: "Shield not initialized",
                details: nil
            ))
            return
        }

        let userData: ShieldUserData

        if let userId = userId,
           !userId.isEmpty {
            userData = ShieldUserData(
                screenName: screenName,
                userId: userId
            )
        } else {
            userData = ShieldUserData(
                screenName: screenName
            )
        }

        shield.sendDeviceSignature(
            userData: userData
        ) { sessionId, error in
            DispatchQueue.main.async {
                if let error = error {
                    result(self.flutterError(from: error))
                } else {
                    result(sessionId)
                }
            }
        }
    }

    private func emitDeviceResult(
        _ deviceResult: [String: Any]
    ) {
        guard let jsonData = try? JSONSerialization.data(
            withJSONObject: deviceResult,
            options: []
        ) else {
            return
        }

        let dataString =
            String(bytes: jsonData, encoding: .utf8) ?? ""

        DispatchQueue.main.async {
            SwiftPluginShieldfraudPlugin.channel?.invokeMethod(
                "setDeviceResult",
                arguments: dataString
            )
        }
    }

    private func emitDeviceResultError(
        _ error: ShieldError
    ) {
        var shieldError: [String: Any] = [
            "message": error.errorMessage,
            "code": error.errorCode
        ]

        if let underlying = error.underlying {
            shieldError["exception"] =
                underlying.localizedDescription
        }

        DispatchQueue.main.async {
            SwiftPluginShieldfraudPlugin.channel?.invokeMethod(
                "setDeviceResultError",
                arguments: shieldError
            )
        }
    }

    private func flutterError(
        from error: ShieldError
    ) -> FlutterError {
        return FlutterError(
            code: error.errorCode,
            message: error.errorMessage,
            details: error.underlying?.localizedDescription
        )
    }
}