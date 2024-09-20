#import "PluginShieldfraudPlugin.h"
#if __has_include(<flutter_shieldfraud_adv/flutter_shieldfraud_adv-Swift.h>)
#import <flutter_shieldfraud_adv/flutter_shieldfraud_adv-Swift.h>
#else
// Support project import fallback if the generated compatibility header
// is not copied when this plugin is created as a library.
// https://forums.swift.org/t/swift-static-libraries-dont-copy-generated-objective-c-header/19816
#import "flutter_shieldfraud_adv-Swift.h"
#endif

@implementation PluginShieldfraudPlugin
+ (void)registerWithRegistrar:(NSObject<FlutterPluginRegistrar>*)registrar {
  [SwiftPluginShieldfraudPlugin registerWithRegistrar:registrar];
}
@end
