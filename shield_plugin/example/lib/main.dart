import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_shieldfraud/plugin_shieldfraud.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  String jsonString = "";

  @override
  void initState() {
    super.initState();

    initShield();

    Future.delayed(const Duration(seconds: 2), () async {
      Shield.latestDeviceResult.then((latestDeviceResult) => {
            if (latestDeviceResult == null)
              {print("error ${Shield.latestError?.message}")}
            else
              {print("result $latestDeviceResult")}
          });
    });
  }

  Future<void> initShield() async {
    ShieldCallback shieldCallback =
        ShieldCallback((Map<String, dynamic> result) {
      setState(() {
        jsonString = const JsonEncoder.withIndent('  ').convert(result);
      });

      print("callback result: $result");
    }, (ShieldError error) {
      print("callback error: ${error.message}");
    });
    var data = <String, String>{};
    data["user_id"] = "12345";
    final valueInt = await Shield.isShieldInitialized;
    ShieldConfig config = ShieldConfig(
        siteID: "59947973924580a1bf14766e74331641870de57f",
        key: "242236650000000059947973924580a1bf14766e74331641870de57f",
        shieldCallback: shieldCallback,
        environment: ShieldEnvironment.prod,
        logLevel: ShieldLogLevel.debug);
    if (!valueInt) {
      Shield.initShield(config);
      Future.delayed(const Duration(seconds: 2), () async {
        final valueInt = await Shield.isShieldInitialized;
        if (valueInt) {
          Shield.sendAttributes("login", data);
        }
      });
    } else {
      Shield.sendAttributes("login", data);
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
          appBar: AppBar(
            title: const Text('Plugin example app'),
          ),
          body: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(jsonString, key: const Key('jsonString')),
              ),
              SizedBox(
                height: 100,
                width: double.infinity,
                child: MaterialButton(
                  onPressed: () {
                    Shield.sendDeviceSignature("test sending device signature")
                        .then((value) => print(
                            "sending device signature in real time successful: $value"));
                  },
                  child: const Text("Send attributes"),
                ),
              ),
            ],
          )),
    );
  }
}
