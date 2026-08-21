import ExpoModulesCore
import LineSDK

public class MyTreeLineLoginModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MyTreeLineLogin")

    AsyncFunction("login") { (promise: Promise) in
      LoginManager.shared.login(permissions: [.profile, .openID]) { result in
        switch result {
        case .success(let loginResult):
          guard let idToken = loginResult.accessToken.IDTokenRaw, !idToken.isEmpty else {
            promise.reject("LINE_ID_TOKEN_MISSING", "LINE Login succeeded but no OpenID ID token was returned")
            return
          }
          promise.resolve(["idToken": idToken])
        case .failure(let error):
          promise.reject(error)
        }
      }
    }.runOnQueue(.main)

    AsyncFunction("logout") { (promise: Promise) in
      LoginManager.shared.logout { result in
        switch result {
        case .success:
          promise.resolve(nil)
        case .failure(let error):
          promise.reject(error)
        }
      }
    }.runOnQueue(.main)
  }
}
