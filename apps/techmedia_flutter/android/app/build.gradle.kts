plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val appBrandName = providers.environmentVariable("APP_BRAND_NAME")
    .orNull ?: error("APP_BRAND_NAME must be set in the root .env file.")

val appApplicationId = providers.environmentVariable("ANDROID_APPLICATION_ID")
    .orNull ?: error("ANDROID_APPLICATION_ID must be set in the root .env file.")

val appAndroidBrandAsset = providers.environmentVariable("MOBILE_ANDROID_BRAND_ASSET")
    .orNull ?: error("MOBILE_ANDROID_BRAND_ASSET must be set in the root .env file.")

require(appAndroidBrandAsset.matches(Regex("[a-z][a-z0-9_]*"))) {
    "MOBILE_ANDROID_BRAND_ASSET must be a lowercase Android resource profile name."
}

android {
    namespace = "in.techmedia.techmedia_flutter"
    compileSdk = flutter.compileSdkVersion
    // Use the Android NDK already provisioned on this workstation. This avoids
    // an SDK Manager download during local emulator builds.
    ndkVersion = "28.2.13676358"

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    buildFeatures {
        resValues = true
    }

    sourceSets {
        getByName("main").res.srcDir("src/main/branding/$appAndroidBrandAsset/res")
    }

    defaultConfig {
        applicationId = appApplicationId
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        resValue("string", "app_name", appBrandName)
        resValue("string", "mobile_channel_prefix", appApplicationId)
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
    implementation("androidx.biometric:biometric:1.1.0")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("com.google.code.findbugs:jsr305:3.0.2")
    implementation("com.google.errorprone:error_prone_annotations:2.28.0")
    implementation("com.google.android.gms:play-services-mlkit-document-scanner:16.0.0")
}
