import 'package:flutter/material.dart';

import '../../core/api/techmedia_api.dart';

class DutyReportHistory extends StatelessWidget {
  const DutyReportHistory({required this.reports, super.key});

  final List<HrDutyReport> reports;

  @override
  Widget build(BuildContext context) {
    final recentReports = _lastThreeDays(reports);
    if (recentReports.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Updates from the last 3 days',
          style: Theme.of(context).textTheme.labelLarge,
        ),
        const SizedBox(height: 8),
        ...recentReports.map((report) => _DutyReportCard(report: report)),
      ],
    );
  }
}

class _DutyReportCard extends StatelessWidget {
  const _DutyReportCard({required this.report});

  final HrDutyReport report;

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 8),
    elevation: 0,
    color: const Color(0xFFFBF7FC),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
      side: const BorderSide(color: Color(0xFFE7DFEB)),
    ),
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.chat_bubble_outline_rounded,
                color: Color(0xFF662C90),
                size: 16,
              ),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  report.name.isEmpty ? 'Duty update' : report.name,
                  style: Theme.of(context).textTheme.labelLarge,
                ),
              ),
              Text(report.date, style: Theme.of(context).textTheme.labelSmall),
            ],
          ),
          const SizedBox(height: 7),
          Text(report.actions),
        ],
      ),
    ),
  );
}

List<HrDutyReport> _lastThreeDays(List<HrDutyReport> reports) {
  final today = DateTime.now();
  final firstDay = DateTime(
    today.year,
    today.month,
    today.day,
  ).subtract(const Duration(days: 2));
  return reports.where((report) {
    final reportDay = DateTime(
      report.createdAt.year,
      report.createdAt.month,
      report.createdAt.day,
    );
    return !reportDay.isBefore(firstDay);
  }).toList();
}
