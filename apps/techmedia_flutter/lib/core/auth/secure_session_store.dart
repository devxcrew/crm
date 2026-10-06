import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';

import '../config/app_config.dart';

class SecureSessionStore {
  SecureSessionStore({MethodChannel? channel})
    : _channel =
          channel ??
          MethodChannel('${AppConfig.nativeChannelPrefix}/secure-session');

  static const inactivityLimit = Duration(days: 10);
  static const _tokenKey = 'access_token';
  static const _pinSaltKey = 'pin_salt';
  static const _pinHashKey = 'pin_hash';
  static const _biometricKey = 'biometric_enabled';
  static const _emailKey = 'last_email';
  static const _lastActivityAtKey = 'last_activity_at';
  static const _legacyAuthenticatedAtKey = 'full_auth_at';

  final MethodChannel _channel;

  Future<StoredSession?> readSession() async {
    final token = await _read(_tokenKey);
    final pinHash = await _read(_pinHashKey);
    final lastActivityAt = DateTime.tryParse(
      await _read(_lastActivityAtKey) ??
          await _read(_legacyAuthenticatedAtKey) ??
          '',
    );
    if (token == null || pinHash == null || lastActivityAt == null) return null;
    return StoredSession(
      accessToken: token,
      email: await _read(_emailKey) ?? '',
      lastActivityAt: lastActivityAt,
      biometricEnabled: await _read(_biometricKey) == 'true',
    );
  }

  Future<String?> lastEmail() => _read(_emailKey);

  Future<bool> hasPin() async => await _read(_pinHashKey) != null;

  Future<void> saveLogin({
    required String email,
    required String accessToken,
  }) async {
    await Future.wait([
      _write(_tokenKey, accessToken),
      _write(_emailKey, email),
      touchActivity(),
    ]);
  }

  Future<void> touchActivity() {
    return _write(_lastActivityAtKey, DateTime.now().toUtc().toIso8601String());
  }

  Future<void> setPin(String pin, {required bool useBiometric}) async {
    if (!RegExp(r'^\d{4}$').hasMatch(pin)) {
      throw ArgumentError.value(
        pin,
        'pin',
        'PIN must contain exactly 4 digits',
      );
    }
    final salt = _randomSalt();
    await Future.wait([
      _write(_pinSaltKey, salt),
      _write(_pinHashKey, _pinHash(pin, salt)),
      _write(_biometricKey, useBiometric.toString()),
    ]);
  }

  Future<bool> verifyPin(String pin) async {
    if (!RegExp(r'^\d{4}$').hasMatch(pin)) return false;
    final salt = await _read(_pinSaltKey);
    final expected = await _read(_pinHashKey);
    if (salt == null || expected == null) return false;
    return _constantTimeEquals(_pinHash(pin, salt), expected);
  }

  Future<bool> canUseBiometrics() async {
    return await _channel.invokeMethod<bool>('canUseBiometrics') ?? false;
  }

  Future<bool> authenticateBiometric() async {
    return await _channel.invokeMethod<bool>('authenticateBiometric') ?? false;
  }

  /// Stores device-only UI state in the encrypted Android session store.
  ///
  /// CRM records remain in Frappe; callers must not use this for business data.
  Future<String?> readDeviceValue(String key) => _read(key);

  Future<void> writeDeviceValue(String key, String value) => _write(key, value);

  Future<void> deleteDeviceValue(String key) => _delete(key);

  Future<void> clearSession({bool forgetAccount = false}) async {
    await Future.wait([
      _delete(_tokenKey),
      _delete(_lastActivityAtKey),
      _delete(_legacyAuthenticatedAtKey),
    ]);
    if (forgetAccount) {
      await Future.wait([
        _delete(_pinSaltKey),
        _delete(_pinHashKey),
        _delete(_biometricKey),
        _delete(_emailKey),
      ]);
    }
  }

  bool isActive(StoredSession session) {
    return DateTime.now().toUtc().difference(session.lastActivityAt) <
        inactivityLimit;
  }

  Future<String?> _read(String key) =>
      _channel.invokeMethod<String>('read', {'key': key});

  Future<void> _write(String key, String value) =>
      _channel.invokeMethod<void>('write', {'key': key, 'value': value});

  Future<void> _delete(String key) =>
      _channel.invokeMethod<void>('delete', {'key': key});

  String _randomSalt() {
    final random = Random.secure();
    return base64UrlEncode(List.generate(32, (_) => random.nextInt(256)));
  }

  String _pinHash(String pin, String salt) {
    var digest = sha256.convert(utf8.encode('$salt:$pin')).bytes;
    for (var round = 0; round < 20000; round++) {
      digest = sha256.convert([...digest, ...utf8.encode(salt)]).bytes;
    }
    return base64UrlEncode(digest);
  }

  bool _constantTimeEquals(String left, String right) {
    if (left.length != right.length) return false;
    var difference = 0;
    for (var index = 0; index < left.length; index++) {
      difference |= left.codeUnitAt(index) ^ right.codeUnitAt(index);
    }
    return difference == 0;
  }
}

class StoredSession {
  const StoredSession({
    required this.accessToken,
    required this.email,
    required this.lastActivityAt,
    required this.biometricEnabled,
  });

  final String accessToken;
  final String email;
  final DateTime lastActivityAt;
  final bool biometricEnabled;
}
