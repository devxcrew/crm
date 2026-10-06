import 'dart:convert';

import '../../core/auth/secure_session_store.dart';

class CallLogNote {
  const CallLogNote({
    required this.id,
    required this.mobile,
    required this.content,
    required this.createdAt,
  });

  final String id;
  final String mobile;
  final String content;
  final DateTime createdAt;

  Map<String, String> toJson() => {
    'id': id,
    'mobile': mobile,
    'content': content,
    'createdAt': createdAt.toUtc().toIso8601String(),
  };

  static CallLogNote? fromJson(Object? value) {
    if (value is! Map<Object?, Object?>) return null;
    final id = value['id'];
    final mobile = value['mobile'];
    final content = value['content'];
    final createdAt = value['createdAt'];
    if (id is! String ||
        mobile is! String ||
        content is! String ||
        createdAt is! String) {
      return null;
    }
    final parsed = DateTime.tryParse(createdAt);
    if (id.isEmpty ||
        mobile.isEmpty ||
        content.trim().isEmpty ||
        parsed == null)
      return null;
    return CallLogNote(
      id: id,
      mobile: mobile,
      content: content,
      createdAt: parsed.toLocal(),
    );
  }
}

/// Device-only rough notes. CRM remains untouched until a note is converted.
class CallLogNoteStore {
  CallLogNoteStore(this._sessionStore, {required String accountEmail})
    : _storageKey = 'call_log_notes_${accountEmail.trim().toLowerCase()}';

  final SecureSessionStore _sessionStore;
  final String _storageKey;

  Future<List<CallLogNote>> read(String mobile) async {
    final raw = await _sessionStore.readDeviceValue(_storageKey);
    if (raw == null) return const [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List<Object?>) return const [];
      return decoded
          .map(CallLogNote.fromJson)
          .whereType<CallLogNote>()
          .where((note) => note.mobile == mobile)
          .toList()
        ..sort((left, right) => right.createdAt.compareTo(left.createdAt));
    } on FormatException {
      return const [];
    }
  }

  Future<void> save(CallLogNote note) async {
    final existing = await _readAll();
    existing.removeWhere((entry) => entry.id == note.id);
    existing.add(note);
    await _writeAll(existing);
  }

  Future<void> remove(String id) async {
    final existing = await _readAll();
    existing.removeWhere((entry) => entry.id == id);
    await _writeAll(existing);
  }

  Future<List<CallLogNote>> _readAll() async {
    final raw = await _sessionStore.readDeviceValue(_storageKey);
    if (raw == null) return [];
    try {
      final decoded = jsonDecode(raw);
      return decoded is List<Object?>
          ? decoded.map(CallLogNote.fromJson).whereType<CallLogNote>().toList()
          : [];
    } on FormatException {
      return [];
    }
  }

  Future<void> _writeAll(List<CallLogNote> notes) {
    if (notes.isEmpty) return _sessionStore.deleteDeviceValue(_storageKey);
    return _sessionStore.writeDeviceValue(
      _storageKey,
      jsonEncode(notes.map((note) => note.toJson()).toList()),
    );
  }
}
