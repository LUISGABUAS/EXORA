package com.exora.finance.app

import android.app.Activity
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AppMinimizerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AppMinimizer"

    @ReactMethod
    fun minimize() {
        val activity: Activity? = currentActivity
        activity?.moveTaskToBack(true)
    }
}
