#
# To learn more about a Podspec see http://guides.cocoapods.org/syntax/podspec.html.
# Run `pod lib lint shieldfraud.podspec` to validate before publishing.
#
Pod::Spec.new do |s|
  s.name             = 'flutter_shieldfraud'
  s.version          = '1.0.12'
  s.summary          = 'flutter plugin for Shield SDK'
  s.description      = <<-DESC
A new flutter plugin project.
                       DESC
  s.homepage         = 'https://shield.com'
  s.license          = { :file => '../LICENSE' }
  s.author           = { 'Shield' => 'mobilesdk@shield.com' }
  s.source           = { :path => '.' }
  s.source_files = 'Classes/**/*'
  s.dependency 'Flutter'
  s.dependency "ShieldFraud", ">= 1.5.46"
  s.platform = :ios, '9.0'
  # Flutter.framework does not contain a i386 slice.
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'i386' }
  s.swift_version = '5.5'
end
