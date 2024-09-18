# Flutter Shield Fraud Plugin

Flutter Plugin for Shield Fraud (www.shield.com)

Flutter Shield Fraud Plugin helps developers to assess malicious activities performed on mobile devices and return risk intelligence based on user's behaviour. It collects device's fingerprint, social metrics and network information. 

There are four steps to getting started with the SHIELD SDK:

1. [Integrate the SDK](#integrate-the-sdk)

2. [Initialize the SDK](#initialize-the-sdk)

3. [Get Session ID](#get-session-id)

4. [Get Device Results](#get-device-results)

5. [Send Custom Attributes](#send-custom-attributes)


### Integrate the SDK

The SHIELD FLUTTER SDK is compatible with Android and iOS apps supporting flutter version starting from 1.20.0.
You should ensure that you add flutter_shieldfraud_ard as a dependency in your flutter project's pubsepc.yaml

```
dependencies:
  flutter_shieldfraud_ard: ^1.0.0
```

You should then run flutter packages get or update your packages in IntelliJ.

**Note**: We make continuous enhancements to our fraud library and detection capabilities which includes new functionalities, bug fixes and security updates. We recommend updating to the latest SDK version to protect against rapidly evolving fraud risks.
You can refer to the Changelog to see more details about our updates.

### Initialize the SDK

The SDK initialization should be configured at the earliest of the App Lifecycle to ensure successful generation and processing of the device fingerprint.

You need both the SHIELD_SITE_ID and SHIELD_SECRET_KEY to initialize the SDK. You can locate them at the top of the page.

Initialize Shield at the beginning of app launch by overriding the initState method of the first StatefulWidget's State in main.dart file

```
void main() {
    runApp(const MyApp());
}

class MyApp extends StatefulWidget {

    const MyApp({Key? key}) : super(key: key);
        @override
        State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
    @override
    void initState() {
        super.initState();
        //Create shield configs
        ShieldConfig config = ShieldConfig(siteID: “SHIELD_SITE_ID”, key: “SHIELD_SECRET_KEY”);
        //initialize shield sdk using shield config
        Shield.initShield(config);
    }
}
```

### Get Session ID
Session ID is the unique identifier of a user’s app session and acts as a point of reference when retrieving the device result for that session.


Session ID follows the OS lifecycle management, in-line with industry best practice. This means that a user’s session is active for as long as the device maintains it, unless the user terminates the app or the device runs out of memory and has to kill the app.

If you would like to retrieve device results using the backend API, it is important that you store the Session ID on your system. You will need to call the SHIELD backend API using this Session ID.

```
Shield.sessionId
    .then((sessionId) =>
        print("shield sessionId: $sessionId"));
```

### Get Device Results
SHIELD provides you actionable device intelligence which you can retrieve from the SDK, via the `Optimized Listener` or `Customized Pull method`. You can also retrieve results via the backend API.

*Warning: Only 1 method of obtaining device results **(Optimized Listener or Customized Pull)** can be in effect at any point in time.*

#### Retrieve device results via Optimized Listener

##### SHIELD recommends the Optimized Listener method to reduce number of API calls. #####

Our SDK will capture an initial device fingerprint upon SDK initialization and return an additional set of device intelligence ONLY if the device fingerprint changes along one session. This ensures a truly optimized end to end protection of your ecosystem.

You can register a callback if you would like to be notified in the event that the device attributes change during the session (for example, a user activates a malicious tool a moment after launching the page).

Add an additional parameter during intialization in order to register a callback. 

 ```
 class _MyAppState extends State<MyApp> {
     @override
    void initState() {
        super.initState();
        //Create a callback
        ShieldCallback shieldCallback = ShieldCallback((Map<String, dynamic> result) {
            print("device result: $result");
        }, (ShieldError error) {
            print("error: ${error.message}");
        });
        //Pass the callback to ShieldConfig Obj
        ShieldConfig config = ShieldConfig(siteID: “SHIELD_SITE_ID”,key: “SHIELD_SECRET_KEY”, shieldCallback: shieldCallback);
        Shield.initShield(config);
    }
}
 ```

#### Retrieve device results via Customized Pull
You can retrieve device results via Customized Pull at specific user checkpoints or activities, such as account registration, login, or checkout. This is to ensure that there is adequate time to generate a device fingerprint.

```
Shield.latestDeviceResult.then((latestDeviceResult) => {
    if (latestDeviceResult == null) {
        print( "error ${Shield.latestError?.message}")
    } else {
        print("result $latestDeviceResult")
    }
});
```

It is possible that getLatestDeviceResult returns null if the device result retrieval is unsuccessful. 

### Send Custom Attributes

Use the sendAttributes function to sent event-based attributes such as user_id or activity_id for enhanced analytics. This function accepts two parameters:screenName where the function is triggered, and data to provide any custom fields in key, value pairs.

```
Map<String, String> data = HashMap();
data["key_1"] = "value_1";
data["key_2"] = "value_2";

Shield.sendAttributes("login_screen", data)
    .then((value) => print("successfully sent attributes: $value"));
```
