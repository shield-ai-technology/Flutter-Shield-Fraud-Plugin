// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility that Flutter provides. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plugin_shieldfraud_example/main.dart';

void main() {
  testWidgets('MyApp widget displays JSON result after API call',
      (WidgetTester tester) async {
    await tester.pumpWidget(const MyApp());

    // Wait for the API call to complete and update the UI
    await tester.pumpAndSettle(const Duration(seconds: 3));

    // Find the Text widget that displays the JSON result
    final jsonTextFinder = find.byKey(const Key('jsonString'));

    // Check that the JSON text is not empty
    expect(jsonTextFinder, findsOneWidget);
    final jsonTextWidget = tester.widget<Text>(jsonTextFinder);
    expect(jsonTextWidget.data, 'device_intelligence');
  });
}

// void main() {
//   group('MyApp', () {
//     FlutterDriver? driver;
//
//     setUpAll(() async {
//       driver = await FlutterDriver.connect();
//     });
//
//     tearDownAll(() async {
//       if (driver != null) {
//         driver?.close();
//       }
//     });
//
//     test('Verify text', () async {
//       const textFinder = ByText('');
//
//       await Future.delayed(const Duration(seconds: 5));
//
// // Retrieve the text value from the text widget
//       final textValue = await driver?.getText(textFinder);
//
//       print(textValue);
//
//       // // Assert the text value
//       expect(textValue, contains('device_intelligence'));
//     });
//   });
// }
