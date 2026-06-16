#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AppleVisionOCR, NSObject)

RCT_EXTERN_METHOD(recognizeText:(NSString *)imageUri
                  resolver:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)rejecter)

@end
