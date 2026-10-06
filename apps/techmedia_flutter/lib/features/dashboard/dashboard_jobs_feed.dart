import 'dart:async';

import 'package:flutter/widgets.dart';

import '../../core/api/techmedia_api.dart';

/// Keeps the Home and Jobs screens on the same fresh CRM snapshot.
///
/// This is view state only. CRM remains the source of truth and all mutations
/// still go through the platform API.
class DashboardJobsFeed extends ChangeNotifier with WidgetsBindingObserver {
  DashboardJobsFeed({required this.api, required this.session}) {
    WidgetsBinding.instance.addObserver(this);
  }

  static const _refreshInterval = Duration(seconds: 12);

  final TechMediaApi api;
  final UserSession session;
  final List<CrmJob> _jobs = [];
  Timer? _timer;
  bool _isLoading = true;
  bool _isRefreshing = false;
  String? _error;

  List<CrmJob> get jobs => List.unmodifiable(_jobs);
  bool get isLoading => _isLoading;
  String? get error => _error;

  void start() {
    _startPolling();
    unawaited(refresh());
  }

  Future<void> refresh() async {
    if (_isRefreshing) return;
    _isRefreshing = true;
    try {
      final updated = await api.assignedJobs(session.accessToken);
      _jobs
        ..clear()
        ..addAll(updated);
      _error = null;
    } on Object catch (error) {
      _error = error is TechMediaApiException
          ? error.message
          : 'Could not refresh live dashboard data.';
    } finally {
      _isLoading = false;
      _isRefreshing = false;
      notifyListeners();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _startPolling();
      unawaited(refresh());
      return;
    }
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      _timer?.cancel();
      _timer = null;
    }
  }

  void _startPolling() {
    _timer ??= Timer.periodic(_refreshInterval, (_) => unawaited(refresh()));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }
}
