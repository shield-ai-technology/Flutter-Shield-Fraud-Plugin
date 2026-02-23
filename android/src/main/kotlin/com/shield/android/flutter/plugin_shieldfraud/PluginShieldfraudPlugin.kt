package com.shield.android.flutter.plugin_shieldfraud

import android.app.Activity
import android.app.Application
import android.os.Handler
import android.os.Looper
import com.shield.android.*
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.cancel
import android.util.Log



class PluginShieldfraudPlugin :
    FlutterPlugin,
    MethodChannel.MethodCallHandler,
    ActivityAware {

    companion object {
        private const val TAG = "ShieldFlutterPlugin"
    }

    private lateinit var channel: MethodChannel
    private lateinit var application: Application
    private var activity: Activity? = null
    private var isInitializing = false

    private val mainHandler = Handler(Looper.getMainLooper())

    private var shield: Shield? = null
    private var sessionIdCache: String? = null

    private val mainScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    // ---------- Lifecycle ----------

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        application = binding.applicationContext as Application
        channel = MethodChannel(binding.binaryMessenger, "plugin_shieldfraud")
        channel.setMethodCallHandler(this)
        if (shield != null) {
            startDeviceResultListener()
        }
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        mainScope.cancel()
        channel.setMethodCallHandler(null)
    }

    //We do not need to use activity we use application directly but keeping if we need it in the future
    override fun onAttachedToActivity(binding: ActivityPluginBinding) {
        activity = binding.activity
    }

    override fun onDetachedFromActivity() {
        activity = null
    }
    override fun onDetachedFromActivityForConfigChanges() {
        activity = null
    }
    override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) {
        activity = binding.activity
    }

    // ---------- Method Channel ----------

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {

        when (call.method) {
            "setCrossPlatformParameters" -> {
                val pluginName: String? = call.argument("name")
                val pluginVersion: String? = call.argument("version")
                if( pluginName != null && pluginVersion != null) {
                    setCrossPlatformParameters(pluginName, pluginVersion)
                }
                result.success(null)
            }

            "initShieldFraud" -> initShieldFraud(call, result)

            "getSessionID" -> result.success(sessionIdCache ?: shield?.sessionId ?: "")

            "getDeviceResult" -> {

                val localShield = shield

                if (localShield == null) {
                    result.success(null)
                    return
                }

                try {
                    val latest = localShield.latestDeviceResult

                    if (latest != null) {
                        result.success(latest.toString())
                    } else {
                        result.success(null)
                    }

                } catch (e: Exception) {
                    result.error("SHIELD_ERROR", e.message, null)
                }
            }


            "sendAttributes" -> {
                val screenName = call.argument<String>("screenName")
                val attrs = call.argument<HashMap<String, String>>("attributes")

                if (screenName == null || attrs == null) {
                    result.error("SHIELD_ERROR", "Invalid arguments", null)
                    return
                }

                sendAttributes(screenName, attrs, result)
            }

            "sendDeviceSignature" -> {
                val screenName = call.argument<String>("screenName") ?: ""
                sendDeviceSignature(screenName, result)
            }

            "isShieldInitialized" -> result.success(shield != null)

            else -> result.notImplemented()
        }
    }

    // ---------- INIT ----------

    private fun initShieldFraud(call: MethodCall, result: MethodChannel.Result) {

        if (shield != null) {
            Log.d(TAG, "Shield already initialized, reusing existing instance")
            result.success(null)
            return
        }

        if (isInitializing) {
            Log.d(TAG, "Shield initialization already in progress")
            result.success(null)
            return
        }

        isInitializing = true

        val siteId = call.argument<String>("siteID")
        val key = call.argument<String>("key")
        val needBackgroundListener = call.argument<Boolean>("needBackgroundListener") == true
        val blockScreenRecording = call.argument<Boolean>("blockScreenRecording") == true
        val partnerId = call.argument<String>("partnerId")

        if (siteId.isNullOrEmpty() || key.isNullOrEmpty()) {
            isInitializing = false
            result.error("SHIELD_ERROR", "Missing siteID or key", null)
            return
        }

        val config = ShieldConfig(siteId, key).apply {
            environment = mapEnvironment(call.argument("environment"))
            logLevel = mapLogLevel(call.argument("logLevel"))
            this.needBackgroundListener = needBackgroundListener
            this.blockScreenRecording = blockScreenRecording
            partnerId?.let { this.partnerId = it }
        }

        val blockedDialogMap = call.argument<HashMap<String, String>>("defaultBlockedDialog")

        blockedDialogMap?.let {
            val title = it["title"]
            val body = it["body"]

            if (!title.isNullOrEmpty() && !body.isNullOrEmpty()) {
                config.blockedDialog = BlockedDialog(title, body)
            }
        }

        val registerCallback = call.argument<Boolean>("registerCallback") == true
        shield = if (registerCallback) {

            ShieldFactory.createShieldWithCallback(
                application,
                config
            ) { sdkResult ->
                when (sdkResult) {
                    is Result.Success -> {
                        sessionIdCache = sdkResult.data.sessionId
                        mainHandler.post {
                            channel.invokeMethod(
                                "setDeviceResult",
                                sdkResult.data.data.toString()
                            )
                        }
                    }

                    is Result.Failure -> {
                        val err = hashMapOf<String, Any>()
                        err["message"] = sdkResult.error.errorMessage ?: ""
                        err["code"] = sdkResult.error.errorCode ?: 0
                        mainHandler.post {
                            channel.invokeMethod("setDeviceResultError", err)
                        }
                    }
                }
            }

        } else {
            ShieldFactory.createShield(application, config)
        }
        if (!registerCallback) {
            startDeviceResultListener()
        }
        isInitializing = false
        result.success(null)
    }

    // ---------- FLOW LISTENER ----------

    private fun startDeviceResultListener() {
        val localShield = shield ?: return
        mainScope.launch {
            localShield.onDeviceResult().collect { res ->
                when (res) {
                    is Result.Success -> {
                        sessionIdCache = res.data.sessionId
                        mainHandler.post {
                            channel.invokeMethod(
                                "setDeviceResult",
                                res.data.data.toString()
                            )
                        }
                    }
                    is Result.Failure -> {
                        val err = hashMapOf<String, Any>()
                        err["message"] = res.error.errorMessage ?: ""
                        err["code"] = res.error.errorCode ?: 0
                        mainHandler.post {
                            channel.invokeMethod("setDeviceResultError", err)
                        }
                    }
                }
            }
        }
    }

    // ---------- SEND ATTRIBUTES ----------
    private fun sendAttributes(
        screenName: String,
        data: HashMap<String, String>,
        result: MethodChannel.Result
    ) {

        val localShield = shield ?: run {
            result.error("SHIELD_ERROR", "Shield not initialized", null)
            return
        }

        mainScope.launch {
            try {
                val res = localShield
                    .sendAttributes(screenName, data)
                    .first()
                when (res) {
                    is Result.Success<*> -> {
                        val sessionId = res.data as String
                        sessionIdCache = sessionId
                        mainHandler.post {
                            result.success(sessionId) // ✅ return actual sessionId
                        }
                    }
                    is Result.Failure<*> -> {
                        mainHandler.post {
                            result.error(
                                res.error.errorCode.toString(),
                                res.error.errorMessage ?: "Unknown error",
                                null
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                mainHandler.post {
                    result.error(
                        "SHIELD_ERROR",
                        e.message ?: "Unknown error",
                        null
                    )
                }
            }
        }
    }


    // ---------- SIGNATURE ----------

    private fun sendDeviceSignature(
        screenName: String,
        result: MethodChannel.Result
    ) {
        val localShield = shield ?: run {
            result.error("SHIELD_ERROR", "Shield not initialized", null)
            return
        }
        mainScope.launch {
            try {
                val flow = localShield.sendDeviceSignature(screenName)
                val res = flow.first()
                when (res) {
                    is Result.Success<*> -> {
                        val sessionId = res.data as String
                        sessionIdCache = sessionId
                        mainHandler.post {
                            result.success(sessionId)
                        }
                    }
                    is Result.Failure<*> -> {
                        mainHandler.post {
                            result.error(
                                res.error.errorCode.toString(),
                                res.error.errorMessage ?: "Signature failed",
                                null
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                mainHandler.post {
                    result.error(
                        "SHIELD_ERROR",
                        e.message ?: "Signature failed",
                        null
                    )
                }
            }
        }
    }

    // ---------- CROSS PLATFORM PARAMETERS ----------
    private fun setCrossPlatformParameters(name: String, version: String) {
        ShieldCrossPlatformHelper.setCrossPlatformParameters(ShieldCrossPlatformParams(name, version))
    }



    // ---------- ENUM MAPPING ----------

    private fun mapEnvironment(env: String?): Environment {
        return when (env?.lowercase()) {
            "dev" -> Environment.DEV
            "staging" -> Environment.STAGING
            else -> Environment.PROD
        }
    }

    private fun mapLogLevel(level: String?): LogLevel {
        return when (level?.lowercase()) {
            "debug" -> LogLevel.DEBUG
            "info" -> LogLevel.INFO
            "verbose" -> LogLevel.VERBOSE
            else -> LogLevel.NONE
        }
    }
}
