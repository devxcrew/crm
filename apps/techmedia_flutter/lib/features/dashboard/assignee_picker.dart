import 'package:flutter/material.dart';

import '../../core/api/techmedia_api.dart';

class AssigneePicker extends StatelessWidget {
  const AssigneePicker({
    required this.assignees,
    required this.value,
    required this.onChanged,
    super.key,
  });

  final List<CrmCallEnquiryAssignee> assignees;
  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    if (assignees.length <= 10) {
      return DropdownButtonFormField<String?>(
        initialValue: value,
        decoration: const InputDecoration(labelText: 'Allocated'),
        items: [
          const DropdownMenuItem<String?>(
            value: null,
            child: Text('Not allocated'),
          ),
          ...assignees.map(
            (user) => DropdownMenuItem<String?>(
              value: user.id,
              child: Text(user.name),
            ),
          ),
        ],
        onChanged: onChanged,
      );
    }

    final selected = assignees.where((user) => user.id == value).firstOrNull;
    return InkWell(
      borderRadius: BorderRadius.circular(4),
      onTap: () => _showSearch(context),
      child: InputDecorator(
        decoration: const InputDecoration(
          labelText: 'Allocated',
          suffixIcon: Icon(Icons.arrow_drop_down_rounded),
        ),
        child: Text(selected?.name ?? 'Not allocated'),
      ),
    );
  }

  Future<void> _showSearch(BuildContext context) async {
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => _AssigneeSearchSheet(assignees: assignees),
    );
    if (result == null) return;
    onChanged(result.isEmpty ? null : result);
  }
}

class _AssigneeSearchSheet extends StatefulWidget {
  const _AssigneeSearchSheet({required this.assignees});

  final List<CrmCallEnquiryAssignee> assignees;

  @override
  State<_AssigneeSearchSheet> createState() => _AssigneeSearchSheetState();
}

class _AssigneeSearchSheetState extends State<_AssigneeSearchSheet> {
  var _query = '';

  @override
  Widget build(BuildContext context) {
    final matches = widget.assignees
        .where((user) => user.name.toLowerCase().contains(_query))
        .toList();
    return SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * .7,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Allocate enquiry',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              TextField(
                autofocus: true,
                onChanged: (value) =>
                    setState(() => _query = value.trim().toLowerCase()),
                decoration: const InputDecoration(
                  hintText: 'Search people',
                  prefixIcon: Icon(Icons.search_rounded),
                ),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: ListView(
                  children: [
                    ListTile(
                      title: const Text('Not allocated'),
                      onTap: () => Navigator.pop(context, ''),
                    ),
                    if (matches.isEmpty)
                      const Padding(
                        padding: EdgeInsets.all(24),
                        child: Center(child: Text('No matching people.')),
                      )
                    else
                      ...matches.map(
                        (user) => ListTile(
                          title: Text(user.name),
                          onTap: () => Navigator.pop(context, user.id),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
