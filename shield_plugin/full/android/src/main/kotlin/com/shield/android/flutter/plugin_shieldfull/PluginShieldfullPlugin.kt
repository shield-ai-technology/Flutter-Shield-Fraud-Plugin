package com.shield.android.flutter.plugin_shieldfull

import android.app.Activity
import android.os.Handler
import android.os.Looper
import androidx.annotation.NonNull
import com.shield.android.Shield
import com.shield.android.ShieldCallback
import com.shield.android.ShieldException
import com.shield.android.BlockedDialog

import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.MethodChannel.MethodCallHandler
import io.flutter.plugin.common.MethodChannel.Result
import org.json.JSONObject
import java.lang.IllegalStateException
import java.util.concurrent.atomic.AtomicBoolean


/** PluginShieldfraudPlugin */
class PluginShieldfullPlugin : FlutterPlugin, MethodCallHandler, ActivityAware {
    /// The MethodChannel that will the communication between Flutter and native Android
    ///
    /// This local reference serves to register the plugin with the Flutter Engine and unregister it
    /// when the Flutter Engine is detached from the Activity
    private lateinit var channel: MethodChannel
    private lateinit var binaryMessenger: BinaryMessenger
    private lateinit var activity: Activity

    override fun onAttachedToEngine(@NonNull flutterPluginBinding: FlutterPlugin.FlutterPluginBinding) {
        binaryMessenger = flutterPluginBinding.binaryMessenger
    }

    override fun onAttachedToActivity(binding: ActivityPluginBinding) {
        activity = binding.activity
        channel = MethodChannel(binaryMessenger, "plugin_shieldfraud")
        channel.setMethodCallHandler(this)
    }

    override fun onDetachedFromEngine(@NonNull binding: FlutterPlugin.FlutterPluginBinding) {
        channel.setMethodCallHandler(null)
    }

    override fun onMethodCall(@NonNull call: MethodCall, @NonNull result: Result) {
        when (call.method) {
            "initShieldFraud" -> {
                initShieldFraud(call)
            }
            "getSessionID" -> {
                try {
                    val sessionId = Shield.getInstance().sessionId;
                    result.success(sessionId)
                } catch (e: Exception) {
                    result.error("100", "Error getting session Id", null);
                }
            }
            "getDeviceResult" -> {
                getDeviceResult(result)
            }
            "sendAttributes" -> {
                val screenName: String = call.argument("screenName") ?: return
                val data: HashMap<String, String> = call.argument("attributes") ?: return
                sendAttributes(screenName, data, result)
            }
            "sendDeviceSignature" -> {
                val screenName: String = call.argument("screenName") ?: return
                sendDeviceSignature(screenName, result)
            }
            "isShieldInitialized" -> {
                val isShieldInitialized = isShieldInitialized();
                result.success(isShieldInitialized)
            }
            else -> {
                result.notImplemented()
            }
        }
    }


    private fun isShieldInitialized(): Boolean {
        return try {
            Shield.getInstance() != null
        } catch (exception: IllegalStateException) {
            //Shield is not initialized yet.
            false
        }
    }

    private fun initShieldFraud(call: MethodCall) {
        if (isShieldInitialized()) {
            return
        }

        val siteID: String = call.argument("siteID") ?: return
        val secretKey: String = call.argument("key") ?: return
        val builder = Shield.Builder(activity, siteID, secretKey)
        call.argument<Boolean>("enableMocking")?.let {
            if (it) builder.enableMocking()
        }
        call.argument<Boolean>("enableBackgroundListener")?.let {
            if (it) builder.enableBackgroundListener()
        }
        call.argument<String>("partnerId")?.let {
            if (it.isNotEmpty()) builder.setPartnerId(it)
        }

        call.argument<HashMap<String, String>>("defaultBlockedDialog")?.let {
            if (it != null)
            builder.setAutoBlockDialog(BlockedDialog(it["title"], it["body"]))
        }

        call.argument<Boolean>("registerCallback")?.let {
            if (it) {
                builder.registerDeviceShieldCallback(object : ShieldCallback<JSONObject> {
                    override fun onSuccess(p0: JSONObject?) {
                        Handler(Looper.getMainLooper()).post {
                            channel.invokeMethod("setDeviceResult", p0?.toString())
                        }
                    }

                    override fun onFailure(p0: ShieldException?) {
                        val error = hashMapOf<String, Any>()
                        error["message"] = p0?.message?:""
                        error["code"] = p0?.code?:0
                        Handler(Looper.getMainLooper()).post {
                            channel.invokeMethod("setDeviceResultError", error)
                        }
                    }

                })
            }
        }

        call.argument<String>("environment")?.let {
            if (it == "dev") {
                builder.setEnvironment(Shield.ENVIRONMENT_DEV)
            } else {
                builder.setEnvironment(Shield.ENVIRONMENT_PROD)
            }
        }

        call.argument<String>("logLevel")?.let {
            when (it) {
                "debug" -> builder.setLogLevel(Shield.LogLevel.DEBUG)
                "info" -> builder.setLogLevel(Shield.LogLevel.INFO)
                "verbose" -> builder.setLogLevel(Shield.LogLevel.VERBOSE)
                else -> {
                    builder.setLogLevel(Shield.LogLevel.NONE)
                }
            }
        }
        Shield.setSingletonInstance(builder.build())
    }

    private fun getDeviceResult(@NonNull result: Result) {
        var isDeviceResultCalled = AtomicBoolean(false)
        Shield.getInstance().setDeviceResultStateListener {
            if (!isDeviceResultCalled.getAndSet(true)) {
                val deviceResult = Shield.getInstance().latestDeviceResult
                if (deviceResult != null) {
                    Handler(Looper.getMainLooper()).post {
                        result.success(deviceResult.toString())
                    }
                } else {
                    val error = Shield.getInstance().responseError
                    Handler(Looper.getMainLooper()).post {
                        result.error(
                            error?.code?.toString() ?: "0",
                            error?.localizedMessage ?: "Unknown error",
                            null
                        )
                    }
                }
            }
        }
    }

    private fun sendAttributes(
        screenName: String,
        data: HashMap<String, String>,
        @NonNull result: Result
    ) {
        Shield.getInstance().sendAttributes(screenName, data, object : ShieldCallback<Boolean> {
            override fun onSuccess(p0: Boolean?) {
                result.success(p0 ?: false)
            }

            override fun onFailure(p0: ShieldException?) {
                result.error(
                    p0?.code?.toString()?:"0",
                    p0?.localizedMessage ?: "failed to send attributes",
                    null
                )
            }
        })
    }

    private fun sendDeviceSignature(
        screenName: String,
        @NonNull result: Result
    ) {
        try {
            Shield.getInstance().sendDeviceSignature(
                screenName
            ) {
                result.success(true)
            }
        } catch (e: Exception) {
            result.error("0", e.localizedMessage ?: "failed to send device signature", null)
        }
    }

    override fun onDetachedFromActivityForConfigChanges() {

    }

    override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) {

    }

    override fun onDetachedFromActivity() {

    }
}
