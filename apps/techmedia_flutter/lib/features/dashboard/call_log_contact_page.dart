import 'package:flutter/material.dart';

import '../../core/api/techmedia_api.dart';
import 'admin_call_log_page.dart';
import 'call_log_notes_page.dart';

class CallLogContactPage extends StatefulWidget {
  const CallLogContactPage({
    required this.api,
    required this.session,
    required this.entry,
    super.key,
  });

  final TechMediaApi api;
  final UserSession session;
  final CallLogEntry entry;

  @override
  State<CallLogContactPage> createState() => _CallLogContactPageState();
}

class _CallLogContactPageState extends State<CallLogContactPage> {
  Future<List<CrmJob>>? _enquiries;

  @override
  void initState() {
    super.initState();
    _enquiries = _loadEnquiries();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.entry.contactTitle)),
    floatingActionButton: FloatingActionButton(
      tooltip: 'Add enquiry comment',
      onPressed: _openNotes,
      child: const Icon(Icons.add_rounded),
    ),
    body: FutureBuilder<List<CrmJob>>(
      future: _enquiries,
      builder: (context, snapshot) {
        if (snapshot.hasError) return _LoadError(onRetry: _reload);
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final enquiries = snapshot.data!;
        return RefreshIndicator(
          onRefresh: _reload,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 96),
            children: [
              _ContactSummary(entry: widget.entry),
              const SizedBox(height: 24),
              Text(
                'Existing enquiries',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              if (enquiries.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Text('No existing enquiries for this mobile number.'),
                )
              else
                ...enquiries.map((enquiry) => _EnquiryCard(enquiry: enquiry)),
            ],
          ),
        );
      },
    ),
  );

  Future<List<CrmJob>> _loadEnquiries() async {
    final matches = await widget.api.mobileEnquiries(
      accessToken: widget.session.accessToken,
      mobile: widget.entry.mobile,
    );
    final enquiries = await Future.wait(
      matches.map(
        (match) => widget.api.job(widget.session.accessToken, match.frappeName),
      ),
    );
    enquiries.sort((left, right) => right.createdAt.compareTo(left.createdAt));
    return enquiries;
  }

  Future<void> _reload() async {
    setState(() => _enquiries = _loadEnquiries());
    await _enquiries;
  }

  Future<void> _openNotes() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) => CallLogNotesPage(
          api: widget.api,
          session: widget.session,
          entry: widget.entry,
        ),
      ),
    );
    if (mounted) await _reload();
  }
}

class _ContactSummary extends StatelessWidget {
  const _ContactSummary({required this.entry});

  final CallLogEntry entry;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(entry.contactTitle, style: Theme.of(context).textTheme.titleLarge),
      if (entry.hasSavedName) Text(entry.number),
      const SizedBox(height: 4),
      Text('${entry.directionLabel} · ${entry.displayTime}'),
    ],
  );
}

class _EnquiryCard extends StatelessWidget {
  const _EnquiryCard({required this.enquiry});

  final CrmJob enquiry;

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 12),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '#${enquiry.number} · ${enquiry.title}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              _StatusBadge(status: enquiry.status),
            ],
          ),
          const SizedBox(height: 5),
          Text(
            'Created by ${enquiry.createdBy} · ${_formatTime(enquiry.createdAt)}',
          ),
          const SizedBox(height: 14),
          Text('Comments', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 6),
          if (enquiry.comments.isEmpty)
            const Text('No comments yet.')
          else
            ...enquiry.comments.map(
              (comment) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  '${comment.comment}\n${comment.createdByUserId} · ${_formatTime(comment.createdAt)}',
                ),
              ),
            ),
        ],
      ),
    ),
  );
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.secondaryContainer,
      borderRadius: BorderRadius.circular(20),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      child: Text(status, style: Theme.of(context).textTheme.labelSmall),
    ),
  );
}

class _LoadError extends StatelessWidget {
  const _LoadError({required this.onRetry});

  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: FilledButton.tonal(
      onPressed: onRetry,
      child: const Text('Could not load live enquiries. Retry'),
    ),
  );
}

String _formatTime(DateTime value) {
  final local = value.toLocal();
  final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final period = local.hour >= 12 ? 'pm' : 'am';
  return '${local.day}/${local.month}/${local.year} · $hour:${local.minute.toString().padLeft(2, '0')} $period';
}
