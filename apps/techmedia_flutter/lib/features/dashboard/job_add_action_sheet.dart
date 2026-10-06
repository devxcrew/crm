import 'package:flutter/material.dart';

enum JobAddAction {
  startJob,
  stopJob,
  takePhoto,
  scanDocument,
  logLocation,
  markCompleted,
  charges,
  collected,
}

Future<JobAddAction?> showJobAddActions(
  BuildContext context, {
  required bool isJobRunning,
  String? timerLabel,
}) {
  return showModalBottomSheet<JobAddAction>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.78,
        ),
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const ListTile(
                  leading: Icon(Icons.add_circle_outline),
                  title: Text(
                    'Add',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                _ActionTile(
                  action: isJobRunning
                      ? JobAddAction.stopJob
                      : JobAddAction.startJob,
                  icon: isJobRunning
                      ? Icons.stop_rounded
                      : Icons.play_arrow_rounded,
                  label: isJobRunning ? 'Stop job' : 'Start job',
                  timerLabel: isJobRunning ? timerLabel : null,
                ),
                _ActionTile(
                  action: JobAddAction.takePhoto,
                  icon: Icons.photo_camera_outlined,
                  label: 'Take photo',
                ),
                _ActionTile(
                  action: JobAddAction.scanDocument,
                  icon: Icons.document_scanner_outlined,
                  label: 'Scan document',
                ),
                _ActionTile(
                  action: JobAddAction.logLocation,
                  icon: Icons.location_on_outlined,
                  label: 'Log location',
                ),
                _ActionTile(
                  action: JobAddAction.markCompleted,
                  icon: Icons.task_alt_outlined,
                  label: 'Mark completed',
                ),
                _ActionTile(
                  action: JobAddAction.charges,
                  icon: Icons.receipt_long_outlined,
                  label: 'Charges',
                ),
                _ActionTile(
                  action: JobAddAction.collected,
                  icon: Icons.currency_rupee_rounded,
                  label: 'Collected Rs.',
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.action,
    required this.icon,
    required this.label,
    this.timerLabel,
  });

  final JobAddAction action;
  final IconData icon;
  final String label;
  final String? timerLabel;

  @override
  Widget build(BuildContext context) => ListTile(
    leading: Icon(icon),
    title: Row(
      children: [
        Text(label),
        if (timerLabel != null) ...[
          const SizedBox(width: 8),
          _TimerBadge(label: timerLabel!),
        ],
      ],
    ),
    onTap: () => Navigator.of(context).pop(action),
  );
}

class _TimerBadge extends StatelessWidget {
  const _TimerBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: const Color(0xFFF1DDF5),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      child: Text(
        label,
        style: const TextStyle(
          color: Color(0xFF682A82),
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    ),
  );
}
