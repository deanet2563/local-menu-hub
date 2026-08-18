package cc.mytree.shop.linelogin

import com.linecorp.linesdk.Scope
import com.linecorp.linesdk.api.LineApiClientBuilder
import com.linecorp.linesdk.auth.LineAuthenticationParams
import com.linecorp.linesdk.auth.LineLoginApi
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Arrays

class MyTreeLineLoginModule : Module() {
  private val channelId = "2010936243"
  private val requestCode = 20109
  private var loginPromise: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("MyTreeLineLogin")

    AsyncFunction("login") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("LINE_NO_ACTIVITY", "No active Android activity")
        return@AsyncFunction
      }
      if (loginPromise != null) {
        promise.reject("LINE_LOGIN_IN_PROGRESS", "LINE Login is already in progress")
        return@AsyncFunction
      }

      val params = LineAuthenticationParams.Builder()
        .scopes(Arrays.asList(Scope.PROFILE, Scope.OPENID_CONNECT))
        .build()
      val intent = LineLoginApi.getLoginIntent(activity, channelId, params)
      loginPromise = promise
      activity.runOnUiThread {
        activity.startActivityForResult(intent, requestCode)
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != requestCode) return@OnActivityResult
      val promise = loginPromise ?: return@OnActivityResult
      loginPromise = null

      val result = LineLoginApi.getLoginResultFromIntent(payload.data)
      if (!result.isSuccess) {
        promise.reject("LINE_LOGIN_FAILED", result.errorData?.message ?: "LINE Login failed")
        return@OnActivityResult
      }

      val raw = result.lineIdToken?.rawString
      if (raw.isNullOrBlank()) {
        promise.reject("LINE_ID_TOKEN_MISSING", "LINE Login succeeded but no OpenID ID token was returned")
        return@OnActivityResult
      }
      promise.resolve(mapOf("idToken" to raw))
    }

    AsyncFunction("logout") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve(null)
        return@AsyncFunction
      }
      val response = LineApiClientBuilder(context, channelId).build().logout()
      if (response.isSuccess) promise.resolve(null)
      else promise.reject("LINE_LOGOUT_FAILED", response.errorData?.message ?: "LINE logout failed")
    }
  }
}
