#import "PluginShieldfraudPlugin.h"

#if __has_include(<flutter_shieldfraud/flutter_shieldfraud-Swift.h>)
#import <flutter_shieldfraud/flutter_shieldfraud-Swift.h>
#else
// Support project import fallback if the generated compatibility header
// is not copied when this plugin is created as a library.
// https://forums.swift.org/t/swift-static-libraries-dont-copy-generated-objective-c-header/19816
#import "flutter_shieldfraud-Swift.h"

#endif

@implementation PluginShieldfraudPlugin
+ (void)registerWithRegistrar:(NSObject <FlutterPluginRegistrar> *)registrar {
    [SwiftPluginShieldfraudPlugin registerWithRegistrar:registrar];
}
@end
