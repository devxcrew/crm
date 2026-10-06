import 'package:flutter/material.dart';

import '../../core/api/techmedia_api.dart';
import 'job_duration.dart';

class JobWorkFeed extends StatelessWidget {
  const JobWorkFeed({required this.job, required this.session, super.key});

  final CrmJob job;
  final UserSession session;

  @override
  Widget build(BuildContext context) {
    final entries = _WorkFeedEntry.fromJob(job, session);
    if (entries.isEmpty) {
      return const Center(child: Text('No comments or job records yet.'));
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 92),
      itemCount: entries.length,
      separatorBuilder: (context, index) =>
          const Divider(height: 1, indent: 44, color: Color(0xFFE5DFE7)),
      itemBuilder: (context, index) => _WorkFeedTile(entry: entries[index]),
    );
  }
}

class _WorkFeedEntry {
  const _WorkFeedEntry({
    required this.icon,
    this.title,
    required this.detail,
    required this.author,
    required this.createdAt,
    this.durationLabel,
  });

  final IconData icon;
  final String? title;
  final String detail;
  final String author;
  final DateTime createdAt;
  final String? durationLabel;

  static List<_WorkFeedEntry> fromJob(CrmJob job, UserSession session) {
    final entries = <_WorkFeedEntry>[
      ...job.comments.map(
        (comment) => _WorkFeedEntry(
          icon: Icons.chat_bubble_outline,
          title: null,
          detail: comment.comment,
          author: _author(comment.createdByUserId, session),
          createdAt: comment.createdAt,
        ),
      ),
      ...job.jobs.map(
        (execution) => _WorkFeedEntry(
          icon: execution.isRunning
              ? Icons.timer_outlined
              : Icons.assignment_turned_in_outlined,
          title: '${execution.name} · ${execution.status}',
          detail:
              '${execution.employee} · ${_jobTime(execution.startTime)}–${_jobTime(execution.stopTime)}',
          author: execution.employee,
          createdAt: execution.createdAt,
          durationLabel: formatJobDuration(execution),
        ),
      ),
    ]..sort((left, right) => right.createdAt.compareTo(left.createdAt));
    return entries;
  }
}

class _WorkFeedTile extends StatelessWidget {
  const _WorkFeedTile({required this.entry});

  final _WorkFeedEntry entry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 11),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 17,
            backgroundColor: const Color(0xFFF0E2FA),
            foregroundColor: const Color(0xFF662C90),
            child: Icon(entry.icon, size: 17),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (entry.title != null)
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          entry.title!,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                      if (entry.durationLabel case final duration?) ...[
                        const SizedBox(width: 8),
                        _DurationBadge(label: duration),
                      ],
                    ],
                  ),
                if (entry.title != null) const SizedBox(height: 3),
                Text(entry.detail),
                const SizedBox(height: 5),
                Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    '${entry.author} · ${_relativeTime(entry.createdAt)}',
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DurationBadge extends StatelessWidget {
  const _DurationBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFE7D3F7),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFB77BDD)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        child: Text(
          label,
          style: const TextStyle(
            color: Color(0xFF582177),
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

String _author(String value, UserSession session) {
  if (value.toLowerCase() == session.profile.email.toLowerCase()) {
    return session.profile.name;
  }
  final localPart = value.split('@').first.replaceAll(RegExp(r'[._-]+'), ' ');
  return localPart
      .split(' ')
      .where((part) => part.isNotEmpty)
      .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}

String _jobTime(String? value) {
  if (value == null || value.isEmpty) return 'Running';
  return value.length >= 8 ? value.substring(0, 8) : value;
}

String _relativeTime(DateTime value) {
  final difference = DateTime.now().difference(value.toLocal());
  if (difference.inDays > 0) {
    final hours = difference.inHours.remainder(24);
    return hours == 0
        ? '${difference.inDays}d'
        : '${difference.inDays}d ${hours}h';
  }
  if (difference.inHours > 0) {
    final minutes = difference.inMinutes.remainder(60);
    return minutes == 0
        ? '${difference.inHours}h'
        : '${difference.inHours}h ${minutes}m';
  }
  if (difference.inMinutes > 0) return '${difference.inMinutes}m';
  return 'Now';
}
