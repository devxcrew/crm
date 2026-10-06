import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/techmedia_api.dart';
import '../../core/platform/mobile_actions.dart';
import 'home_enquiry_form_page.dart';
import 'call_log_notes_page.dart';

class AdminCallLogPage extends StatefulWidget {
  const AdminCallLogPage({required this.api, required this.session, super.key});

  final TechMediaApi api;
  final UserSession session;

  @override
  State<AdminCallLogPage> createState() => _AdminCallLogPageState();
}

class _AdminCallLogPageState extends State<AdminCallLogPage> {
  Future<List<CallLogEntry>>? _calls;
  var _filter = _CallFilter.all;
  var _query = '';
  var _checkingSavedAccess = true;

  @override
  void initState() {
    super.initState();
    _restoreSavedAccess();
  }

  @override
  Widget build(BuildContext context) {
    final callsRequest = _calls;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Call Logs'),
        actions: [
          _CallLogFilterMenu(
            filter: _filter,
            onSelected: (filter) => setState(() => _filter = filter),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: _checkingSavedAccess
          ? const Center(child: CircularProgressIndicator())
          : callsRequest == null
          ? _CallLogDisclosure(onContinue: _requestAccess)
          : FutureBuilder<List<CallLogEntry>>(
              future: callsRequest,
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return _PermissionState(
                    message: _callLogErrorMessage(snapshot.error),
                    onRetry: _requestAccess,
                    onOpenSettings: MobileActions.openAppSettings,
                  );
                }
                if (!snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                final calls = snapshot.data!
                    .where(_filter.includes)
                    .where(_matchesSearch)
                    .toList();
                return RefreshIndicator(
                  onRefresh: _reload,
                  child: CustomScrollView(
                    slivers: [
                      SliverToBoxAdapter(
                        child: _CallLogControls(
                          onSearchChanged: (value) => setState(
                            () => _query = value.trim().toLowerCase(),
                          ),
                        ),
                      ),
                      if (calls.isEmpty)
                        const SliverFillRemaining(
                          hasScrollBody: false,
                          child: Center(child: Text('No matching calls.')),
                        )
                      else
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(14, 8, 14, 28),
                          sliver: SliverList.separated(
                            itemCount: calls.length,
                            separatorBuilder: (context, index) =>
                                const SizedBox(height: 10),
                            itemBuilder: (context, index) => _CallLogCard(
                              entry: calls[index],
                              onOpen: () => _openComments(calls[index]),
                              onCreateEnquiry:
                                  isCallLogAdministrator(
                                    widget.session.profile.role,
                                  )
                                  ? () => _openEnquiryForm(calls[index])
                                  : null,
                              onCall: () =>
                                  MobileActions.call(calls[index].number),
                            ),
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
    );
  }

  Future<void> _requestAccess() async {
    setState(() => _calls = _loadCalls());
  }

  Future<void> _restoreSavedAccess() async {
    final hasAccess = await MobileActions.hasCallLogAccess();
    if (!mounted) return;
    setState(() {
      _checkingSavedAccess = false;
      if (hasAccess) _calls = _loadCalls();
    });
  }

  Future<List<CallLogEntry>> _loadCalls() async {
    final rows = await MobileActions.callLogs();
    return rows.map(CallLogEntry.fromPlatform).toList();
  }

  Future<void> _reload() async {
    setState(() => _calls = _loadCalls());
    await _calls!;
  }

  bool _matchesSearch(CallLogEntry entry) {
    if (_query.isEmpty) return true;
    return entry.name.toLowerCase().contains(_query) ||
        entry.number.toLowerCase().contains(_query);
  }

  Future<void> _openComments(CallLogEntry entry) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) => CallLogNotesPage(
          api: widget.api,
          session: widget.session,
          entry: entry,
        ),
      ),
    );
  }

  Future<void> _openEnquiryForm(CallLogEntry entry) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) => HomeEnquiryFormPage(
          api: widget.api,
          session: widget.session,
          initialMobile: entry.mobile,
        ),
      ),
    );
  }
}

class _CallLogControls extends StatelessWidget {
  const _CallLogControls({required this.onSearchChanged});

  final ValueChanged<String> onSearchChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 6),
      child: Column(
        children: [
          SearchBar(
            hintText: 'Search name or number',
            leading: const Icon(Icons.search),
            onChanged: onSearchChanged,
          ),
        ],
      ),
    );
  }
}

class _CallLogFilterMenu extends StatelessWidget {
  const _CallLogFilterMenu({
    required this.filter,
    required this.onSelected,
  });

  final _CallFilter filter;
  final ValueChanged<_CallFilter> onSelected;

  @override
  Widget build(BuildContext context) => PopupMenuButton<_CallFilter>(
    tooltip: 'Filter calls: ${filter.menuLabel}',
    icon: Icon(
      filter == _CallFilter.all
          ? Icons.filter_list_rounded
          : Icons.filter_alt_rounded,
    ),
    onSelected: onSelected,
    itemBuilder: (context) => _CallFilter.values
        .map(
          (item) => CheckedPopupMenuItem<_CallFilter>(
            value: item,
            checked: item == filter,
            child: Text(item.menuLabel),
          ),
        )
        .toList(),
  );
}

class _CallLogCard extends StatelessWidget {
  const _CallLogCard({
    required this.entry,
    required this.onOpen,
    required this.onCreateEnquiry,
    required this.onCall,
  });

  final CallLogEntry entry;
  final VoidCallback onOpen;
  final VoidCallback? onCreateEnquiry;
  final VoidCallback onCall;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      color: Colors.white,
      elevation: 1,
      shadowColor: const Color(0x24251B2A),
      surfaceTintColor: Colors.transparent,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFD3CBD7), width: 1.2),
      ),
      child: InkWell(
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 10, 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: entry.color.withValues(alpha: 0.13),
                foregroundColor: entry.color,
                child: Icon(entry.icon, size: 21),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.contactTitle,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 2),
                    if (entry.hasSavedName) Text(entry.number),
                    const SizedBox(height: 5),
                    Row(
                      children: [
                        Text(entry.displayTime),
                        const SizedBox(width: 8),
                        _DurationBadge(label: entry.durationLabel),
                      ],
                    ),
                  ],
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (onCreateEnquiry case final onCreateEnquiry?)
                    _CallLogActionButton(
                      tooltip: 'Create enquiry for ${entry.displayName}',
                      onTap: onCreateEnquiry,
                      icon: Icons.add_rounded,
                    ),
                  if (onCreateEnquiry != null) const SizedBox(width: 4),
                  _CallLogActionButton(
                    tooltip: 'Call ${entry.displayName}',
                    onTap: onCall,
                    icon: Icons.call_rounded,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CallLogActionButton extends StatelessWidget {
  const _CallLogActionButton({
    required this.tooltip,
    required this.onTap,
    required this.icon,
  });

  final String tooltip;
  final VoidCallback onTap;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Tooltip(
    message: tooltip,
    child: IconButton.filledTonal(
      onPressed: onTap,
      icon: Icon(icon),
      style: IconButton.styleFrom(
        fixedSize: const Size.square(40),
        minimumSize: const Size.square(40),
        padding: EdgeInsets.zero,
        shape: const CircleBorder(),
      ),
    ),
  );
}

class _DurationBadge extends StatelessWidget {
  const _DurationBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: const Color(0xFFF1EDF4),
      borderRadius: BorderRadius.circular(9),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      child: Text(label, style: Theme.of(context).textTheme.labelSmall),
    ),
  );
}

class _CallLogDisclosure extends StatelessWidget {
  const _CallLogDisclosure({required this.onContinue});

  final Future<void> Function() onContinue;

  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircleAvatar(
            radius: 34,
            child: Icon(Icons.manage_history_rounded, size: 34),
          ),
          const SizedBox(height: 18),
          Text(
            'Use device call history',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 10),
          const Text(
            'CRM reads recent call numbers, direction, time, and duration so an administrator can register a selected call against a CRM enquiry.',
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          const Text(
            'The app does not upload call history automatically. It posts one enquiry only after an administrator completes the form.',
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: onContinue,
            icon: const Icon(Icons.lock_open_rounded),
            label: const Text('Allow call history access'),
          ),
          const SizedBox(height: 10),
          const Text(
            'You can revoke access in Android Settings.',
            textAlign: TextAlign.center,
          ),
        ],
      ),
    ),
  );
}

class _PermissionState extends StatelessWidget {
  const _PermissionState({
    required this.message,
    required this.onRetry,
    required this.onOpenSettings,
  });

  final String message;
  final Future<void> Function() onRetry;
  final Future<bool> Function() onOpenSettings;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.call_outlined, size: 42),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 14),
          FilledButton.tonal(
            onPressed: onRetry,
            child: const Text('Request again'),
          ),
          TextButton(
            onPressed: onOpenSettings,
            child: const Text('Open Android Settings'),
          ),
        ],
      ),
    ),
  );
}

class CallLogEntry {
  const CallLogEntry({
    required this.name,
    required this.number,
    required this.type,
    required this.timestamp,
    required this.durationSeconds,
  });

  final String name;
  final String number;
  final int type;
  final DateTime timestamp;
  final int durationSeconds;

  factory CallLogEntry.fromPlatform(Map<String, dynamic> row) => CallLogEntry(
    name: row['name'] as String? ?? '',
    number: row['number'] as String? ?? '',
    type: (row['type'] as num?)?.toInt() ?? 0,
    timestamp: DateTime.fromMillisecondsSinceEpoch(
      (row['timestamp'] as num?)?.toInt() ?? 0,
    ),
    durationSeconds: (row['durationSeconds'] as num?)?.toInt() ?? 0,
  );

  bool get hasSavedName => name.trim().isNotEmpty;
  String get displayName => hasSavedName ? name.trim() : 'Unknown';
  String get contactTitle => hasSavedName ? name.trim() : number;
  String get savedName => hasSavedName ? name.trim() : '';
  String get mobile => _digits(number).takeLast(10);
  String get direction => type == 1 ? 'incoming' : 'outgoing';
  String get directionLabel => switch (type) {
    1 => 'Incoming',
    2 => 'Outgoing',
    3 => 'Missed',
    _ => 'Call',
  };
  Color get color => switch (type) {
    1 => const Color(0xFF169C63),
    2 => const Color(0xFF347BD2),
    3 => const Color(0xFFD94755),
    _ => const Color(0xFF776F7E),
  };
  IconData get icon => switch (type) {
    1 => Icons.call_received_rounded,
    2 => Icons.call_made_rounded,
    3 => Icons.call_missed_rounded,
    _ => Icons.call_rounded,
  };
  String get durationLabel {
    final minutes = durationSeconds ~/ 60;
    final seconds = durationSeconds % 60;
    return minutes > 0 ? '${minutes}m ${seconds}s' : '${seconds}s';
  }

  String get displayTime {
    final local = timestamp.toLocal();
    final period = local.hour >= 12 ? 'pm' : 'am';
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    return '${local.day}/${local.month}/${local.year} · $hour:${local.minute.toString().padLeft(2, '0')} $period';
  }
}

enum _CallFilter {
  all('All calls'),
  incoming('Incoming'),
  outgoing('Outgoing'),
  missed('Missed');

  const _CallFilter(this.menuLabel);
  final String menuLabel;

  bool includes(CallLogEntry entry) => switch (this) {
    _CallFilter.all => true,
    _CallFilter.incoming => entry.type == 1,
    _CallFilter.outgoing => entry.type == 2,
    _CallFilter.missed => entry.type == 3,
  };
}

String _digits(String value) => value.replaceAll(RegExp(r'\D'), '');

bool isCallLogAdministrator(String role) =>
    const {'admin', 'super-admin'}.contains(role.trim().toLowerCase());

extension on String {
  String takeLast(int count) =>
      length <= count ? this : substring(length - count);
}

String _callLogErrorMessage(Object? error) {
  if (error is PlatformException && error.code == 'unsupported_device') {
    return 'This device does not provide telephone call history.';
  }
  if (error is PlatformException && error.code == 'restricted_permission') {
    return 'Android blocked this hard-restricted permission. Install the approved enterprise build through a managed installer.';
  }
  return 'Android did not grant call history access. You can request access again or review the app permission in Settings.';
}
