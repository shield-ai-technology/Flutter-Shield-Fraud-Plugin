#!/bin/bash

#Clean the flutter environment
flutter clean

#Get the dependencies
flutter pub get

# Run the Dart script to generate the version file
dart run lib/generate_version.dart

# Switch to the example directory that has the main.dart file.
cd 'example/' || { echo 'unable to switch directory'; exit; }

# Run the Flutter application
flutter run