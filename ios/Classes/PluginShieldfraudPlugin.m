#import "PluginShieldfraudPlugin.h"
#if __has_include(<flutterShieldfraud_ard/flutterShieldfraud_ard-Swift.h>)
#import <flutterShieldfraud_ard/flutterShieldfraud_ard-Swift.h>
#else
// Support project import fallback if the generated compatibility header
// is not copied when this plugin is created as a library.
// https://forums.swift.org/t/swift-static-libraries-dont-copy-generated-objective-c-header/19816
#import "flutterShieldfraud_ard-Swift.h"
#endif

@implementation PluginShieldfraudPlugin
+ (void)registerWithRegistrar:(NSObject<FlutterPluginRegistrar>*)registrar {
  [SwiftPluginShieldfraudPlugin registerWithRegistrar:registrar];
}
@end
