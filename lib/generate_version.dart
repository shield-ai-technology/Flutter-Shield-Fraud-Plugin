import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:yaml/yaml.dart';

void main() {
  final file = File('pubspec.yaml');
  final content = file.readAsStringSync();
  final yamlMap = loadYaml(content) as YamlMap;

  final version = yamlMap['version'] ?? 'unknown';
  final pluginName = yamlMap['name'] ?? 'unknown';

  final dartContent = '''
  /// This file is generated automatically. Do not edit manually.
  class PluginBuildInfo {
    static const String pluginVersion = '$version';
    static const String pluginName = '$pluginName';
  }
  ''';

  final outputFile = File('lib/generated/plugin_version_info.dart');

  if (!outputFile.existsSync()) {
    outputFile.createSync();
  }

  outputFile.writeAsStringSync(dartContent);
  if (kDebugMode) {
    print('Generated file \'generated/plugin_version_info.dart\' with version $version and package name $pluginName.');
  }
}
