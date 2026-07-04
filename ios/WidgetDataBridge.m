#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetDataBridge, NSObject)
RCT_EXTERN_METHOD(updateWidgetData:(NSString *)jsonString)
@end
