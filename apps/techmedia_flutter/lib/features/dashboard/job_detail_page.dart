import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/techmedia_api.dart';
import '../../core/platform/mobile_actions.dart';
import 'dashboard_list_page.dart';
import 'job_add_action_sheet.dart';
import 'job_duration.dart';
import 'job_start_countdown.dart';
import 'job_work_feed.dart';

const _detailSurfaceTone = Color(0xFFFCF9FD);

class JobDetailPage extends StatefulWidget {
  const JobDetailPage({
    required this.api,
    required this.session,
    required this.enquiry,
    required this.initialJob,
    this.onJobChanged,
    super.key,
  });

  final TechMediaApi api;
  final UserSession session;
  final DashboardListItem enquiry;
  final CrmJob initialJob;
  final VoidCallback? onJobChanged;

  @override
  State<JobDetailPage> createState() => _JobDetailPageState();
}

class _JobDetailPageState extends State<JobDetailPage> {
  final _replyController = TextEditingController();
  late CrmJob _job;
  var _isLoading = false;
  var _isSending = false;
  Timer? _runningTimer;

  @override
  void initState() {
    super.initState();
    _job = widget.initialJob;
    JobStartCountdown.instance.addListener(_refreshCountdown);
    _syncRunningTimer();
    _refresh();
  }

  @override
  void dispose() {
    JobStartCountdown.instance.removeListener(_refreshCountdown);
    _runningTimer?.cancel();
    _replyController.dispose();
    super.dispose();
  }

  void _refreshCountdown() {
    if (mounted) setState(() {});
  }

  void _syncRunningTimer() {
    if (!_job.jobs.any((job) => job.isRunning)) {
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
    return Scaffold(
      resizeToAvoidBottomInset: false,
      floatingActionButton: FloatingActionButton(
        tooltip: 'Add action',
        onPressed: _isSending ? null : _openAddActions,
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _CompactJobDetail(enquiry: widget.enquiry, job: _job),
            if (_isLoading) const LinearProgressIndicator(minHeight: 2),
            Expanded(
              child: JobWorkFeed(job: _job, session: widget.session),
            ),
          ],
        ),
      ),
      bottomNavigationBar: _ReplyComposer(
        controller: _replyController,
        onSend: _isSending ? null : _addComment,
      ),
    );
  }

  Future<void> _refresh() async {
    setState(() => _isLoading = true);
    try {
      final job = await widget.api.job(
        widget.session.accessToken,
        widget.initialJob.sourceId,
      );
      if (mounted) {
        setState(() => _job = job);
        _syncRunningTimer();
        widget.onJobChanged?.call();
      }
    } on TechMediaApiException catch (error) {
      if (mounted) _showError(error.message);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _openAddActions() async {
    final isPendingStart = JobStartCountdown.instance.isPending(
      widget.initialJob.sourceId,
    );
    final runningJob = _job.jobs.where((job) => job.isRunning).firstOrNull;
    final action = await showJobAddActions(
      context,
      isJobRunning: isPendingStart || runningJob != null,
      timerLabel: isPendingStart
          ? JobStartCountdown.instance.label(widget.initialJob.sourceId)
          : runningJob == null
          ? null
          : formatJobDuration(runningJob),
    );
    if (!mounted || action == null) return;
    switch (action) {
      case JobAddAction.startJob:
        await _startJob();
      case JobAddAction.stopJob:
        await _markCompleted();
      case JobAddAction.takePhoto:
        await _runDeviceAction(MobileActions.photo, 'Camera');
      case JobAddAction.scanDocument:
        await _runDeviceAction(MobileActions.scanDocument, 'Document scanner');
      case JobAddAction.logLocation:
        await _runDeviceAction(
          () => MobileActions.location('${_job.customer} ${_job.title}'),
          'Location',
        );
      case JobAddAction.markCompleted:
        await _markCompleted();
      case JobAddAction.charges:
        await _recordAmount('Charges');
      case JobAddAction.collected:
        await _recordAmount('Collected');
    }
  }

  Future<void> _addComment() async {
    final message = _replyController.text.trim();
    if (message.isEmpty) return;
    await _saveComment(message);
    _replyController.clear();
    if (mounted) FocusScope.of(context).unfocus();
  }

  Future<void> _recordAmount(String label) async {
    final amount = await _requestAmount(context, label);
    if (!mounted || amount == null) return;
    await _saveComment('$label: ₹$amount');
  }

  Future<void> _saveComment(String comment) async {
    setState(() => _isSending = true);
    try {
      final job = await widget.api.addJobComment(
        accessToken: widget.session.accessToken,
        id: widget.initialJob.sourceId,
        comment: comment,
      );
      if (mounted) {
        setState(() => _job = job);
        _syncRunningTimer();
        widget.onJobChanged?.call();
      }
    } on TechMediaApiException catch (error) {
      if (mounted) _showError(error.message);
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  Future<void> _startJob() async {
    final countdown = JobStartCountdown.instance;
    final scheduled = countdown.start(
      jobId: widget.initialJob.sourceId,
      onElapsed: () => _runJobAction(
        () => widget.api.startJob(
          accessToken: widget.session.accessToken,
          id: widget.initialJob.sourceId,
        ),
      ),
    );
    if (scheduled && mounted) setState(() {});
  }

  Future<void> _markCompleted() async {
    final countdown = JobStartCountdown.instance;
    if (countdown.isCancellable(widget.initialJob.sourceId)) {
      countdown.cancel(widget.initialJob.sourceId);
      if (mounted) setState(() {});
      return;
    }
    final running = _job.jobs.where((job) => job.isRunning).firstOrNull;
    if (running == null) {
      _showError('No running job to mark completed.');
      return;
    }
    await _runJobAction(
      () => widget.api.stopJob(
        accessToken: widget.session.accessToken,
        id: widget.initialJob.sourceId,
        jobName: running.name,
      ),
    );
    if (mounted) await _refresh();
  }

  Future<void> _runDeviceAction(
    Future<bool> Function() action,
    String label,
  ) async {
    if (await action()) return;
    if (mounted) _showError('$label is not available on this device.');
  }

  Future<void> _runJobAction(Future<CrmJob> Function() action) async {
    setState(() => _isSending = true);
    try {
      final job = await action();
      if (mounted) {
        setState(() => _job = job);
        _syncRunningTimer();
        widget.onJobChanged?.call();
      }
    } on TechMediaApiException catch (error) {
      if (mounted) _showError(error.message);
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }
}

class _CompactJobDetail extends StatelessWidget {
  const _CompactJobDetail({required this.enquiry, required this.job});

  final DashboardListItem enquiry;
  final CrmJob job;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
      decoration: const BoxDecoration(
        color: _detailSurfaceTone,
        border: Border(bottom: BorderSide(color: Color(0xFFE7E1E9))),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                tooltip: 'Back to jobs',
                visualDensity: VisualDensity.compact,
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.arrow_back_rounded),
              ),
              _DetailStatusBadge(
                number: enquiry.enquiryNumber,
                status: enquiry.status,
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
              _DetailJobTimer(jobId: job.sourceId, job: job),
            ],
          ),
          const SizedBox(height: 7),
          Text(
            'Created by ${enquiry.createdBy} · ${enquiry.createdDate} | ${enquiry.createdAgo}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: const Color(0xFF6D6870),
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            enquiry.title,
            style: Theme.of(context).textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

class _DetailStatusBadge extends StatelessWidget {
  const _DetailStatusBadge({required this.number, required this.status});

  final String number;
  final JobStatus status;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
    decoration: BoxDecoration(
      color: const Color(0xFF4F7FD4),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.radio_button_checked, size: 12, color: Colors.white),
        const SizedBox(width: 3),
        Text(
          '#$number  ${_detailStatusLabel(status)}',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 11,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    ),
  );
}

class _DetailJobTimer extends StatelessWidget {
  const _DetailJobTimer({required this.jobId, required this.job});

  final String jobId;
  final CrmJob job;

  @override
  Widget build(BuildContext context) {
    final countdown = JobStartCountdown.instance;
    final pending = countdown.isPending(jobId);
    final running = job.jobs.any((execution) => execution.isRunning);
    if (!pending && !running) return const SizedBox.shrink();
    final runningJob = job.jobs
        .where((execution) => execution.isRunning)
        .firstOrNull;
    final label = pending
        ? countdown.label(jobId)
        : formatJobDuration(runningJob!);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFF1DDF5),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.timer_outlined,
              size: 15,
              color: Color(0xFF682A82),
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: const TextStyle(
                color: Color(0xFF682A82),
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _detailStatusLabel(JobStatus status) => switch (status) {
  JobStatus.open => 'Open',
  JobStatus.won => 'Won',
  JobStatus.lost => 'Lost',
};

class _ReplyComposer extends StatelessWidget {
  const _ReplyComposer({required this.controller, required this.onSend});

  final TextEditingController controller;
  final VoidCallback? onSend;

  @override
  Widget build(BuildContext context) {
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;
    return AnimatedPadding(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
      padding: EdgeInsets.only(
        bottom: keyboardInset == 0 ? 0 : keyboardInset + 8,
      ),
      child: SafeArea(
        top: false,
        bottom: keyboardInset == 0,
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: _detailSurfaceTone,
            border: Border(top: BorderSide(color: Color(0xFFF0ECF2))),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 9, 14, 10),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: controller,
                    minLines: 1,
                    maxLines: 3,
                    textInputAction: TextInputAction.newline,
                    decoration: InputDecoration(
                      hintText: 'Write a comment only',
                      isDense: true,
                      filled: true,
                      fillColor: const Color(0xFFF9F7FA),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  tooltip: 'Send reply',
                  onPressed: onSend,
                  icon: const Icon(Icons.send, size: 19),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

Future<String?> _requestAmount(BuildContext context, String label) async {
  final controller = TextEditingController();
  final amount = await showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text('$label amount'),
      content: TextField(
        controller: controller,
        autofocus: true,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: const InputDecoration(prefixText: '₹ ', hintText: '0.00'),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(controller.text.trim()),
          child: const Text('Save'),
        ),
      ],
    ),
  );
  controller.dispose();
  if (amount == null || double.tryParse(amount) == null) return null;
  return amount;
}
