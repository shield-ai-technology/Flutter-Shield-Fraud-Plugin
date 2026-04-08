package com.shield.android.flutter.plugin_shieldfraud

import android.app.Activity
import android.app.Application
import kotlinx.coroutines.withContext
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
//    private val mainHandler = Handler(Looper.getMainLooper())

    private var shield: Shield? = null
    private var sessionIdCache: String? = null

    private val pluginScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // ---------------- LIFECYCLE ----------------

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        application = binding.applicationContext as Application
        channel = MethodChannel(binding.binaryMessenger, "plugin_shieldfraud")
        channel.setMethodCallHandler(this)
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        channel.setMethodCallHandler(null)
        pluginScope.cancel()
    }

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

    // ---------------- METHOD CHANNEL ----------------

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {

            "setCrossPlatformParameters" -> {
                val name = call.argument<String>("name")
                val version = call.argument<String>("version")
                if (name != null && version != null) {
                    setCrossPlatformParameters(name, version)
                }
                result.success(null)
            }

            "initShieldFraud" -> initShieldFraud(call, result)

            "getSessionID" -> {
                val localShield = shield
                if (localShield == null) {
                    result.error("100", "Initialize sdk before calling getSessionId", null)
                    return
                }

                val id = sessionIdCache ?: localShield.sessionId ?: ""
                result.success(id)
            }

            "getDeviceResult" -> {

                val localShield = shield

                if (localShield == null) {
                    result.error("100", "Initialize sdk before calling getDeviceResult", null)
                    return
                }

                try {
                    val latest = localShield.latestDeviceResult

                    result.success(latest?.toString())
                } catch (e: Throwable) {
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

            "isShieldInitialized" -> {
                result.success(shield != null)
            }

            else -> result.notImplemented()
        }
    }

    // ---------------- INIT ----------------

    private fun initShieldFraud(call: MethodCall, result: MethodChannel.Result) {
        if (shield != null) {
            result.success(null)
            return
        }

        val siteId = call.argument<String>("siteID")
        val key = call.argument<String>("key")

        if (siteId.isNullOrEmpty() || key.isNullOrEmpty()) {
            result.error("SHIELD_ERROR", "Missing siteID or key", null)
            return
        }

        try {

            val config = ShieldConfig(siteId, key).apply {
                environment = mapEnvironment(call.argument("environment"))
                logLevel = mapLogLevel(call.argument("logLevel"))
                needBackgroundListener =
                    call.argument<Boolean>("needBackgroundListener") == true
                blockScreenRecording =
                    call.argument<Boolean>("blockScreenRecording") == true
            }

            val registerCallback = call.argument<Boolean>("registerCallback") == true

            shield =
                if (registerCallback) {
                    ShieldFactory.createShieldWithCallback(application, config) {
                            sdkResult ->
                        pluginScope.launch {
                            when (sdkResult) {

                                is Result.Success -> {
                                    sessionIdCache = sdkResult.data.sessionId

                                    withContext(Dispatchers.Main) {
                                        channel.invokeMethod(
                                            "setDeviceResult",
                                            sdkResult.data.data.toString()
                                        )
                                    }
                                }

                                is Result.Failure -> {
                                    val err = shieldErrorToFlutterMap(sdkResult.error)

                                    withContext(Dispatchers.Main) {
                                        channel.invokeMethod("setDeviceResultError", err)
                                    }
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

            result.success(null)

        } catch (t: Throwable) {
            result.error("SHIELD_ERROR", t.message ?: "Init failed", null)
        }
    }

    // ---------------- FLOW LISTENER ----------------

    private fun startDeviceResultListener() {

        val localShield = shield ?: return

        pluginScope.launch {

            localShield.onDeviceResult().collect { res ->

                when (res) {

                    is Result.Success -> {

                        sessionIdCache = res.data.sessionId

                        withContext(Dispatchers.Main) {
                            channel.invokeMethod(
                                "setDeviceResult",
                                res.data.data.toString()
                            )
                        }
                    }

                    is Result.Failure -> {
                        val err = shieldErrorToFlutterMap(res.error)

                        withContext(Dispatchers.Main) {
                            channel.invokeMethod("setDeviceResultError", err)
                        }
                    }
                }
            }
        }
    }

    // ---------------- SEND ATTRIBUTES ----------------

    private fun sendAttributes(
        screenName: String,
        data: HashMap<String, String>,
        result: MethodChannel.Result
    ) {

        val localShield = shield ?: run {
            result.error("SHIELD_ERROR", "Shield not initialized", null)
            return
        }

        pluginScope.launch {
            try {
                val res = localShield.sendAttributes(screenName, data).first()

                when (res) {
                    is Result.Success<*> -> {
                        val sessionId = res.data as String
                        sessionIdCache = sessionId

                        withContext(Dispatchers.Main) {
                            result.success(sessionId)
                        }
                    }

                    is Result.Failure<*> -> {
                        withContext(Dispatchers.Main) {
                            result.error(
                                res.error.errorCode,
                                res.error.errorMessage ?: "Unknown error",
                                res.error.exception
                            )
                        }
                    }
                }
            } catch (e: Throwable) {
                withContext(Dispatchers.Main) {
                    result.error("SHIELD_ERROR", e.message, null)
                }
            }
        }
    }

    // ---------------- SIGNATURE ----------------

    private fun sendDeviceSignature(
        screenName: String,
        result: MethodChannel.Result
    ) {

        val localShield = shield ?: run {
            result.error("SHIELD_ERROR", "Shield not initialized", null)
            return
        }

        pluginScope.launch {
            try {
                val res = localShield.sendDeviceSignature(screenName).first()

                when (res) {
                    is Result.Success<*> -> {
                        val sessionId = res.data as String
                        sessionIdCache = sessionId

                        withContext(Dispatchers.Main) {
                            result.success(sessionId)
                        }
                    }

                    is Result.Failure<*> -> {
                        withContext(Dispatchers.Main) {
                            result.error(
                                res.error.errorCode,
                                res.error.errorMessage ?: "Signature failed",
                                res.error.exception
                            )
                        }
                    }
                }
            } catch (e: Throwable) {
                withContext(Dispatchers.Main) {
                    result.error("SHIELD_ERROR", e.message, null)
                }
            }
        }
    }

    // ---------------- HELPERS ----------------

    private fun setCrossPlatformParameters(name: String, version: String) {
        ShieldCrossPlatformHelper.setCrossPlatformParameters(
            ShieldCrossPlatformParams(name, version)
        )
    }

    private fun mapEnvironment(env: String?): Environment =
        when (env?.lowercase()) {
            "dev" -> Environment.DEV
            "staging" -> Environment.STAGING
            else -> Environment.PROD
        }

    private fun mapLogLevel(level: String?): LogLevel =
        when (level?.lowercase()) {
            "debug" -> LogLevel.DEBUG
            "info" -> LogLevel.INFO
            "verbose" -> LogLevel.VERBOSE
            else -> LogLevel.NONE
        }

    private fun shieldErrorToFlutterMap(error: com.shield.android.ShieldError): HashMap<String, Any?> {
        return hashMapOf(
            "code" to error.errorCode,
            "message" to error.errorMessage,
            "exception" to error.exception
        )
    }
}