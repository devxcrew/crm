import 'dart:async';

import 'package:flutter/widgets.dart';

import 'job_start_store.dart';

class JobStartCountdown extends ChangeNotifier with WidgetsBindingObserver {
  JobStartCountdown._() {
    WidgetsBinding.instance.addObserver(this);
  }

  static final instance = JobStartCountdown._();
  static const delay = Duration(seconds: 90);

  final Map<String, _PendingJobStart> _pending = {};
  JobStartStore? _store;
  var _restored = false;

  Iterable<String> get pendingJobIds => _pending.keys;

  bool isPending(String jobId) => _pending.containsKey(jobId);

  bool isCancellable(String jobId) => _pending[jobId]?.isStarting == false;

  Future<void> restore({
    required JobStartStore store,
    required Future<void> Function(String jobId) onElapsed,
  }) async {
    _store = store;
    if (_restored) return;
    _restored = true;
    final starts = await store.read();
    for (final start in starts) {
      if (isPending(start.jobId)) continue;
      _pending[start.jobId] = _PendingJobStart(
        deadline: start.deadline,
        onElapsed: () => onElapsed(start.jobId),
      );
      _schedule(start.jobId);
    }
    notifyListeners();
    for (final jobId in _pending.keys.toList()) {
      unawaited(_tick(jobId));
    }
  }

  String label(String jobId) {
    final pending = _pending[jobId];
    if (pending == null) return '';
    if (pending.isStarting) return '…';
    final seconds = delay.inSeconds - remaining(jobId).inSeconds;
    return _elapsedLabel(seconds < 0 ? 0 : seconds);
  }

  Duration remaining(String jobId) {
    final pending = _pending[jobId];
    if (pending == null) return Duration.zero;
    final difference = pending.deadline.difference(DateTime.now());
    return difference.isNegative ? Duration.zero : difference;
  }

  bool start({
    required String jobId,
    required Future<void> Function() onElapsed,
  }) {
    if (isPending(jobId)) return false;
    final pending = _PendingJobStart(
      deadline: DateTime.now().add(delay),
      onElapsed: onElapsed,
    );
    _pending[jobId] = pending;
    _schedule(jobId);
    unawaited(_persist());
    notifyListeners();
    return true;
  }

  void cancel(String jobId) {
    final pending = _pending[jobId];
    if (pending == null || pending.isStarting) return;
    pending.timer?.cancel();
    _pending.remove(jobId);
    unawaited(_persist());
    notifyListeners();
  }

  void _schedule(String jobId) {
    final pending = _pending[jobId];
    if (pending == null) return;
    pending.timer = Timer.periodic(
      const Duration(seconds: 1),
      (_) => _tick(jobId),
    );
  }

  Future<void> _persist() async {
    final store = _store;
    if (store == null) return;
    await store.write(
      _pending.entries
          .where((entry) => !entry.value.isStarting)
          .map(
            (entry) => PersistedJobStart(
              jobId: entry.key,
              deadline: entry.value.deadline,
            ),
          ),
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    for (final jobId in _pending.keys.toList()) {
      _tick(jobId);
    }
  }

  Future<void> _tick(String jobId) async {
    final pending = _pending[jobId];
    if (pending == null) return;
    if (DateTime.now().isBefore(pending.deadline)) {
      notifyListeners();
      return;
    }
    if (pending.isStarting) return;
    pending.isStarting = true;
    pending.timer?.cancel();
    notifyListeners();
    try {
      await pending.onElapsed();
    } finally {
      _pending.remove(jobId);
      await _persist();
      notifyListeners();
    }
  }
}

String _elapsedLabel(int seconds) {
  if (seconds < 60) return '$seconds sec';
  final minutes = seconds ~/ 60;
  final remainder = seconds % 60;
  return remainder == 0 ? '$minutes min' : '$minutes min $remainder sec';
}

class _PendingJobStart {
  _PendingJobStart({required this.deadline, required this.onElapsed});

  final DateTime deadline;
  final Future<void> Function() onElapsed;
  Timer? timer;
  var isStarting = false;
}
