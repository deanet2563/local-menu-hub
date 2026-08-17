package cc.mytree.linelogin

import android.util.Base64
import com.linecorp.linesdk.LineApiResponseCode
import com.linecorp.linesdk.Scope
import com.linecorp.linesdk.auth.LineAuthenticationParams
import com.linecorp.linesdk.auth.LineLoginApi
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.SecureRandom

class MyTreeLineLoginModule : Module() {
  private var pendingPromise: Promise? = null
  private var pendingNonce: String? = null

  override fun definition() = ModuleDefinition {
    Name("MyTreeLineLogin")

    AsyncFunction("login") { channelId: String, promise: Promise ->
      if (channelId.isBlank()) {
        promise.reject("E_LINE_CONFIG", "LINE Login channel ID is required", null)
        return@AsyncFunction
      }

      if (pendingPromise != null) {
        promise.reject("E_LINE_IN_PROGRESS", "LINE Login is already in progress", null)
        return@AsyncFunction
      }

      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("E_LINE_ACTIVITY", "Current Android activity is unavailable", null)
        return@AsyncFunction
      }

      val nonceBytes = ByteArray(32)
      SecureRandom().nextBytes(nonceBytes)
      val nonce = Base64.encodeToString(
        nonceBytes,
        Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING,
      )

      val params = LineAuthenticationParams.Builder()
        .scopes(listOf(Scope.PROFILE, Scope.OPENID_CONNECT))
        .nonce(nonce)
        .build()

      val intent = LineLoginApi.getLoginIntent(activity, channelId, params)
      pendingPromise = promise
      pendingNonce = nonce
      activity.startActivityForResult(intent, REQUEST_CODE_LINE_LOGIN)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE_LINE_LOGIN) {
        return@OnActivityResult
      }

      val promise = pendingPromise ?: return@OnActivityResult
      val nonce = pendingNonce
      pendingPromise = null
      pendingNonce = null

      val result = LineLoginApi.getLoginResultFromIntent(payload.data)
      when (result.responseCode) {
        LineApiResponseCode.SUCCESS -> {
          val rawIdToken = result.lineIdToken?.rawString
          if (rawIdToken.isNullOrBlank() || nonce.isNullOrBlank()) {
            promise.reject("E_LINE_ID_TOKEN", "LINE Login did not return a valid OpenID Connect result", null)
            return@OnActivityResult
          }

          promise.resolve(mapOf("idToken" to rawIdToken, "nonce" to nonce))
        }

        LineApiResponseCode.CANCEL -> {
          promise.reject("E_LINE_CANCELLED", "LINE Login was cancelled", null)
        }

        else -> {
          val detail = result.errorData?.toString() ?: result.responseCode.toString()
          promise.reject("E_LINE_LOGIN", "LINE Login failed: $detail", null)
        }
      }
    }
  }

  companion object {
    private const val REQUEST_CODE_LINE_LOGIN = 20109
  }
}
