# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Readable Crashlytics stack traces (file names + line numbers, custom exceptions)
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception

# React Native 0.81: native code looks these up by name (JNI), which R8 can't see.
# e.g. InspectorFlags -> libreact_devsupportjni loads CxxInspectorPackagerConnection.
-keep class com.facebook.react.devsupport.** { *; }
-keep class com.facebook.jni.** { *; }

# Stallion OTA: keep the SDK (bundle switching, JSON config/meta) intact under R8.
-keep class com.stallion.** { *; }

# react-native-pdf: pdfium calls back into Java from native code, and PdfView
# serialises the table of contents (PdfDocument.Bookmark) with Gson by field name.
-keep class io.legere.pdfiumandroid.** { *; }
-keep class com.shockwave.pdfium.** { *; }
-keep class com.github.barteksc.pdfviewer.** { *; }

# AppsFlyer SDK + Play Install Referrer
-keep class com.appsflyer.** { *; }
-keep public class com.android.installreferrer.** { *; }
-dontwarn com.appsflyer.**

# PayU CheckoutPro: keep the SDK under R8, and ignore the optional Google Pay
# (paisa) and Smart Lock credentials APIs it references but doesn't ship.
-keep class com.payu.** { *; }
-dontwarn com.payu.**
-dontwarn com.google.android.apps.nbu.paisa.inapp.client.api.**
-dontwarn com.google.android.gms.auth.api.credentials.**
