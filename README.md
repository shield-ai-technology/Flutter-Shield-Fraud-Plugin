# flutter_shieldfraud

SHIELD SDK helps developers to assess malicious activities performed on mobile devices and return risk intelligence based on user's behaviour. It collects device's fingerprint, social metrics and network information. SHIELD SDK is built with Java for Android and Swift for iOS.

## Getting Started

### Install the Library
You should ensure that you add flutter_shieldfraud as a dependency in your flutter project.

```yaml
dependencies:
  flutter_shieldfraud: <latest-version>
```
You should then run `flutter packages get` or update your packages in IntelliJ.

### Initialise the Client

Initialise Shield at the beginning of app launch by overriding the initState method of the first StatefulWidget's State in `main.dart`  file

```dart
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
    ShieldConfig config = ShieldConfig(siteID: “your_site_id”,
        key: “your_secret_key”);
    //initialize shield sdk using shield config
    Shield.initShield(config);
  }
}
```

### Get Session ID
Session ID is the unique identifier of a user’s app session
```dart
Shield.sessionId  
	.then((sessionId) => 
		print("shield sessionId: $sessionId"));
```

### Get Device Result
#### - Retrieve device results via Optimised Listener

Pass a callback to ShieldConfig object to retrieve device result via Listener.

```dart
class _MyAppState extends State<MyApp> {

		@override
		void initState() {
			super.initState();
			//Create a callback
			ShieldCallback shieldCallback =  
			    ShieldCallback((Map<String, dynamic> result) {  
			  print("device result: $result");  
			}, (ShieldError error) {  
			  print("error: ${error.message}");  
			});
			//Pass the callback to ShieldConfig Obj
			ShieldConfig config = ShieldConfig(siteID: “your_site_id”,
				key: “your_secret_key”, shieldCallback:  shieldCallback);
				
			Shield.initShield(config);
		}	
	}
```

#### - Retrieve device results via Customised Pull

You can also retrieve latest device result at any point.

```dart
Shield.latestDeviceResult  
  .then((latestDeviceResult) => {  
      if (latestDeviceResult == null) {  
        print( "error ${Shield.latestError?.message}")  
      } else {  
	    print("result $latestDeviceResult") 
      }  
});
```

## Send Custom Attributes
Use the `sendAttributes` function to sent event-based attributes such as `user_id` for enhanced analytics. This function accepts two parameters:`screenName` where the function is triggered, and  `data` to provide any custom fields in key, value pairs.

```dart
Map<String, String> data = HashMap();  
data["user_id"] = "abcdefghijk";  
data["email"] = "test@gmail.com";

Shield.sendAttributes("login_screen", data)  
    .then((value) => print("successfully sent attributes: $value"));
```