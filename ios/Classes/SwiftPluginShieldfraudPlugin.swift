import Flutter
import ShieldFraud

public class SwiftPluginShieldfraudPlugin: NSObject, FlutterPlugin{

  static var channel: FlutterMethodChannel?
  static var isShieldInitialized: Bool = false
    
  public static func register(with registrar: FlutterPluginRegistrar) {
    channel = FlutterMethodChannel(name: "plugin_shieldfraud", binaryMessenger: registrar.messenger())
    if let channel = channel {
        let instance = SwiftPluginShieldfraudPlugin()
        registrar.addMethodCallDelegate(instance, channel: channel)
        registrar.addApplicationDelegate(instance)
    }
  }

  public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    if call.method == "initShieldFraud" {
        self.initShieldFraud(call.arguments)
    } else if call.method == "getSessionID" {
        if SwiftPluginShieldfraudPlugin.isShieldInitialized {
            let sessionId =  Shield.shared().sessionId
            result(sessionId)
        } else {
            result(FlutterError(code: "100", message: "Intialized sdk before calling getSessionId", details: nil))
            return
        }
     } else if call.method == "getDeviceResult" {
        self.getDeviceResult(result)
     } else if call.method == "sendAttributes" {
        guard let args = call.arguments as? [String: Any],
           let screenName = args["screenName"] as? String,
           let data = args["attributes"] as? Dictionary<String, String>
        else {
          return
        }
        self.sendAttributes(screenName: screenName, data: data, result)
        
     } else if call.method == "sendDeviceSignature" {
         guard let args = call.arguments as? [String: Any],
               let screenName = args["screenName"] as? String
         else {
             return
         }
         self.sendDeviceSignature(screenname: screenName, result)
     }else if call.method == "isShieldInitialized" {
         result(SwiftPluginShieldfraudPlugin.isShieldInitialized)
     }
      else {
        result(FlutterMethodNotImplemented)
        return
     }
  }
    
}

extension SwiftPluginShieldfraudPlugin: DeviceShieldCallback{
    
    private func initShieldFraud(_ arguments: Any?) {
        if SwiftPluginShieldfraudPlugin.isShieldInitialized {
            return
        }
        guard let args = arguments as? [String: Any],
              let siteID = args["siteID"] as? String,
              let key = args["key"] as? String else {
            return
        }
        let config = Configuration(withSiteId: siteID, secretKey: key)
        if let enableMocking = args["enableMocking"] as? Bool, enableMocking {
            config.enableMocking = true
        }
        if let partnerId = args["partnerId"] as? String{
            config.partnerId = partnerId
        }
        if let registerCallback = args["registerCallback"] as? Bool, registerCallback {
            config.deviceShieldCallback = self
        }
        if let environment = args["environment"] as? String {
            config.environment = environment == "dev" ? Environment.dev : Environment.prod
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
        Shield.setUp(with: config)
        SwiftPluginShieldfraudPlugin.isShieldInitialized = true
    }
    
    private func getDeviceResult(_ result: @escaping FlutterResult) {
        Shield.shared().setDeviceResultStateListener {  // check whether device result assessment is complete
            if let deviceResult = Shield.shared().getLatestDeviceResult() {
                guard let jsonData = try? JSONSerialization.data(withJSONObject: deviceResult, options: []) else { return }
                let dataString = String(bytes: jsonData, encoding: String.Encoding.utf8) ?? ""
                result(dataString)

            }

            if let error = Shield.shared().getErrorResponse() {
                result(FlutterError(code: String(error.code),
                                    message:error.localizedDescription,
                                    details: nil))
            }
        }
    }
    
    private func sendAttributes(screenName: String, data: [String: String], _ result: @escaping FlutterResult) {
        Shield.shared().sendAttributes(withScreenName: screenName, data: data) { (status, error) in
               if error != nil {
                    result(false)
               } else {
                   result(status)
               }

           }
    }
    
    private func sendDeviceSignature(screenname: String, _ result: @escaping FlutterResult) {
        Shield.shared().sendDeviceSignature(withScreenName: screenname) {
            result(true)
        }
    }
    public func didSuccess(result: [String : Any]) {
      guard let jsonData = try? JSONSerialization.data(withJSONObject: result, options: []) else { return }
      let dataString = String(bytes: jsonData, encoding: String.Encoding.utf8) ?? ""
      DispatchQueue.main.async {
        SwiftPluginShieldfraudPlugin.channel?.invokeMethod("setDeviceResult", arguments: dataString)
      }
    }

    public func didError(error: NSError) {
      DispatchQueue.main.async {
          
          var shieldError = [String : Any]()
          shieldError["message"] = error.localizedDescription
          shieldError["code"] = error.code
          SwiftPluginShieldfraudPlugin.channel?.invokeMethod("setDeviceResultError", arguments: shieldError)
      }
    }
}
