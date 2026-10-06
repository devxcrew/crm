import 'package:flutter/material.dart';

import '../../core/api/techmedia_api.dart';
import 'dashboard_list_page.dart';
import 'home_enquiry_form_page.dart';
import 'job_enquiry_card.dart';

class MyEnquiriesPage extends StatefulWidget {
  const MyEnquiriesPage({required this.api, required this.session, super.key});

  final TechMediaApi api;
  final UserSession session;

  @override
  State<MyEnquiriesPage> createState() => _MyEnquiriesPageState();
}

class _MyEnquiriesPageState extends State<MyEnquiriesPage> {
  late Future<List<CrmJob>> _enquiries;
  late Future<CrmCallEnquiryFormData> _formData;
  var _listFilter = '';

  @override
  void initState() {
    super.initState();
    _enquiries = _load();
    _formData = _loadFormData();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('My Enquiries'),
      actions: [
        IconButton(
          tooltip: 'New enquiry',
          onPressed: _openNewEnquiry,
          icon: const Icon(Icons.add_rounded),
        ),
        FutureBuilder<CrmCallEnquiryFormData>(
          future: _formData,
          builder: (context, snapshot) => PopupMenuButton<String>(
            tooltip: 'Filter lists',
            enabled: snapshot.hasData,
            icon: Icon(
              _listFilter.isEmpty
                  ? Icons.filter_list_rounded
                  : Icons.filter_alt_rounded,
            ),
            onSelected: (value) => setState(() => _listFilter = value),
            itemBuilder: (context) => [
              const PopupMenuItem(value: '', child: Text('All lists')),
              ...?snapshot.data?.groups.map(
                (group) =>
                    PopupMenuItem(value: group.value, child: Text(group.label)),
              ),
            ],
          ),
        ),
      ],
    ),
    body: FutureBuilder<List<CrmJob>>(
      future: _enquiries,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) return _LoadError(onRetry: _refresh);
        final allEnquiries = snapshot.data ?? const <CrmJob>[];
        final enquiries = _filter(allEnquiries);
        if (enquiries.isEmpty) {
          return Center(
            child: Text(
              allEnquiries.isEmpty
                  ? 'You have not created any enquiries.'
                  : 'No enquiries are in this list.',
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            itemCount: enquiries.length,
            separatorBuilder: (_, _) => const SizedBox(height: 14),
            itemBuilder: (context, index) => JobEnquiryCard(
              api: widget.api,
              session: widget.session,
              enquiry: DashboardListItem.fromCrmJob(enquiries[index]),
              job: enquiries[index],
              onJobChanged: _refresh,
            ),
          ),
        );
      },
    ),
  );

  Future<List<CrmJob>> _load() =>
      widget.api.createdEnquiries(widget.session.accessToken);

  Future<CrmCallEnquiryFormData> _loadFormData() =>
      widget.api.callEnquiryFormData(widget.session.accessToken);

  Future<void> _refresh() async {
    final enquiries = _load();
    setState(() {
      _enquiries = enquiries;
    });
    await enquiries;
  }

  List<CrmJob> _filter(List<CrmJob> enquiries) {
    if (_listFilter.isEmpty) return enquiries;
    return enquiries
        .where(
          (enquiry) =>
              enquiry.list.trim().toLowerCase() == _listFilter.toLowerCase(),
        )
        .toList();
  }

  Future<void> _openNewEnquiry() async {
    final created = await Navigator.of(context).push<CrmJob>(
      MaterialPageRoute(
        builder: (context) =>
            HomeEnquiryFormPage(api: widget.api, session: widget.session),
      ),
    );
    if (created != null && mounted) await _refresh();
  }
}

class _LoadError extends StatelessWidget {
  const _LoadError({required this.onRetry});

  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: FilledButton.tonal(
      onPressed: onRetry,
      child: const Text('Could not load your enquiries. Retry'),
    ),
  );
}
