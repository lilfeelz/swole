plugins {
    id("com.android.application")
}

android {
    namespace = "org.lilfeelz.swole"
    compileSdk = 36

    defaultConfig {
        applicationId = "org.lilfeelz.swole"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.activity:activity:1.13.0")
    implementation("androidx.webkit:webkit:1.12.1")
}
