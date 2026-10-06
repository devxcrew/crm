import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

import '../config/app_config.dart';

class AppUpdateService {
  AppUpdateService({http.Client? client, MethodChannel? channel})
    : _client = client ?? http.Client(),
      _channel = channel ?? MethodChannel(_channelName);

  static final _channelName = '${AppConfig.nativeChannelPrefix}/app-update';

  final http.Client _client;
  final MethodChannel _channel;

  Future<AppRelease?> checkForUpdate() async {
    if (!Platform.isAndroid) return null;

    final response = await _client
        .get(Uri.parse(AppConfig.releaseManifestUrl))
        .timeout(const Duration(seconds: 10));
    if (response.statusCode == HttpStatus.notFound) return null;
    if (response.statusCode != HttpStatus.ok) {
      throw AppUpdateException('Unable to check for app updates.');
    }

    final release = _releaseFromResponse(response.body);
    return isNewerVersion(release.versionName, AppConfig.appVersion)
        ? release
        : null;
  }

  AppRelease _releaseFromResponse(String body) {
    try {
      final value = jsonDecode(body);
      if (value is! Map<String, dynamic>) {
        throw const AppUpdateException('The update information is invalid.');
      }
      return AppRelease.fromJson(value);
    } on FormatException {
      throw const AppUpdateException('The update information is invalid.');
    }
  }

  Future<void> downloadAndInstall(AppRelease release) async {
    final response = await _client.send(
      http.Request('GET', Uri.parse(release.apkUrl)),
    );
    if (response.statusCode != HttpStatus.ok) {
      throw AppUpdateException('The update download is not available.');
    }

    final directory = await _channel.invokeMethod<String>('updateDirectory');
    if (directory == null || directory.isEmpty) {
      throw AppUpdateException('Unable to prepare the app update.');
    }

    final file = File(
      '$directory${Platform.pathSeparator}${AppConfig.releaseFilePrefix}-${release.versionName}.apk',
    );
    final sink = file.openWrite();
    await response.stream.pipe(sink);

    final checksum = await file.openRead().transform(sha256).first;
    if (checksum.toString().toLowerCase() != release.sha256.toLowerCase()) {
      await file.delete();
      throw AppUpdateException(
        'The update file did not pass its security check.',
      );
    }

    final canInstall =
        await _channel.invokeMethod<bool>('canInstallPackages') ?? false;
    if (!canInstall) {
      await _channel.invokeMethod<void>('openInstallPermission');
      throw AppUpdatePermissionRequired();
    }
    await _channel.invokeMethod<void>('installApk', {'path': file.path});
  }
}

class AppRelease {
  const AppRelease({
    required this.versionName,
    required this.versionCode,
    required this.apkUrl,
    required this.sha256,
    required this.mandatory,
    required this.notes,
  });

  final String versionName;
  final int versionCode;
  final String apkUrl;
  final String sha256;
  final bool mandatory;
  final String notes;

  factory AppRelease.fromJson(Map<String, dynamic> json) {
    final versionName = json['versionName'];
    final versionCode = json['versionCode'];
    final apkUrl = json['apkUrl'];
    final sha256Value = json['sha256'];
    if (versionName is! String ||
        versionCode is! int ||
        apkUrl is! String ||
        sha256Value is! String ||
        !RegExp(r'^[a-fA-F0-9]{64}$').hasMatch(sha256Value)) {
      throw AppUpdateException('The update information is invalid.');
    }
    return AppRelease(
      versionName: versionName,
      versionCode: versionCode,
      apkUrl: apkUrl,
      sha256: sha256Value,
      mandatory: json['mandatory'] == true,
      notes: json['notes'] is String ? json['notes'] as String : '',
    );
  }
}

class AppUpdateException implements Exception {
  const AppUpdateException(this.message);

  final String message;
}

class AppUpdatePermissionRequired implements Exception {}

bool isNewerVersion(String candidate, String current) {
  final candidateParts = _versionParts(candidate);
  final currentParts = _versionParts(current);
  for (var index = 0; index < 3; index++) {
    if (candidateParts[index] != currentParts[index]) {
      return candidateParts[index] > currentParts[index];
    }
  }
  return false;
}

List<int> _versionParts(String value) {
  final match = RegExp(r'^(\d+)\.(\d+)\.(\d+)$').firstMatch(value);
  if (match == null) throw AppUpdateException('The update version is invalid.');
  return [
    int.parse(match.group(1)!),
    int.parse(match.group(2)!),
    int.parse(match.group(3)!),
  ];
}
