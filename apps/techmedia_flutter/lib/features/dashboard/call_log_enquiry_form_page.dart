import 'package:flutter/material.dart';

import '../../core/api/techmedia_api.dart';
import 'admin_call_log_page.dart';

class CallLogEnquiryFormPage extends StatefulWidget {
  const CallLogEnquiryFormPage({
    required this.api,
    required this.session,
    required this.entry,
    this.initialMessage = '',
    super.key,
  });

  final TechMediaApi api;
  final UserSession session;
  final CallLogEntry entry;
  final String initialMessage;

  @override
  State<CallLogEnquiryFormPage> createState() => _CallLogEnquiryFormPageState();
}

class _CallLogEnquiryFormPageState extends State<CallLogEnquiryFormPage> {
  final _messageController = TextEditingController();
  final _messageFocus = FocusNode();
  Future<CrmCallEnquiryFormData>? _formData;
  CrmCallEnquiryFormData? _loadedFormData;
  String? _group;
  String? _assignee;
  var _isSaving = false;
  var _requestedMessageFocus = false;

  @override
  void initState() {
    super.initState();
    _messageController.text = widget.initialMessage;
    _formData = widget.api.callEnquiryFormData(widget.session.accessToken);
  }

  @override
  void dispose() {
    _messageController.dispose();
    _messageFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!isCallLogAdministrator(widget.session.profile.role)) {
      return const Scaffold(
        body: Center(child: Text('Administrator access is required.')),
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text('New enquiry'),
        actions: [
          TextButton(
            onPressed: _loadedFormData == null || _isSaving
                ? null
                : () => _save(_loadedFormData!),
            child: _isSaving
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save'),
          ),
        ],
      ),
      body: FutureBuilder<CrmCallEnquiryFormData>(
        future: _formData,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return _FormError(
              onRetry: _reload,
              message: 'Could not load enquiry form options.',
            );
          }
          if (!snapshot.hasData)
            return const Center(child: CircularProgressIndicator());
          _focusMessage();
          final formData = snapshot.data!;
          _loadedFormData = formData;
          _group ??= formData.groups
              .firstWhere(
                (group) => group.value.toLowerCase() == 'calls',
                orElse: () => formData.groups.isEmpty
                    ? const CrmCallEnquiryGroup(label: '', value: '')
                    : formData.groups.first,
              )
              .value;
          final selectedGroup = formData.groups
              .where((group) => group.value == _group)
              .firstOrNull;
          final selectedAssignee = formData.assignees
              .where((assignee) => assignee.id == _assignee)
              .firstOrNull;
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
            children: [
              _ContactHeader(entry: widget.entry),
              const SizedBox(height: 20),
              DropdownButtonFormField<String>(
                initialValue: _group,
                decoration: const InputDecoration(labelText: 'List'),
                items: formData.groups
                    .map(
                      (group) => DropdownMenuItem(
                        value: group.value,
                        child: Text(group.label),
                      ),
                    )
                    .toList(),
                onChanged: (value) => setState(() => _group = value),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String?>(
                initialValue: _assignee,
                decoration: const InputDecoration(labelText: 'Allocated'),
                items: [
                  const DropdownMenuItem<String?>(
                    value: null,
                    child: Text('Not allocated'),
                  ),
                  ...formData.assignees.map(
                    (user) => DropdownMenuItem<String?>(
                      value: user.id,
                      child: Text(user.name),
                    ),
                  ),
                ],
                onChanged: (value) => setState(() => _assignee = value),
              ),
              const SizedBox(height: 20),
              if (_messageController.text.trim().isNotEmpty) ...[
                _EnquiryPreviewCard(
                  title: _titleFromMessage(_messageController.text),
                  message: _messageController.text,
                  list: selectedGroup?.label ?? 'Choose a list',
                  allocatedTo: selectedAssignee?.name ?? 'Not allocated',
                ),
                const SizedBox(height: 20),
              ],
              TextField(
                controller: _messageController,
                focusNode: _messageFocus,
                minLines: 5,
                maxLines: 8,
                textCapitalization: TextCapitalization.sentences,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  alignLabelWithHint: true,
                  labelText: 'Message',
                  border: _messageBorder(),
                  enabledBorder: _messageBorder(),
                  focusedBorder: _messageBorder(
                    color: Theme.of(context).colorScheme.primary,
                    width: 1.5,
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _reload() => setState(() {
    _requestedMessageFocus = false;
    _loadedFormData = null;
    _formData = widget.api.callEnquiryFormData(widget.session.accessToken);
  });

  void _focusMessage() {
    if (_requestedMessageFocus) return;
    _requestedMessageFocus = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _messageFocus.requestFocus();
    });
  }

  Future<void> _save(CrmCallEnquiryFormData formData) async {
    final message = _messageController.text.trim();
    if (message.isEmpty || _group == null || _group!.isEmpty) {
      _showMessage('Add a list and message before posting.');
      return;
    }
    setState(() => _isSaving = true);
    try {
      final job = await widget.api.createCallEnquiry(
        accessToken: widget.session.accessToken,
        mobile: widget.entry.mobile,
        customerName: widget.entry.savedName,
        title: _titleFromMessage(message),
        enquiryGroup: _group!,
        assignedToUserId: _assignee,
        message: message,
        direction: widget.entry.direction,
        durationSeconds: widget.entry.durationSeconds,
        occurredAt: widget.entry.timestamp,
      );
      if (mounted) Navigator.pop(context, job);
    } on TechMediaApiException catch (error) {
      _showMessage(error.message);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }
}

OutlineInputBorder _messageBorder({
  Color color = const Color(0xFFD7CFDB),
  double width = 1,
}) => OutlineInputBorder(
  borderRadius: BorderRadius.circular(12),
  borderSide: BorderSide(color: color, width: width),
);

String _titleFromMessage(String message) {
  final normalized = message.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (normalized.isEmpty) return 'New enquiry';
  const maximumLength = 44;
  if (normalized.length <= maximumLength) return normalized;
  return '${normalized.substring(0, maximumLength - 1).trimRight()}…';
}

class _EnquiryPreviewCard extends StatelessWidget {
  const _EnquiryPreviewCard({
    required this.title,
    required this.message,
    required this.list,
    required this.allocatedTo,
  });

  final String title;
  final String message;
  final String list;
  final String allocatedTo;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    elevation: 2,
    shadowColor: const Color(0x24251B2A),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
      side: const BorderSide(color: Color(0xFFE2DCE5)),
    ),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1DDF5),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  list.toUpperCase(),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: const Color(0xFF682A82),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const Spacer(),
              const Icon(Icons.preview_outlined, size: 18),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            message.trim(),
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium
                ?.copyWith(color: const Color(0xFF625C66)),
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(Icons.person_outline_rounded, size: 18),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  'Allocated to $allocatedTo',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

class _ContactHeader extends StatelessWidget {
  const _ContactHeader({required this.entry});

  final CallLogEntry entry;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      CircleAvatar(
        backgroundColor: entry.color.withValues(alpha: 0.13),
        child: Icon(entry.icon),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              entry.contactTitle,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            if (entry.hasSavedName) Text(entry.number),
            Text('${entry.directionLabel} · ${entry.displayTime}'),
          ],
        ),
      ),
    ],
  );
}

class _FormError extends StatelessWidget {
  const _FormError({required this.onRetry, required this.message});

  final VoidCallback onRetry;
  final String message;

  @override
  Widget build(BuildContext context) => Center(
    child: FilledButton.tonal(onPressed: onRetry, child: Text(message)),
  );
}
