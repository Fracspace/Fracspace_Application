#import "AppDelegate.h"
#import <Firebase.h>
#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>
#import <RNAppsFlyer.h>
#import "StallionModule.h"
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>
#import <AVFoundation/AVFoundation.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"Fracspace";
  // New Architecture: registers third-party Fabric components / TurboModules (RN 0.77+)
  self.dependencyProvider = [RCTAppDependencyProvider new];
  [FIRApp configure];
  // Start in a mixable audio mode so muted videos (splash, autoplay cards)
  // don't stop the user's music. react-native-video switches to playback
  // (which does pause other audio) only when a video actually plays with sound.
  [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryAmbient error:nil];
  self.initialProps = @{};
  // iOS 27 refuses to launch an app built with its SDK that still makes its
  // window here; SceneDelegate (below) makes it in the window scene instead.
  self.automaticallyLoadReactNativeWindow = NO;
  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

// RN 0.74+ (bridgeless / New Architecture) loads JS from bundleURL.
// Release builds load the Stallion OTA bundle, falling back to the bundled main.jsbundle.
- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  NSURL *defaultBundle = [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
  return [StallionModule getBundleURL:defaultBundle];
#endif
}

- (BOOL)application:(UIApplication *)application openURL:(NSURL *)url options:(NSDictionary *)options
{
  [[AppsFlyerAttribution shared] handleOpenUrl:url options:options];
  return [RCTLinkingManager application:application openURL:url options:options];
}

- (BOOL)application:(UIApplication *)application continueUserActivity:(NSUserActivity *)userActivity restorationHandler:(void (^)(NSArray * _Nullable))restorationHandler
{
  [[AppsFlyerAttribution shared] continueUserActivity:userActivity restorationHandler:restorationHandler];
  return [RCTLinkingManager application:application continueUserActivity:userActivity restorationHandler:restorationHandler];
}

@end

// The window, and the deep links iOS sends to the scene instead of the app
// delegate once the app uses scenes.
@interface SceneDelegate : UIResponder <UIWindowSceneDelegate>
@property (nonatomic, strong) UIWindow *window;
@end

@implementation SceneDelegate

- (void)scene:(UIScene *)scene willConnectToSession:(UISceneSession *)session options:(UISceneConnectionOptions *)connectionOptions
{
  AppDelegate *app = (AppDelegate *)UIApplication.sharedApplication.delegate;

  // A link that cold-started the app goes in as launch options, where
  // Linking.getInitialURL() reads it.
  NSMutableDictionary *launchOptions = [NSMutableDictionary new];
  UIOpenURLContext *urlContext = connectionOptions.URLContexts.anyObject;
  if (urlContext) {
    launchOptions[UIApplicationLaunchOptionsURLKey] = urlContext.URL;
    [[AppsFlyerAttribution shared] handleOpenUrl:urlContext.URL options:@{}];
  }
  NSUserActivity *activity = connectionOptions.userActivities.anyObject;
  if (activity) {
    launchOptions[UIApplicationLaunchOptionsUserActivityDictionaryKey] = @{
      UIApplicationLaunchOptionsUserActivityTypeKey : activity.activityType,
      @"UIApplicationLaunchOptionsUserActivityKey" : activity,
    };
    [[AppsFlyerAttribution shared] continueUserActivity:activity restorationHandler:nil];
  }

  UIView *rootView = [app.rootViewFactory viewWithModuleName:app.moduleName
                                           initialProperties:app.initialProps
                                               launchOptions:launchOptions];
  self.window = [[UIWindow alloc] initWithWindowScene:(UIWindowScene *)scene];
  UIViewController *rootViewController = [app createRootViewController];
  [app setRootView:rootView toRootViewController:rootViewController];
  self.window.rootViewController = rootViewController;
  app.window = self.window;
  [self.window makeKeyAndVisible];
}

- (void)scene:(UIScene *)scene openURLContexts:(NSSet<UIOpenURLContext *> *)URLContexts
{
  for (UIOpenURLContext *context in URLContexts) {
    NSMutableDictionary *options = [NSMutableDictionary new];
    if (context.options.sourceApplication) {
      options[UIApplicationOpenURLOptionsSourceApplicationKey] = context.options.sourceApplication;
    }
    [[AppsFlyerAttribution shared] handleOpenUrl:context.URL options:options];
    [RCTLinkingManager application:UIApplication.sharedApplication openURL:context.URL options:options];
  }
}

- (void)scene:(UIScene *)scene continueUserActivity:(NSUserActivity *)userActivity
{
  [[AppsFlyerAttribution shared] continueUserActivity:userActivity restorationHandler:nil];
  [RCTLinkingManager application:UIApplication.sharedApplication continueUserActivity:userActivity restorationHandler:^(NSArray *_) {}];
}

@end
