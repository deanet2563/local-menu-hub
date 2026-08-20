import ExpoModulesCore
import LineSDK
import UIKit

public class MyTreeLineLoginAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  private let channelID = "2010936243"

  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    LoginManager.shared.setup(channelID: channelID, universalLinkURL: nil)
    return true
  }

  public func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return LoginManager.shared.application(app, open: url, options: options)
  }
}
