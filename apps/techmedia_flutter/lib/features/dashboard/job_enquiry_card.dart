import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/techmedia_api.dart';
import '../../core/platform/mobile_actions.dart';
import 'dashboard_list_page.dart';
import 'job_detail_page.dart';
import 'job_duration.dart';
import 'job_start_countdown.dart';

class JobEnquiryCard extends StatefulWidget {
  const JobEnquiryCard({
    required this.api,
    required this.session,
    required this.enquiry,
    required this.job,
    required this.onJobChanged,
    super.key,
  });

  final TechMediaApi api;
  final UserSession session;
  final DashboardListItem enquiry;
  final CrmJob job;
  final VoidCallback onJobChanged;

  @override
  State<JobEnquiryCard> createState() => _JobEnquiryCardState();
}

class _JobEnquiryCardState extends State<JobEnquiryCard> {
  late CrmJob _job = widget.job;
  final _startCountdown = JobStartCountdown.instance;
  bool _updating = false;
  Timer? _runningTimer;

  @override
  void initState() {
    super.initState();
    _startCountdown.addListener(_refreshCountdown);
    _syncRunningTimer();
  }

  @override
  void didUpdateWidget(covariant JobEnquiryCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.job != widget.job) _job = widget.job;
    _syncRunningTimer();
  }

  @override
  void dispose() {
    _startCountdown.removeListener(_refreshCountdown);
    _runningTimer?.cancel();
    super.dispose();
  }

  void _refreshCountdown() {
    if (mounted) setState(() {});
  }

  CrmJobExecution? get _runningJob {
    for (final execution in _job.jobs) {
      if (execution.isRunning) return execution;
    }
    return null;
  }

  void _syncRunningTimer() {
    if (_runningJob == null) {
      _runningTimer?.cancel();
      _runningTimer = null;
      return;
    }
    _runningTimer ??= Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  Widget build(BuildContext context) {
    final enquiry = DashboardListItem.fromCrmJob(_job);
    final running = _runningJob != null;
    final starting = _startCountdown.isPending(_job.sourceId);
    return Card(
      margin: EdgeInsets.zero,
      color: Colors.white,
      elevation: 5,
      shadowColor: const Color(0x4A251B2A),
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: Color(0xFFC5BEC9), width: 1.1),
      ),
      clipBehavior: Clip.antiAlias,
      child: Container(
        margin: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(17),
          border: Border.all(color: const Color(0xFFEDE9EF)),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => _openDetail(context, enquiry),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(11, 10, 8, 7),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _JobCardHeader(
                  enquiry: enquiry,
                  running: running,
                  starting: starting,
                  countdownLabel: _startCountdown.label(_job.sourceId),
                  runningDuration: running
                      ? formatJobDuration(_runningJob!)
                      : null,
                  updating: _updating,
                  onChanged: _toggleJob,
                ),
                const SizedBox(height: 10),
                Text(
                  enquiry.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w800, height: 1.2),
                ),
                const SizedBox(height: 5),
                Text(
                  enquiry.customer,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall
                      ?.copyWith(color: const Color(0xFF6E6872)),
                ),
                const SizedBox(height: 22),
                Text(
                  'Created by ${enquiry.createdBy} · ${enquiry.createdDate} | ${enquiry.createdAgo}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF6D6870),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 7),
                const Divider(height: 1),
                const SizedBox(height: 5),
                _JobCardFooter(
                  onMore: _runMoreAction,
                  onWhatsApp: _openWhatsApp,
                  onCall: () => _runContactAction('Call', MobileActions.call),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _toggleJob(bool shouldRun) async {
    if (_updating) return;
    final starting = _startCountdown.isPending(_job.sourceId);
    if (!shouldRun && starting) {
      _startCountdown.cancel(_job.sourceId);
      return;
    }
    if (shouldRun) {
      _scheduleJobStart();
      return;
    }
    setState(() => _updating = true);
    try {
      final running = _runningJob;
      final updated = await widget.api.stopJob(
        accessToken: widget.session.accessToken,
        id: _job.sourceId,
        jobName: running!.name,
      );
      if (mounted) {
        setState(() => _job = updated);
        _syncRunningTimer();
        widget.onJobChanged();
      }
    } on TechMediaApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  void _scheduleJobStart() {
    final scheduled = _startCountdown.start(
      jobId: _job.sourceId,
      onElapsed: () async {
        try {
          final updated = await widget.api.startJob(
            accessToken: widget.session.accessToken,
            id: _job.sourceId,
          );
          if (mounted) {
            setState(() => _job = updated);
            _syncRunningTimer();
            widget.onJobChanged();
          }
        } on TechMediaApiException catch (error) {
          if (mounted) {
            ScaffoldMessenger.of(context)
                .showSnackBar(SnackBar(content: Text(error.message)));
          }
        }
      },
    );
    if (scheduled && mounted) setState(() {});
  }

  Future<void> _openDetail(
    BuildContext context,
    DashboardListItem enquiry,
  ) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) => JobDetailPage(
          api: widget.api,
          session: widget.session,
          enquiry: enquiry,
          initialJob: _job,
          onJobChanged: widget.onJobChanged,
        ),
      ),
    );
    if (!mounted) return;
    try {
      final refreshed = await widget.api.job(
        widget.session.accessToken,
        _job.sourceId,
      );
      if (mounted) {
        setState(() => _job = refreshed);
        _syncRunningTimer();
        widget.onJobChanged();
      }
    } on TechMediaApiException {
      // The next list refresh will retry if the connection was interrupted.
    }
  }

  Future<void> _runContactAction(
    String action,
    Future<bool> Function(String mobile) launch,
  ) async {
    if (_job.mobile.trim().isEmpty) {
      _showUnavailable('$action number');
      return;
    }
    if (!await launch(_job.mobile)) _showUnavailable(action);
  }

  Future<void> _openWhatsApp() async {
    if (_job.mobile.trim().isEmpty) {
      _showUnavailable('WhatsApp number');
      return;
    }
    final opened = await MobileActions.whatsApp(_job.mobile);
    if (!opened) _showUnavailable('WhatsApp');
  }

  Future<void> _runMoreAction(_JobMoreAction action) async {
    final opened = switch (action) {
      _JobMoreAction.location => MobileActions.location(
        '${_job.customer} ${_job.title}',
      ),
      _JobMoreAction.scanDocument => MobileActions.scanDocument(),
      _JobMoreAction.photo => MobileActions.photo(),
    };
    if (!await opened) _showUnavailable(action.label);
  }

  void _showUnavailable(String action) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$action is not available on this device.')),
    );
  }
}

class _JobCardHeader extends StatelessWidget {
  const _JobCardHeader({
    required this.enquiry,
    required this.running,
    required this.starting,
    required this.countdownLabel,
    required this.runningDuration,
    required this.updating,
    required this.onChanged,
  });

  final DashboardListItem enquiry;
  final bool running;
  final bool starting;
  final String countdownLabel;
  final String? runningDuration;
  final bool updating;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(7, 5, 9, 5),
          decoration: BoxDecoration(
            color: const Color(0xFF4F7FC8),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.adjust_rounded, size: 15, color: Colors.white),
              const SizedBox(width: 4),
              Text(
                '#${enquiry.enquiryNumber}  ${_statusLabel(enquiry.status)}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            enquiry.list.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelMedium,
          ),
        ),
        Icon(
          running
              ? Icons.stop_rounded
              : starting
              ? Icons.timer_outlined
              : Icons.play_arrow_rounded,
          size: 18,
          color: const Color(0xFF242127),
        ),
        const SizedBox(width: 3),
        Text(
          running
              ? 'Stop ${runningDuration ?? ''}'.trim()
              : starting
              ? countdownLabel
              : 'Start',
          style: Theme.of(context).textTheme.labelMedium,
        ),
        const SizedBox(width: 2),
        if (updating)
          const SizedBox(
            height: 24,
            width: 38,
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          )
        else
          _EmbossedSwitch(value: running || starting, onChanged: onChanged),
      ],
    );
  }
}

class _JobCardFooter extends StatelessWidget {
  const _JobCardFooter({
    required this.onCall,
    required this.onWhatsApp,
    required this.onMore,
  });

  final VoidCallback onCall;
  final VoidCallback onWhatsApp;
  final ValueChanged<_JobMoreAction> onMore;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(
          tooltip: 'Call customer',
          visualDensity: VisualDensity.compact,
          onPressed: onCall,
          icon: const Icon(Icons.call_rounded, size: 21),
        ),
        IconButton(
          tooltip: 'WhatsApp customer',
          visualDensity: VisualDensity.compact,
          onPressed: onWhatsApp,
          icon: const _WhatsAppMark(),
        ),
        const Spacer(),
        PopupMenuButton<_JobMoreAction>(
          tooltip: 'More job actions',
          onSelected: onMore,
          itemBuilder: (context) => _JobMoreAction.values
              .map(
                (action) => PopupMenuItem(
                  value: action,
                  child: Row(
                    children: [
                      Icon(action.icon, size: 19),
                      const SizedBox(width: 10),
                      Text(action.label),
                    ],
                  ),
                ),
              )
              .toList(),
          child: Container(
            height: 42,
            width: 42,
            decoration: BoxDecoration(
              color: const Color(0xFFF1DDF5),
              shape: BoxShape.circle,
              boxShadow: const [
                BoxShadow(
                  color: Color(0x28000000),
                  blurRadius: 5,
                  offset: Offset(0, 2),
                ),
              ],
            ),
            child: const Icon(Icons.add_rounded, color: Color(0xFF682A82)),
          ),
        ),
      ],
    );
  }
}

class _EmbossedSwitch extends StatelessWidget {
  const _EmbossedSwitch({required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      toggled: value,
      button: true,
      label: value ? 'Stop job' : 'Start job',
      child: GestureDetector(
        onTap: () => onChanged(!value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: 50,
          height: 29,
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: value ? const Color(0xFF70298C) : const Color(0xFFE8DFEC),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: value ? const Color(0xFF70298C) : const Color(0xFFD9C9DE),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: value
                    ? const Color(0x33702A86)
                    : const Color(0x1F8E6B99),
                blurRadius: 3,
                offset: Offset(1, 2),
              ),
              const BoxShadow(
                color: Color(0x99FFFFFF),
                blurRadius: 2,
                offset: Offset(-1, -1),
              ),
            ],
          ),
          child: AnimatedAlign(
            duration: const Duration(milliseconds: 180),
            alignment: value ? Alignment.centerRight : Alignment.centerLeft,
            child: Container(
              width: 22,
              height: 22,
              decoration: const BoxDecoration(
                color: Color(0xFFFDF9FF),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Color(0x2E702A86),
                    blurRadius: 3,
                    offset: Offset(1, 1),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _WhatsAppMark extends StatelessWidget {
  const _WhatsAppMark();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 26,
      width: 26,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        color: Color(0xFF25D366),
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Color(0x2625D366),
            blurRadius: 4,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: const Icon(Icons.phone_rounded, color: Colors.white, size: 16),
    );
  }
}

enum _JobMoreAction {
  location('Location', Icons.location_on_outlined),
  scanDocument('Scan document', Icons.document_scanner_outlined),
  photo('Photo', Icons.photo_camera_outlined);

  const _JobMoreAction(this.label, this.icon);

  final String label;
  final IconData icon;
}

String _statusLabel(JobStatus status) => switch (status) {
  JobStatus.open => 'Open',
  JobStatus.won => 'Won',
  JobStatus.lost => 'Lost',
};
