import 'package:flutter/material.dart';

import '../../core/api/techmedia_api.dart';
import 'assignee_picker.dart';

class HomeEnquiryFormPage extends StatefulWidget {
  const HomeEnquiryFormPage({
    required this.api,
    required this.session,
    this.initialCustomer = '',
    this.initialMobile = '',
    this.initialMessage = '',
    super.key,
  });

  final TechMediaApi api;
  final UserSession session;
  final String initialCustomer;
  final String initialMobile;
  final String initialMessage;

  @override
  State<HomeEnquiryFormPage> createState() => _HomeEnquiryFormPageState();
}

class _HomeEnquiryFormPageState extends State<HomeEnquiryFormPage> {
  final _customer = TextEditingController();
  final _mobile = TextEditingController();
  final _message = TextEditingController();
  final _messageFocus = FocusNode();
  late Future<CrmCallEnquiryFormData> _formData;
  String? _group;
  String? _assignee;
  String? _customerId;
  String? _matchedPartyName;
  var _isSaving = false;
  var _focusRequested = false;

  @override
  void initState() {
    super.initState();
    _customer.text = widget.initialCustomer;
    _matchedPartyName = widget.initialCustomer.trim().isEmpty
        ? null
        : widget.initialCustomer.trim();
    _mobile.text = widget.initialMobile;
    _message.text = widget.initialMessage;
    _formData = _loadFormData();
  }

  @override
  void dispose() {
    _customer.dispose();
    _mobile.dispose();
    _message.dispose();
    _messageFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('New enquiry'),
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 8),
          child: FilledButton(
            onPressed: _isSaving ? null : _save,
            style: FilledButton.styleFrom(
              visualDensity: VisualDensity.compact,
              backgroundColor: const Color(0xFF4D1F68),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: _isSaving
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save'),
          ),
        ),
      ],
    ),
    body: FutureBuilder<CrmCallEnquiryFormData>(
      future: _formData,
      builder: (context, snapshot) {
        if (snapshot.hasError) return _FormError(onRetry: _reload);
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final formData = snapshot.data!;
        _group ??= formData.groups.firstOrNull?.value;
        _focusMessage();
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
          children: [
            TextField(
              controller: _mobile,
              keyboardType: TextInputType.phone,
              onChanged: _clearMatchedParty,
              decoration: InputDecoration(
                labelText: 'Phone number',
                suffixIcon: IconButton(
                  tooltip: 'Find contact for this phone number',
                  onPressed: _lookupContact,
                  icon: const Icon(Icons.person_search_outlined),
                ),
              ),
            ),
            if (_matchedPartyName case final name?) ...[
              const SizedBox(height: 6),
              _MatchedPartyLabel(name: name),
            ],
            const SizedBox(height: 16),
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
            AssigneePicker(
              assignees: formData.assignees,
              value: _assignee,
              onChanged: (value) => setState(() => _assignee = value),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _message,
              focusNode: _messageFocus,
              minLines: 5,
              maxLines: 8,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                alignLabelWithHint: true,
                border: OutlineInputBorder(),
                labelText: 'Message',
              ),
            ),
          ],
        );
      },
    ),
  );

  Future<CrmCallEnquiryFormData> _loadFormData() =>
      widget.api.callEnquiryFormData(widget.session.accessToken);

  void _reload() => setState(() {
    _focusRequested = false;
    _formData = _loadFormData();
  });

  void _focusMessage() {
    if (_focusRequested) return;
    _focusRequested = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _messageFocus.requestFocus();
    });
  }

  Future<void> _save() async {
    final message = _message.text.trim();
    final customer = _customer.text.trim();
    final mobile = _mobile.text.replaceAll(RegExp(r'\D'), '');
    if (message.isEmpty || mobile.length != 10 || _group == null) {
      _showMessage('Add a message, 10-digit mobile number, and list.');
      return;
    }
    setState(() => _isSaving = true);
    try {
      final job = await widget.api.createEnquiry(
        accessToken: widget.session.accessToken,
        customer: _customerId ?? customer,
        mobile: mobile,
        title: _titleFromMessage(message),
        enquiryGroup: _group!,
        assignedToUserId: _assignee,
        message: message,
      );
      if (mounted) Navigator.pop(context, job);
    } on TechMediaApiException catch (error) {
      _showMessage(error.message);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _clearMatchedParty(String _) {
    if (_customerId == null && _matchedPartyName == null) return;
    setState(() {
      _customerId = null;
      _matchedPartyName = null;
      _customer.clear();
    });
  }

  Future<void> _lookupContact() async {
    final mobile = _mobile.text.replaceAll(RegExp(r'\D'), '');
    if (mobile.length != 10) {
      _showMessage('Enter the 10-digit phone number to search.');
      return;
    }
    final lookup = _findParties(mobile);
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: FutureBuilder<List<_PartyLookup>>(
          future: lookup,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const SizedBox(
                height: 152,
                child: Center(child: CircularProgressIndicator()),
              );
            }
            if (snapshot.hasError) {
              final error = snapshot.error;
              return SizedBox(
                height: 152,
                child: Center(
                  child: Text(
                    error is TechMediaApiException
                        ? error.message
                        : 'Could not check this contact.',
                  ),
                ),
              );
            }
            final parties = snapshot.data ?? [];
            if (parties.isEmpty) {
              return SizedBox(
                height: 152,
                child: Center(child: Text('No contact found for $mobile.')),
              );
            }
            return ListView(
              shrinkWrap: true,
              children: parties
                  .map(
                    (party) => ListTile(
                      contentPadding: const EdgeInsets.fromLTRB(24, 8, 16, 8),
                      leading: Icon(
                        party.type == 'Customer'
                            ? Icons.person_outline_rounded
                            : Icons.local_shipping_outlined,
                      ),
                      title: Text(party.name),
                      subtitle: Text('${party.type} found for $mobile'),
                      trailing: TextButton(
                        onPressed: () {
                          setState(() {
                            _matchedPartyName = party.name;
                            _customer.text = party.type == 'Customer'
                                ? party.name
                                : '';
                            _customerId = party.type == 'Customer'
                                ? party.id
                                : null;
                          });
                          Navigator.pop(context);
                        },
                        child: const Text('Select'),
                      ),
                    ),
                  )
                  .toList(),
            );
          },
        ),
      ),
    );
  }

  Future<List<_PartyLookup>> _findParties(String mobile) async {
    final parties = await widget.api.partiesByMobile(
      accessToken: widget.session.accessToken,
      mobile: mobile,
    );
    return parties
        .map(
          (party) =>
              _PartyLookup(name: party.name, id: party.id, type: party.type),
        )
        .toList();
  }

  void _showMessage(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
}

class _PartyLookup {
  const _PartyLookup({
    required this.name,
    required this.id,
    required this.type,
  });

  final String name;
  final String id;
  final String type;
}

class _MatchedPartyLabel extends StatelessWidget {
  const _MatchedPartyLabel({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      const Icon(
        Icons.check_circle_outline_rounded,
        color: Color(0xFF23824E),
        size: 16,
      ),
      const SizedBox(width: 6),
      Expanded(
        child: Text(
          name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: const Color(0xFF23824E),
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    ],
  );
}

class _FormError extends StatelessWidget {
  const _FormError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: FilledButton.tonal(
      onPressed: onRetry,
      child: const Text('Could not load enquiry options. Retry'),
    ),
  );
}

String _titleFromMessage(String message) {
  final normalized = message.replaceAll(RegExp(r'\s+'), ' ').trim();
  const limit = 44;
  if (normalized.length <= limit) return normalized;
  return '${normalized.substring(0, limit - 1).trimRight()}…';
}
