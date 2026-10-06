class AppConfig {
  const AppConfig._();

  static const brandName = String.fromEnvironment('APP_BRAND');

  static const appVersion = String.fromEnvironment('APP_VERSION');

  static const apiUrl = String.fromEnvironment('API_URL');

  static const releaseManifestUrl = String.fromEnvironment(
    'RELEASE_MANIFEST_URL',
  );

  static const nativeChannelPrefix = String.fromEnvironment(
    'NATIVE_CHANNEL_PREFIX',
  );

  static const releaseFilePrefix = String.fromEnvironment(
    'RELEASE_FILE_PREFIX',
  );

  static const logoAsset = String.fromEnvironment('APP_LOGO_ASSET');
}
