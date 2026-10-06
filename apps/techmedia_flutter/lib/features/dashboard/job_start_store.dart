import 'dart:convert';

import '../../core/auth/secure_session_store.dart';

class PersistedJobStart {
  const PersistedJobStart({required this.jobId, required this.deadline});

  final String jobId;
  final DateTime deadline;

  Map<String, String> toJson() => {
    'jobId': jobId,
    'deadline': deadline.toUtc().toIso8601String(),
  };

  static PersistedJobStart? fromJson(Object? value) {
    if (value is! Map<Object?, Object?>) return null;
    final jobId = value['jobId'];
    final deadline = value['deadline'];
    if (jobId is! String || deadline is! String || jobId.trim().isEmpty) {
      return null;
    }
    final parsedDeadline = DateTime.tryParse(deadline);
    if (parsedDeadline == null) return null;
    return PersistedJobStart(jobId: jobId, deadline: parsedDeadline.toLocal());
  }
}

/// Persists only a pending start deadline, never a CRM record or job execution.
class JobStartStore {
  JobStartStore(this._sessionStore);

  static const _storageKey = 'pending_job_start_countdowns';

  final SecureSessionStore _sessionStore;

  Future<List<PersistedJobStart>> read() async {
    final raw = await _sessionStore.readDeviceValue(_storageKey);
    if (raw == null) return const [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List<Object?>) return const [];
      return decoded
          .map(PersistedJobStart.fromJson)
          .whereType<PersistedJobStart>()
          .toList(growable: false);
    } on FormatException {
      return const [];
    }
  }

  Future<void> write(Iterable<PersistedJobStart> starts) async {
    final values = starts
        .map((start) => start.toJson())
        .toList(growable: false);
    if (values.isEmpty) {
      await _sessionStore.deleteDeviceValue(_storageKey);
      return;
    }
    await _sessionStore.writeDeviceValue(_storageKey, jsonEncode(values));
  }
}
