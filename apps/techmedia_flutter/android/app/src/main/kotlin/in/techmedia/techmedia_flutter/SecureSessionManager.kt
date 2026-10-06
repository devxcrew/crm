package `in`.techmedia.techmedia_flutter

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

class SecureSessionManager(private val activity: FragmentActivity) {
    private val preferences by lazy {
        val masterKey = MasterKey.Builder(activity)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            activity,
            "${activity.packageName}_secure_session",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    fun handle(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "read" -> result.success(preferences.getString(call.key(), null))
            "write" -> {
                preferences.edit().putString(call.key(), call.argument<String>("value")).apply()
                result.success(null)
            }
            "delete" -> {
                preferences.edit().remove(call.key()).apply()
                result.success(null)
            }
            "canUseBiometrics" -> result.success(canUseBiometrics())
            "authenticateBiometric" -> authenticate(result)
            else -> result.notImplemented()
        }
    }

    private fun canUseBiometrics(): Boolean {
        return BiometricManager.from(activity).canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG,
        ) == BiometricManager.BIOMETRIC_SUCCESS
    }

    private fun authenticate(result: MethodChannel.Result) {
        if (!canUseBiometrics()) return result.success(false)
        val prompt = BiometricPrompt(
            activity,
            ContextCompat.getMainExecutor(activity),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(
                    authenticationResult: BiometricPrompt.AuthenticationResult,
                ) = result.success(true)

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) =
                    result.success(false)
            },
        )
        prompt.authenticate(
            BiometricPrompt.PromptInfo.Builder()
                .setTitle(activity.getString(R.string.app_name))
                .setSubtitle("Confirm your identity")
                .setNegativeButtonText("Use PIN")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .build(),
        )
    }

    private fun MethodCall.key(): String {
        return argument<String>("key")
            ?: throw IllegalArgumentException("A secure storage key is required.")
    }
}
