import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_shieldfraud/plugin_shieldfraud.dart';
import 'package:flutter_shieldfraud/shield_config.dart';

void main() {
  runApp(const MaterialApp(
    debugShowCheckedModeBanner: false,
    home: MyApp(),
  ));
}


class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  static const _logTag = "[ShieldFlutterExample]";

  String _jsonString = "";
  String? _errorMessage;
  bool _isLoading = true;
  bool _isSending = false;

  void log(String message) {
    debugPrint("$_logTag $message");
  }

  @override
  void initState() {
    super.initState();
    _initShield();
  }

  // -------------------------------------------------
  // SDK INIT (Crash Safe + Timeout Safe)
  // -------------------------------------------------

  Future<void> _initShield() async {
    try {
      ShieldCallback shieldCallback = ShieldCallback(
            (Map<String, dynamic> result) {
          if (!mounted) return;
          setState(() {
            _jsonString = const JsonEncoder.withIndent('  ').convert(result);
            _errorMessage = null;
            _isLoading = false;
          });
        },
            (ShieldError error) {
          if (!mounted) return;
          log("Device Result ERROR ${error.code} ${error.message}");
          setState(() {
            _errorMessage = "${error.code} : ${error.message}";
            _isLoading = false;
          });
        },
      );

      final alreadyInit = await Shield.isShieldInitialized;
      if (!alreadyInit) {
        final config = ShieldConfig(
          siteID: "59947973924580a1bf14766e74331641870de57f",
          key: "242236650000000059947973924580a1bf14766e74331641870de57f",
          shieldCallback: shieldCallback,
          environment: ShieldEnvironment.prod,
          logLevel: ShieldLogLevel.verbose,
        );

        // Timeout protection (prevents infinite spinner)
        await Future.any<void>([
          Shield.initShield(config),
          Future.delayed(const Duration(seconds: 12)),
        ]);
      } else {
        final latest = await Shield.latestDeviceResult;
        if (!mounted) return;
        if (latest != null) {
          setState(() {
            _jsonString =
                const JsonEncoder.withIndent('  ').convert(latest);
            _errorMessage = null;
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (!mounted) return;
      log("Init Exception $e");
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  //swipe down to refresh
  Future<void> _refreshLatestResult() async {
    try {
      log("Swipe refresh triggered");

      final latest = await Shield.latestDeviceResult;

      if (!mounted) return;

      if (latest != null) {
        setState(() {
          _jsonString =
              const JsonEncoder.withIndent('  ').convert(latest);
          _errorMessage = null;
        });
        log("Latest device result refreshed");
      } else {
        log("No latest device result available");
      }
    } catch (e) {
      log("Refresh error: $e");
    }
  }


  // -------------------------------------------------
  // BUTTON ACTIONS (Tap Safe)
  // -------------------------------------------------

  Future<void> _sendSignature() async {
    if (_isSending) return;
    try {
      setState(() => _isSending = true);
      log("Manual Signature Triggered");
      final success = await Shield.sendDeviceSignature("manually triggered");
      final sessionId = await Shield.sessionId;
      log("Signature success = $success");
    } catch (e) {
      log("Signature Error $e");
    } finally {
      if (mounted) {
        setState(() => _isSending = false);
      }
    }
  }

  Future<void> _sendAttributes(String userId) async {
    if (_isSending) return;
    try {
      setState(() => _isSending = true);
      log("Manual Attributes Triggered with userId = $userId");
      final sessionId = await Shield.sendAttributes(
        "login",
        {
          "user_id": userId,
        },
      );

      if (sessionId != null) {
        log("Attributes SUCCESS - sessionId = $sessionId");
      } else {
        log("Attributes FAILED");
      }
    } catch (e) {
      log("Attributes Error $e");
    } finally {
      if (mounted) {
        setState(() => _isSending = false);
      }
    }
  }


  Future<void> _showUserIdDialog() async {
    final controller = TextEditingController();
    final userId = await showDialog<String>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text("Enter User ID"),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(
              hintText: "Enter userid",
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Cancel"),
            ),
            ElevatedButton(
              onPressed: () {
                final value = controller.text.trim();
                if (value.isNotEmpty) {
                  Navigator.pop(context, value);
                }
              },
              child: const Text("Send"),
            ),
          ],
        );
      },
    );

    if (userId != null && userId.isNotEmpty) {
      _sendAttributes(userId);
    }
  }


  // -------------------------------------------------
  // UI
  // -------------------------------------------------

  @override
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF012856),
        title: const Text(
          "Plugin Example App",
          style: TextStyle(color: Colors.white),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refreshLatestResult,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(12),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: MediaQuery.of(context).size.height * 0.6,
                  ),
                  child: _buildBodyContent(),
                ),
              ),
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Row(
                children: [
                  Expanded(child: _buildSignatureButton()),
                  const SizedBox(width: 5),
                  Expanded(child: _buildAttributesButton()),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }


  Widget _buildBodyContent() {
    if (_isLoading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.only(top: 40),
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (_errorMessage != null) {
      return SelectableText(
        _errorMessage!,
        style: const TextStyle(color: Colors.red),
      );
    }

    if (_jsonString.isEmpty) {
      return const Text("Waiting for data...");
    }

    return SelectableText(_jsonString);
  }

  // -------------------------------------------------
  // BUTTON WIDGETS (Overflow Safe)
  // -------------------------------------------------

  Widget _buildSignatureButton() {
    return SizedBox(
      height: 48,
      child: ElevatedButton(
        onPressed: _isSending ? null : _sendSignature,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFFFFD040),
          foregroundColor: Colors.black,
        ),
        child: const FittedBox(
          child: Text("Send Device Signature"),
        ),
      ),
    );
  }

  Widget _buildAttributesButton() {
    return SizedBox(
      height: 48,
      child: ElevatedButton(
        onPressed: _isSending ? null : _showUserIdDialog,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF3CB4E4),
          foregroundColor: Colors.black,
        ),
        child: const FittedBox(
          child: Text("Send Device Attribute"),
        ),
      ),
    );
  }
}
