import 'package:flutter/material.dart';

import '../../core/api/techmedia_api.dart';
import 'action_quick_action_sheet.dart';
import 'job_duration.dart';

class ActionActivityPage extends StatefulWidget {
  const ActionActivityPage({
    required this.api,
    required this.session,
    super.key,
  });

  final TechMediaApi api;
  final UserSession session;

  @override
  State<ActionActivityPage> createState() => _ActionActivityPageState();
}

class _ActionActivityPageState extends State<ActionActivityPage> {
  var _period = _ActionPeriod.threeDays;
  late Future<List<CrmJob>> _jobs = _loadJobs();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Actions')),
      floatingActionButton: _EmbossedActionButton(onPressed: _openQuickActions),
      body: FutureBuilder<List<CrmJob>>(
        future: _jobs,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return const Center(child: Text('Could not load live actions.'));
          }
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final actions =
              snapshot.data!
                  .expand(_LiveAction.fromJob)
                  .where((action) => _period.includes(action.createdAt))
                  .toList()
                ..sort(
                  (left, right) => right.createdAt.compareTo(left.createdAt),
                );
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
            itemCount: actions.length + 2,
            separatorBuilder: (context, index) =>
                SizedBox(height: index == 0 ? 14 : 8),
            itemBuilder: (context, index) {
              if (index == 0) return _ActionHeader(onChanged: _setPeriod);
              if (index == 1)
                return _ActionSummary(count: actions.length, period: _period);
              return _ActionCard(action: actions[index - 2]);
            },
          );
        },
      ),
    );
  }

  void _setPeriod(_ActionPeriod period) => setState(() => _period = period);

  Future<List<CrmJob>> _loadJobs() =>
      widget.api.assignedJobDetails(widget.session.accessToken);

  Future<void> _openQuickActions() async {
    final jobs = await _jobs;
    if (!mounted) return;
    final changed = await showActionQuickActionSheet(
      context: context,
      api: widget.api,
      session: widget.session,
      jobs: jobs,
    );
    if (changed && mounted) setState(() => _jobs = _loadJobs());
  }
}

class _EmbossedActionButton extends StatelessWidget {
  const _EmbossedActionButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Color(0x33702A86),
            blurRadius: 8,
            offset: Offset(0, 4),
          ),
          BoxShadow(
            color: Color(0xCCFFFFFF),
            blurRadius: 3,
            offset: Offset(-2, -2),
          ),
        ],
      ),
      child: FloatingActionButton(
        tooltip: 'Add action or check in',
        onPressed: onPressed,
        elevation: 0,
        backgroundColor: const Color(0xFFF1DDF5),
        foregroundColor: const Color(0xFF682A82),
        child: const Icon(Icons.add_rounded, size: 30),
      ),
    );
  }
}

class _ActionHeader extends StatelessWidget {
  const _ActionHeader({required this.onChanged});

  final ValueChanged<_ActionPeriod> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Actions',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            PopupMenuButton<_ActionPeriod>(
              tooltip: 'Filter actions',
              onSelected: onChanged,
              itemBuilder: (context) => _ActionPeriod.values
                  .map(
                    (item) => PopupMenuItem(
                      value: item,
                      child: _PeriodMenuItem(period: item),
                    ),
                  )
                  .toList(),
              child: const _FilterButton(),
            ),
          ],
        ),
        const SizedBox(height: 3),
        Text(
          '“Completed work at a glance.”',
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: const Color(0xFF837B88),
            fontStyle: FontStyle.italic,
          ),
        ),
      ],
    );
  }
}

class _ActionSummary extends StatelessWidget {
  const _ActionSummary({required this.count, required this.period});

  final int count;
  final _ActionPeriod period;

  @override
  Widget build(BuildContext context) {
    final summary = period == _ActionPeriod.threeDays
        ? '$count actions performed today.'
        : '$count actions performed ${period.summary}.';
    return Text(
      summary,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
        color: const Color(0xFF665E6C),
        fontWeight: FontWeight.w600,
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({required this.action});

  final _LiveAction action;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      elevation: 1,
      shadowColor: const Color(0x160F0B14),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () {},
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
          child: Row(
            children: [
              const CircleAvatar(
                radius: 19,
                backgroundColor: Color(0xFFF0E2FA),
                foregroundColor: Color(0xFF662C90),
                child: Icon(Icons.bolt, size: 19),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      action.title,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      action.detail,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    action.time,
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                  const SizedBox(height: 5),
                  const Icon(
                    Icons.check_circle,
                    color: Color(0xFF3C9975),
                    size: 16,
                  ),
                ],
              ),
              const SizedBox(width: 3),
              const Icon(Icons.chevron_right, color: Color(0xFF81788A)),
            ],
          ),
        ),
      ),
    );
  }
}

class _FilterButton extends StatelessWidget {
  const _FilterButton();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFF5EFF8),
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Padding(
        padding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Row(
          children: [
            Icon(Icons.filter_list, size: 18, color: Color(0xFF662C90)),
            SizedBox(width: 5),
            Text(
              'Filter',
              style: TextStyle(
                color: Color(0xFF662C90),
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PeriodMenuItem extends StatelessWidget {
  const _PeriodMenuItem({required this.period});

  final _ActionPeriod period;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(period.label),
        const Spacer(),
        Text(period.label, style: const TextStyle(fontWeight: FontWeight.w800)),
      ],
    );
  }
}

enum _ActionPeriod {
  threeDays('3 Days', 3, 'in the last 3 days'),
  sevenDays('7 Days', 7, 'in the last 7 days'),
  month('Month', 30, 'this month');

  const _ActionPeriod(this.label, this.days, this.summary);

  final String label;
  final int days;
  final String summary;

  bool includes(DateTime value) =>
      DateTime.now().difference(value.toLocal()).inDays < days;
}

class _LiveAction {
  const _LiveAction({
    required this.title,
    required this.detail,
    required this.time,
    required this.createdAt,
  });
  final String title;
  final String detail;
  final String time;
  final DateTime createdAt;

  static Iterable<_LiveAction> fromJob(CrmJob job) sync* {
    for (final activity in job.activities) {
      yield _LiveAction(
        title: '${activity.action} · #${job.number}',
        detail: '${job.title} · ${activity.details}',
        time: _relativeTime(activity.createdAt),
        createdAt: activity.createdAt,
      );
    }
    for (final execution in job.jobs) {
      yield _LiveAction(
        title: '${execution.status} job · #${job.number}',
        detail:
            '${job.title} · ${execution.employee} · ${formatJobDuration(execution)}',
        time: _relativeTime(execution.createdAt),
        createdAt: execution.createdAt,
      );
    }
  }
}

String _relativeTime(DateTime value) {
  final elapsed = DateTime.now().difference(value.toLocal());
  if (elapsed.inDays > 0) return '${elapsed.inDays}d ago';
  if (elapsed.inHours > 0) return '${elapsed.inHours}h ago';
  return '${elapsed.inMinutes.clamp(1, 59)}m ago';
}
