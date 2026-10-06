import 'package:flutter/material.dart';

import '../../core/api/techmedia_api.dart';
import 'job_start_countdown.dart';

Future<bool> showActionQuickActionSheet({
  required BuildContext context,
  required TechMediaApi api,
  required UserSession session,
  required List<CrmJob> jobs,
}) async {
  final action = await showModalBottomSheet<_QuickAction>(
    context: context,
    showDragHandle: true,
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.add_comment_outlined),
              title: const Text('Add action'),
              subtitle: const Text('Post an update against an enquiry.'),
              onTap: () => Navigator.pop(context, _QuickAction.addAction),
            ),
            ListTile(
              leading: const Icon(Icons.toggle_on_outlined),
              title: const Text('Check in'),
              subtitle: const Text('Start or stop a job execution.'),
              onTap: () => Navigator.pop(context, _QuickAction.checkIn),
            ),
          ],
        ),
      ),
    ),
  );
  if (!context.mounted || action == null) return false;
  return switch (action) {
    _QuickAction.addAction => _showAddAction(context, api, session, jobs),
    _QuickAction.checkIn => _showCheckIn(context, api, session, jobs),
  };
}

Future<bool> _showAddAction(
  BuildContext context,
  TechMediaApi api,
  UserSession session,
  List<CrmJob> jobs,
) async {
  if (jobs.isEmpty) return false;
  var selected = jobs.first;
  final controller = TextEditingController();
  final shouldSave = await showDialog<bool>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setDialogState) => AlertDialog(
        title: const Text('Add action'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<CrmJob>(
              initialValue: selected,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Enquiry'),
              items: jobs
                  .map(
                    (job) => DropdownMenuItem(
                      value: job,
                      child: Text('#${job.number} · ${job.title}'),
                    ),
                  )
                  .toList(),
              onChanged: (job) {
                if (job != null) setDialogState(() => selected = job);
              },
            ),
            const SizedBox(height: 14),
            TextField(
              controller: controller,
              autofocus: true,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Action details',
                hintText: 'What was completed or needs follow-up?',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(context, controller.text.trim().isNotEmpty),
            child: const Text('Add'),
          ),
        ],
      ),
    ),
  );
  final comment = controller.text.trim();
  controller.dispose();
  if (shouldSave != true || comment.isEmpty) return false;
  try {
    await api.addJobComment(
      accessToken: session.accessToken,
      id: selected.sourceId,
      comment: comment,
    );
    return true;
  } on TechMediaApiException catch (error) {
    if (context.mounted) _showError(context, error.message);
    return false;
  }
}

Future<bool> _showCheckIn(
  BuildContext context,
  TechMediaApi api,
  UserSession session,
  List<CrmJob> jobs,
) async {
  if (jobs.isEmpty) return false;
  final selected = await showDialog<CrmJob>(
    context: context,
    builder: (context) => SimpleDialog(
      title: const Text('Check in to a job'),
      children: jobs
          .map(
            (job) => SimpleDialogOption(
              onPressed: () => Navigator.pop(context, job),
              child: Row(
                children: [
                  Expanded(child: Text('#${job.number} · ${job.title}')),
                  Switch(
                    value: _runningExecution(job) != null,
                    onChanged: null,
                  ),
                ],
              ),
            ),
          )
          .toList(),
    ),
  );
  if (selected == null) return false;
  try {
    final running = _runningExecution(selected);
    if (running == null) {
      if (!context.mounted) return false;
      final scheduled = JobStartCountdown.instance.start(
        jobId: selected.sourceId,
        onElapsed: () async {
          try {
            await api.startJob(
              accessToken: session.accessToken,
              id: selected.sourceId,
            );
          } on TechMediaApiException catch (error) {
            if (context.mounted) _showError(context, error.message);
          }
        },
      );
      if (!scheduled && context.mounted) {
        _showError(context, 'This job start is already pending.');
        return false;
      }
    } else {
      await api.stopJob(
        accessToken: session.accessToken,
        id: selected.sourceId,
        jobName: running.name,
      );
    }
    return true;
  } on TechMediaApiException catch (error) {
    if (context.mounted) _showError(context, error.message);
    return false;
  }
}

CrmJobExecution? _runningExecution(CrmJob job) {
  for (final execution in job.jobs) {
    if (execution.isRunning) return execution;
  }
  return null;
}

void _showError(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}

enum _QuickAction { addAction, checkIn }
