import 'package:flutter/material.dart';

import '../../core/api/techmedia_api.dart';
import 'action_activity_page.dart';
import 'job_enquiry_card.dart';
import 'dashboard_jobs_feed.dart';

class DashboardListPage extends StatelessWidget {
  const DashboardListPage({
    required this.api,
    required this.session,
    required this.section,
    required this.jobsFeed,
    super.key,
  });

  final TechMediaApi api;
  final UserSession session;
  final DashboardListSection section;
  final DashboardJobsFeed jobsFeed;

  @override
  Widget build(BuildContext context) {
    if (section.isJobs) {
      return _LiveJobsList(api: api, session: session, jobsFeed: jobsFeed);
    }
    if (section.isActions)
      return ActionActivityPage(api: api, session: session);
    return _StandardList(section: section);
  }
}

class _LiveJobsList extends StatelessWidget {
  const _LiveJobsList({
    required this.api,
    required this.session,
    required this.jobsFeed,
  });

  final TechMediaApi api;
  final UserSession session;
  final DashboardJobsFeed jobsFeed;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: jobsFeed,
      builder: (context, child) {
        if (jobsFeed.error != null && jobsFeed.jobs.isEmpty) {
          return _LiveState(
            message: 'Could not load your assigned enquiries.',
            onRetry: () {
              jobsFeed.refresh();
            },
          );
        }
        if (jobsFeed.isLoading && jobsFeed.jobs.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }
        final jobs = jobsFeed.jobs;
        final items = jobs.map(DashboardListItem.fromCrmJob).toList();
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          itemCount: items.length,
          separatorBuilder: (context, index) => const SizedBox(height: 14),
          itemBuilder: (context, index) {
            return JobEnquiryCard(
              api: api,
              session: session,
              enquiry: items[index],
              job: jobs[index],
              onJobChanged: () {
                jobsFeed.refresh();
              },
            );
          },
        );
      },
    );
  }
}

class _StandardList extends StatelessWidget {
  const _StandardList({required this.section});

  final DashboardListSection section;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
      itemCount: section.items.length + 1,
      separatorBuilder: (context, index) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        if (index == 0) return _ListHeading(section: section);
        final item = section.items[index - 1];
        return Card(
          elevation: 0,
          child: ListTile(
            contentPadding: const EdgeInsets.all(16),
            leading: CircleAvatar(child: Icon(section.icon)),
            title: Text(item.title),
            subtitle: Text(item.detail),
            trailing: const Icon(Icons.chevron_right),
          ),
        );
      },
    );
  }
}

class _ListHeading extends StatelessWidget {
  const _ListHeading({required this.section});

  final DashboardListSection section;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!section.isJobs) ...[
          Text(
            section.heading ?? section.label,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 4),
        ],
        Text(
          '${section.items.length} items to review today.',
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: const Color(0xFF837B88),
            fontStyle: FontStyle.italic,
            letterSpacing: 0.1,
          ),
        ),
      ],
    );
  }
}

class DashboardListSection {
  const DashboardListSection({
    required this.label,
    required this.icon,
    required this.items,
    this.heading,
    this.isJobs = false,
    this.isActions = false,
  });

  final String label;
  final IconData icon;
  final List<DashboardListItem> items;
  final String? heading;
  final bool isJobs;
  final bool isActions;
}

class DashboardListItem {
  const DashboardListItem({
    required this.enquiryNumber,
    required this.title,
    required this.customer,
    required this.list,
    required this.assignedTo,
    required this.dueDate,
    required this.createdBy,
    this.createdDate = '',
    required this.createdAgo,
    required this.lastAction,
    this.detail = '',
    this.status = JobStatus.open,
    this.priority = JobPriority.normal,
  });

  final String enquiryNumber;
  final String title;
  final String detail;
  final String customer;
  final String list;
  final String assignedTo;
  final String dueDate;
  final String createdBy;
  final String createdDate;
  final String createdAgo;
  final String lastAction;
  final JobStatus status;
  final JobPriority priority;

  factory DashboardListItem.fromCrmJob(CrmJob job) => DashboardListItem(
    enquiryNumber: job.number.isEmpty ? job.id.toString() : job.number,
    title: job.title,
    customer: job.customer,
    list: job.list,
    assignedTo: job.assignedTo,
    dueDate: job.dueDate,
    createdBy: job.createdBy,
    createdDate: _shortDate(job.createdAt),
    createdAgo: _relativeTime(job.createdAt),
    lastAction: job.lastAction,
    status: switch (job.status) {
      'won' => JobStatus.won,
      'lost' => JobStatus.lost,
      _ => JobStatus.open,
    },
    priority: switch (job.priority) {
      'urgent' => JobPriority.urgent,
      'high' => JobPriority.high,
      _ => JobPriority.normal,
    },
  );
}

enum JobPriority { normal, high, urgent }

enum JobStatus { open, won, lost }

final dashboardListSections = [
  DashboardListSection(label: 'Home', icon: Icons.home, items: []),
  DashboardListSection(
    label: 'Jobs',
    heading: 'My Jobs',
    icon: Icons.business_center,
    isJobs: true,
    items: [],
  ),
  DashboardListSection(
    label: 'Duty',
    icon: Icons.calendar_month,
    items: [
      _simpleItem('D1', 'Customer visit', 'Vee Cee Exports · 11:30 AM'),
      _simpleItem('D2', 'Service follow-up', 'Ramesh Kumar · 2:00 PM'),
      _simpleItem('D3', 'Daily report', 'Submit before 6:00 PM'),
    ],
  ),
  DashboardListSection(
    label: 'Actions',
    icon: Icons.bolt,
    isActions: true,
    items: [],
  ),
];

DashboardListItem _simpleItem(String number, String title, String detail) {
  return DashboardListItem(
    enquiryNumber: number,
    title: title,
    detail: detail,
    customer: '',
    list: '',
    assignedTo: '',
    dueDate: '',
    createdBy: '',
    createdDate: '',
    createdAgo: '',
    lastAction: '',
  );
}

String _relativeTime(DateTime value) {
  final difference = DateTime.now().difference(value.toLocal());
  if (difference.inDays > 0) return '${difference.inDays} days ago';
  if (difference.inHours > 0) return '${difference.inHours} hours ago';
  if (difference.inMinutes > 0) return '${difference.inMinutes} min ago';
  return 'Just now';
}

String _shortDate(DateTime value) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  final local = value.toLocal();
  return '${local.day} ${months[local.month - 1]}';
}

class _LiveState extends StatelessWidget {
  const _LiveState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Text(message, textAlign: TextAlign.center),
    ),
  );
}
