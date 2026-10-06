import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/config/app_config.dart';

class PinSetupPage extends StatefulWidget {
  const PinSetupPage({
    super.key,
    required this.biometricAvailable,
    required this.onComplete,
    this.isReset = false,
  });

  final bool biometricAvailable;
  final Future<void> Function(String pin, bool useBiometric) onComplete;
  final bool isReset;

  @override
  State<PinSetupPage> createState() => _PinSetupPageState();
}

class _PinSetupPageState extends State<PinSetupPage> {
  final _pin = TextEditingController();
  final _confirmation = TextEditingController();
  final _pinFocus = FocusNode();
  final _confirmationFocus = FocusNode();
  bool _useBiometric = false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _pin.dispose();
    _confirmation.dispose();
    _pinFocus.dispose();
    _confirmationFocus.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!RegExp(r'^\d{4}$').hasMatch(_pin.text)) {
      setState(() => _error = 'Use a 4 digit PIN.');
      return;
    }
    if (_pin.text != _confirmation.text) {
      setState(() => _error = 'The PIN values do not match.');
      return;
    }
    setState(() {
      _error = null;
      _saving = true;
    });
    await widget.onComplete(_pin.text, _useBiometric);
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: widget.isReset ? AppBar(title: const Text('Reset PIN')) : null,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.lock_outline_rounded, size: 52),
                  const SizedBox(height: 18),
                  Text(
                    widget.isReset ? 'Create a new PIN' : 'Secure this device',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Your PIN stays active until you reset it. The app requires your password after 10 inactive days.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  _PinField(
                    controller: _pin,
                    focusNode: _pinFocus,
                    label: 'New PIN',
                    autofocus: true,
                    onCompleted: (_) => _confirmationFocus.requestFocus(),
                  ),
                  const SizedBox(height: 14),
                  _PinField(
                    controller: _confirmation,
                    focusNode: _confirmationFocus,
                    label: 'Confirm PIN',
                    onCompleted: (_) {
                      if (!_saving) _save();
                    },
                  ),
                  if (widget.biometricAvailable) ...[
                    const SizedBox(height: 10),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _useBiometric,
                      title: const Text('Use biometric unlock'),
                      subtitle: const Text(
                        'Use your fingerprint or device biometric.',
                      ),
                      onChanged: (value) =>
                          setState(() => _useBiometric = value),
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      _error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ],
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: _saving ? null : _save,
                    child: Text(_saving ? 'Saving...' : 'Save PIN'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class PinUnlockPage extends StatefulWidget {
  const PinUnlockPage({
    super.key,
    required this.email,
    required this.biometricEnabled,
    required this.onPin,
    required this.onBiometric,
    required this.onUsePassword,
  });

  final String email;
  final bool biometricEnabled;
  final Future<bool> Function(String pin) onPin;
  final Future<bool> Function() onBiometric;
  final VoidCallback onUsePassword;

  @override
  State<PinUnlockPage> createState() => _PinUnlockPageState();
}

class _PinUnlockPageState extends State<PinUnlockPage> {
  final _pin = TextEditingController();
  final _pinFocus = FocusNode();
  bool _checking = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.biometricEnabled) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _useBiometric());
    } else {
      WidgetsBinding.instance.addPostFrameCallback((_) => _focusPinInput());
    }
  }

  @override
  void dispose() {
    _pin.dispose();
    _pinFocus.dispose();
    super.dispose();
  }

  Future<void> _unlock() async {
    setState(() {
      _checking = true;
      _error = null;
    });
    final valid = await widget.onPin(_pin.text);
    if (!mounted) return;
    setState(() {
      _checking = false;
      _error = valid ? null : 'Incorrect PIN or expired session.';
    });
    if (!valid) {
      _pin.clear();
      _focusPinInput();
    }
  }

  Future<void> _useBiometric() async {
    setState(() => _checking = true);
    final valid = await widget.onBiometric();
    if (!mounted) return;
    setState(() {
      _checking = false;
      if (!valid) _error = 'Biometric unlock was not completed.';
    });
    if (!valid) _focusPinInput();
  }

  void _focusPinInput() {
    if (!mounted) return;
    _pinFocus.requestFocus();
    SystemChannels.textInput.invokeMethod<void>('TextInput.show');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Icon(Icons.lock_rounded, size: 54),
                      const SizedBox(height: 18),
                      Text(
                        'Unlock ${AppConfig.brandName}',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 6),
                      Text(widget.email, textAlign: TextAlign.center),
                      const SizedBox(height: 24),
                      _PinField(
                        controller: _pin,
                        focusNode: _pinFocus,
                        label: 'PIN',
                        autofocus: true,
                        onCompleted: (_) {
                          if (!_checking) _unlock();
                        },
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 10),
                        Text(
                          _error!,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                      ],
                      const SizedBox(height: 18),
                      FilledButton(
                        onPressed: _checking ? null : _unlock,
                        child: const Text('Unlock'),
                      ),
                      if (widget.biometricEnabled)
                        TextButton.icon(
                          onPressed: _checking ? null : _useBiometric,
                          icon: const Icon(Icons.fingerprint),
                          label: const Text('Use biometric'),
                        ),
                      TextButton(
                        onPressed: widget.onUsePassword,
                        child: const Text('Use email and password'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Align(
              alignment: Alignment.bottomCenter,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(
                  'v${AppConfig.appVersion}',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: const Color(0xFF968D9F),
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class PasswordConfirmationDialog extends StatefulWidget {
  const PasswordConfirmationDialog({super.key, required this.onConfirm});

  final Future<String?> Function(String password) onConfirm;

  @override
  State<PasswordConfirmationDialog> createState() =>
      _PasswordConfirmationDialogState();
}

class _PasswordConfirmationDialogState
    extends State<PasswordConfirmationDialog> {
  final _password = TextEditingController();
  bool _checking = false;
  String? _error;

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    setState(() => _checking = true);
    final error = await widget.onConfirm(_password.text);
    if (!mounted) return;
    if (error == null) {
      Navigator.pop(context, true);
      return;
    }
    setState(() {
      _checking = false;
      _error = error;
    });
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Confirm your password'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _password,
            obscureText: true,
            autofocus: true,
            onSubmitted: (_) => _checking ? null : _confirm(),
            decoration: const InputDecoration(labelText: 'Password'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: _checking ? null : () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _checking ? null : _confirm,
          child: const Text('Continue'),
        ),
      ],
    );
  }
}

class _PinField extends StatefulWidget {
  const _PinField({
    required this.controller,
    required this.focusNode,
    required this.label,
    required this.onCompleted,
    this.autofocus = false,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final String label;
  final ValueChanged<String> onCompleted;
  final bool autofocus;

  @override
  State<_PinField> createState() => _PinFieldState();
}

class _PinFieldState extends State<_PinField> {
  bool _completionSent = false;

  @override
  void initState() {
    super.initState();
    widget.focusNode.addListener(_handleFocusChanged);
  }

  @override
  void didUpdateWidget(covariant _PinField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.focusNode == widget.focusNode) return;
    oldWidget.focusNode.removeListener(_handleFocusChanged);
    widget.focusNode.addListener(_handleFocusChanged);
  }

  @override
  void dispose() {
    widget.focusNode.removeListener(_handleFocusChanged);
    super.dispose();
  }

  void _handleFocusChanged() => setState(() {});

  void _handleChanged(String value) {
    if (value.length < 4) {
      _completionSent = false;
      setState(() {});
      return;
    }
    setState(() {});
    if (_completionSent) return;
    _completionSent = true;
    widget.onCompleted(value);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final value = widget.controller.text;
    return Semantics(
      label: widget.label,
      textField: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.label, style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: widget.focusNode.requestFocus,
            child: Stack(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(4, (index) {
                    final filled = index < value.length;
                    final active =
                        widget.focusNode.hasFocus &&
                        index == value.length.clamp(0, 3);
                    return Container(
                      width: 62,
                      height: 64,
                      margin: const EdgeInsets.symmetric(horizontal: 6),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: colorScheme.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: active
                              ? colorScheme.primary
                              : colorScheme.outlineVariant,
                          width: active ? 2 : 1.25,
                        ),
                      ),
                      child: Text(
                        filled ? '•' : '',
                        style: TextStyle(
                          color: colorScheme.onSurface,
                          fontSize: 32,
                          height: 1,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    );
                  }),
                ),
                Positioned.fill(
                  child: Opacity(
                    opacity: 0.01,
                    child: TextField(
                      controller: widget.controller,
                      focusNode: widget.focusNode,
                      autofocus: widget.autofocus,
                      keyboardType: TextInputType.number,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.oneTimeCode],
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(4),
                      ],
                      onChanged: _handleChanged,
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        counterText: '',
                      ),
                    ),
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
