import 'package:flutter/material.dart';

import '../../core/api/techmedia_api.dart';
import '../../core/auth/secure_session_store.dart';
import 'admin_call_log_page.dart';
import 'home_enquiry_form_page.dart';
import 'call_log_note_store.dart';

class CallLogNotesPage extends StatefulWidget {
  const CallLogNotesPage({
    required this.api,
    required this.session,
    required this.entry,
    super.key,
  });

  final TechMediaApi api;
  final UserSession session;
  final CallLogEntry entry;

  @override
  State<CallLogNotesPage> createState() => _CallLogNotesPageState();
}

class _CallLogNotesPageState extends State<CallLogNotesPage> {
  final _controller = TextEditingController();
  final _composerFocus = FocusNode();
  late final CallLogNoteStore _store;
  List<CallLogNote> _notes = const [];
  var _isLoading = true;
  var _isSaving = false;

  @override
  void initState() {
    super.initState();
    _store = CallLogNoteStore(
      SecureSessionStore(),
      accountEmail: widget.session.profile.email,
    );
    _load();
  }

  @override
  void dispose() {
    _controller.dispose();
    _composerFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    resizeToAvoidBottomInset: false,
    appBar: AppBar(title: const Text('Call notes')),
    body: _isLoading
        ? const Center(child: CircularProgressIndicator())
        : SafeArea(
            child: Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
                    children: [
                      _ContactSummary(entry: widget.entry),
                      const SizedBox(height: 22),
                      Text(
                        'Saved comments',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      if (_notes.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 18),
                          child: Text('No local comments yet.'),
                        )
                      else
                        ..._notes.map((note) => _CallNoteRow(note: note)),
                    ],
                  ),
                ),
                AnimatedPadding(
                  curve: Curves.easeOutCubic,
                  duration: const Duration(milliseconds: 180),
                  padding: EdgeInsets.only(
                    bottom: MediaQuery.viewInsetsOf(context).bottom,
                  ),
                  child: _CommentComposer(
                    controller: _controller,
                    focusNode: _composerFocus,
                    isSaving: _isSaving,
                    onCreateEnquiry: () => _openEnquiry(_notes.firstOrNull),
                    onSave: _saveNote,
                  ),
                ),
              ],
            ),
          ),
  );

  Future<void> _load() async {
    final notes = await _store.read(widget.entry.mobile);
    if (mounted) setState(() => _notes = notes);
    if (mounted) setState(() => _isLoading = false);
    if (mounted) _focusComposer();
  }

  void _focusComposer() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _composerFocus.requestFocus();
    });
  }

  Future<void> _saveNote() async {
    final content = _controller.text.trim();
    if (content.isEmpty) return;
    setState(() => _isSaving = true);
    final note = CallLogNote(
      id: '${DateTime.now().microsecondsSinceEpoch}-${widget.entry.mobile}',
      mobile: widget.entry.mobile,
      content: content,
      createdAt: DateTime.now(),
    );
    await _store.save(note);
    _controller.clear();
    await _load();
    if (mounted) setState(() => _isSaving = false);
  }

  Future<void> _openEnquiry(CallLogNote? note) async {
    final posted = await Navigator.of(context).push<CrmJob>(
      MaterialPageRoute(
        builder: (context) => HomeEnquiryFormPage(
          api: widget.api,
          session: widget.session,
          initialMobile: widget.entry.mobile,
          initialMessage: note?.content ?? '',
        ),
      ),
    );
    if (posted == null || note == null) return;
    await _store.remove(note.id);
    await _load();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Enquiry #${posted.number} posted.')),
      );
    }
  }
}

class _ContactSummary extends StatelessWidget {
  const _ContactSummary({required this.entry});

  final CallLogEntry entry;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(entry.contactTitle, style: Theme.of(context).textTheme.titleMedium),
      if (entry.hasSavedName) Text(entry.number),
      Text('${entry.directionLabel} · ${entry.displayTime}'),
    ],
  );
}

class _CommentComposer extends StatelessWidget {
  const _CommentComposer({
    required this.controller,
    required this.focusNode,
    required this.isSaving,
    required this.onCreateEnquiry,
    required this.onSave,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool isSaving;
  final VoidCallback onCreateEnquiry;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface),
    child: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Transform.translate(
              offset: const Offset(0, -8),
              child: FloatingActionButton.small(
                elevation: 4,
                tooltip: 'Create enquiry',
                onPressed: onCreateEnquiry,
                child: const Icon(Icons.add_rounded),
              ),
            ),
            const SizedBox(height: 2),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: controller,
                    focusNode: focusNode,
                    minLines: 1,
                    maxLines: 3,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: Theme.of(context).dividerColor,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: Theme.of(context).colorScheme.primary,
                          width: 1.5,
                        ),
                      ),
                      hintText: 'Write a comment only',
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                IconButton.filled(
                  tooltip: 'Add comment',
                  onPressed: isSaving ? null : onSave,
                  icon: const Icon(Icons.send_rounded),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

class _CallNoteRow extends StatelessWidget {
  const _CallNoteRow({required this.note});

  final CallLogNote note;

  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: const EdgeInsets.symmetric(vertical: 4),
    title: Text(note.content),
    subtitle: Text(_formatNoteTime(note.createdAt)),
  );
}

String _formatNoteTime(DateTime value) {
  final local = value.toLocal();
  final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final period = local.hour >= 12 ? 'pm' : 'am';
  return '${local.day}/${local.month}/${local.year} · $hour:${local.minute.toString().padLeft(2, '0')} $period';
}
