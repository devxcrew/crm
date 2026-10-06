import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api/techmedia_api.dart';
import '../core/auth/secure_session_store.dart';
import '../core/config/app_config.dart';
import '../core/update/app_update_service.dart';
import '../features/auth/login_page.dart';
import '../features/auth/change_password_dialog.dart';
import '../features/auth/pin_auth_pages.dart';
import '../features/dashboard/dashboard_page.dart';
import 'app_footer_dock.dart';
import 'dashboard_navigation.dart';

class TechMediaFlutterApp extends StatefulWidget {
  const TechMediaFlutterApp({super.key});

  @override
  State<TechMediaFlutterApp> createState() => _TechMediaFlutterAppState();
}

class _TechMediaFlutterAppState extends State<TechMediaFlutterApp>
    with WidgetsBindingObserver {
  final _api = TechMediaApi(AppConfig.apiUrl);
  final _updates = AppUpdateService();
  final _secureSession = SecureSessionStore();
  final _navigatorKey = GlobalKey<NavigatorState>();
  final _dashboardNavigation = DashboardNavigation();
  UserSession? _session;
  StoredSession? _storedSession;
  String _lastEmail = '';
  _AuthStage _stage = _AuthStage.loading;
  var _checkingForUpdate = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadLocalSession();
    _scheduleUpdateCheck();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _dashboardNavigation.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused && _stage == _AuthStage.dashboard) {
      unawaited(_secureSession.touchActivity());
    }
    if (state == AppLifecycleState.resumed && _stage == _AuthStage.dashboard) {
      unawaited(_validateResumedSession());
    }
  }

  Future<void> _validateResumedSession() async {
    final stored = await _secureSession.readSession();
    if (stored == null || !_secureSession.isActive(stored)) {
      await _requirePassword();
      return;
    }
    try {
      final profile = await _api.session(stored.accessToken);
      if (!mounted || _stage != _AuthStage.dashboard) return;
      setState(() {
        _session = UserSession(
          accessToken: stored.accessToken,
          profile: profile,
        );
      });
      await _secureSession.touchActivity();
    } catch (_) {
      await _requirePassword();
    }
  }

  Future<void> _loadLocalSession() async {
    final stored = await _secureSession.readSession();
    final email = await _secureSession.lastEmail() ?? '';
    if (!mounted) return;
    if (stored == null || !_secureSession.isActive(stored)) {
      await _secureSession.clearSession();
      setState(() {
        _lastEmail = email;
        _stage = _AuthStage.login;
      });
      return;
    }
    setState(() {
      _lastEmail = stored.email;
      _storedSession = stored;
      _stage = _AuthStage.unlock;
    });
  }

  Future<void> _signedIn(UserSession session) async {
    await _secureSession.saveLogin(
      email: session.profile.email,
      accessToken: session.accessToken,
    );
    final hasPin = await _secureSession.hasPin();
    if (!mounted) return;
    setState(() {
      _session = session;
      _lastEmail = session.profile.email;
      _stage = hasPin ? _AuthStage.dashboard : _AuthStage.setupPin;
    });
    if (hasPin) _scheduleUpdateCheck();
  }

  Future<void> _savePin(String pin, bool useBiometric) async {
    await _secureSession.setPin(pin, useBiometric: useBiometric);
    if (!mounted) return;
    setState(() => _stage = _AuthStage.dashboard);
    _scheduleUpdateCheck();
  }

  Future<bool> _unlockWithPin(String pin) async {
    if (!await _secureSession.verifyPin(pin)) return false;
    return _restoreServerSession();
  }

  Future<bool> _unlockWithBiometric() async {
    if (!await _secureSession.authenticateBiometric()) return false;
    return _restoreServerSession();
  }

  Future<bool> _restoreServerSession() async {
    final stored = _storedSession;
    if (stored == null || !_secureSession.isActive(stored)) {
      await _requirePassword();
      return false;
    }
    try {
      final profile = await _api.session(stored.accessToken);
      if (!mounted) return false;
      setState(() {
        _session = UserSession(
          accessToken: stored.accessToken,
          profile: profile,
        );
        _stage = _AuthStage.dashboard;
      });
      await _secureSession.touchActivity();
      _scheduleUpdateCheck();
      return true;
    } catch (_) {
      await _requirePassword();
      return false;
    }
  }

  Future<void> _requirePassword() async {
    await _secureSession.clearSession();
    if (!mounted) return;
    setState(() {
      _session = null;
      _storedSession = null;
      _stage = _AuthStage.login;
    });
  }

  Future<void> _signOut() async {
    await _secureSession.clearSession(forgetAccount: true);
    if (!mounted) return;
    setState(() {
      _session = null;
      _storedSession = null;
      _lastEmail = '';
      _stage = _AuthStage.login;
    });
  }

  Future<void> _resetPin() async {
    final session = _session;
    final navigatorContext = _navigatorKey.currentContext;
    if (session == null || navigatorContext == null) return;
    final confirmed = await showDialog<bool>(
      context: navigatorContext,
      builder: (context) => PasswordConfirmationDialog(
        onConfirm: (password) async {
          try {
            final renewed = await _api.signIn(
              email: session.profile.email,
              password: password,
            );
            await _secureSession.saveLogin(
              email: renewed.profile.email,
              accessToken: renewed.accessToken,
            );
            _session = renewed;
            return null;
          } on TechMediaApiException catch (error) {
            return error.message;
          } catch (_) {
            return 'Could not verify your password.';
          }
        },
      ),
    );
    if (confirmed != true || !mounted) return;
    final biometricAvailable = await _secureSession.canUseBiometrics();
    if (!mounted) return;
    await _navigatorKey.currentState?.push<void>(
      MaterialPageRoute(
        builder: (context) => PinSetupPage(
          isReset: true,
          biometricAvailable: biometricAvailable,
          onComplete: (pin, useBiometric) async {
            await _secureSession.setPin(pin, useBiometric: useBiometric);
            if (context.mounted) Navigator.pop(context);
          },
        ),
      ),
    );
  }

  Future<void> _changePassword() async {
    final session = _session;
    final navigatorContext = _navigatorKey.currentContext;
    if (session == null || navigatorContext == null) return;
    final value = await showDialog<PasswordChange>(
      context: navigatorContext,
      builder: (context) => const ChangePasswordDialog(),
    );
    if (value == null) return;
    try {
      final verified = await _api.signIn(
        email: session.profile.email,
        password: value.currentPassword,
      );
      final accessToken = await _api.changePassword(
        accessToken: verified.accessToken,
        profile: session.profile,
        password: value.newPassword,
      );
      await _secureSession.saveLogin(
        email: session.profile.email,
        accessToken: accessToken,
      );
      if (!mounted || !navigatorContext.mounted) return;
      setState(() {
        _session = UserSession(
          accessToken: accessToken,
          profile: session.profile,
        );
      });
      ScaffoldMessenger.of(navigatorContext).showSnackBar(
        const SnackBar(content: Text('Password changed successfully.')),
      );
    } on TechMediaApiException catch (error) {
      if (navigatorContext.mounted) {
        ScaffoldMessenger.of(navigatorContext)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  void _scheduleUpdateCheck() {
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkForUpdate());
  }

  Future<void> _checkForUpdate({bool reportCurrent = false}) async {
    if (_checkingForUpdate) return;
    _checkingForUpdate = true;
    try {
      final release = await _updates.checkForUpdate();
      final appContext = _navigatorKey.currentContext;
      if (!mounted || appContext == null || !appContext.mounted) return;
      if (release == null) {
        if (reportCurrent) {
          ScaffoldMessenger.of(appContext).showSnackBar(
            SnackBar(content: Text('${AppConfig.brandName} is up to date.')),
          );
        }
        return;
      }
      await showDialog<void>(
        context: appContext,
        barrierDismissible: !release.mandatory,
        builder: (context) => _AppUpdateDialog(
          release: release,
          onInstall: () => _installUpdate(release),
        ),
      );
    } on AppUpdateException catch (error) {
      final appContext = _navigatorKey.currentContext;
      if (reportCurrent &&
          mounted &&
          appContext != null &&
          appContext.mounted) {
        ScaffoldMessenger.of(appContext)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      _checkingForUpdate = false;
    }
  }

  Future<void> _installUpdate(AppRelease release) async {
    final appContext = _navigatorKey.currentContext;
    if (appContext == null) return;
    final messenger = ScaffoldMessenger.of(appContext);
    try {
      await _updates.downloadAndInstall(release);
    } on AppUpdatePermissionRequired {
      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(
          content: Text(
            'Allow ${AppConfig.brandName} to install updates, then choose Update again.',
          ),
        ),
      );
    } on AppUpdateException catch (error) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: _navigatorKey,
      debugShowCheckedModeBanner: false,
      title: AppConfig.brandName,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF662C90)),
        scaffoldBackgroundColor: const Color(0xFFF9F7FC),
        useMaterial3: true,
      ),
      builder: (context, child) => _AuthenticatedAppShell(
        navigation: _dashboardNavigation,
        navigatorKey: _navigatorKey,
        showDock: _stage == _AuthStage.dashboard,
        child: child ?? const SizedBox.shrink(),
      ),
      home: _buildHome(),
    );
  }

  Widget _buildHome() {
    switch (_stage) {
      case _AuthStage.loading:
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      case _AuthStage.login:
        return LoginPage(
          api: _api,
          initialEmail: _lastEmail,
          onSignedIn: _signedIn,
        );
      case _AuthStage.setupPin:
        return FutureBuilder<bool>(
          future: _secureSession.canUseBiometrics(),
          builder: (context, snapshot) => PinSetupPage(
            biometricAvailable: snapshot.data ?? false,
            onComplete: _savePin,
          ),
        );
      case _AuthStage.unlock:
        final stored = _storedSession!;
        return PinUnlockPage(
          email: stored.email,
          biometricEnabled: stored.biometricEnabled,
          onPin: _unlockWithPin,
          onBiometric: _unlockWithBiometric,
          onUsePassword: _requirePassword,
        );
      case _AuthStage.dashboard:
        return DashboardPage(
          api: _api,
          session: _session!,
          navigation: _dashboardNavigation,
          onResetPin: _resetPin,
          onChangePassword: _changePassword,
          onCheckForUpdate: () => _checkForUpdate(reportCurrent: true),
          onSignOut: _signOut,
        );
    }
  }
}

enum _AuthStage { loading, login, setupPin, unlock, dashboard }

class _AuthenticatedAppShell extends StatelessWidget {
  const _AuthenticatedAppShell({
    required this.navigation,
    required this.navigatorKey,
    required this.showDock,
    required this.child,
  });

  final DashboardNavigation navigation;
  final GlobalKey<NavigatorState> navigatorKey;
  final bool showDock;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!showDock) return child;
    return AnimatedBuilder(
      animation: navigation,
      builder: (context, _) {
        final keyboardIsVisible = MediaQuery.viewInsetsOf(context).bottom > 0;
        final dockIsVisible = !keyboardIsVisible;
        return Stack(
          children: [
            Padding(
              padding: EdgeInsets.only(bottom: dockIsVisible ? 82 : 0),
              child: child,
            ),
            if (dockIsVisible)
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: SafeArea(
                  top: false,
                  child: AppFooterDock(
                    selectedIndex: navigation.selectedIndex,
                    jobBadgeCount: navigation.jobBadgeCount,
                    chatBadgeCount: navigation.chatBadgeCount,
                    onDestinationSelected: (index) {
                      navigatorKey.currentState?.popUntil(
                        (route) => route.isFirst,
                      );
                      navigation.selectDockDestination(index);
                    },
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _AppUpdateDialog extends StatelessWidget {
  const _AppUpdateDialog({required this.release, required this.onInstall});

  final AppRelease release;
  final Future<void> Function() onInstall;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      icon: const Icon(Icons.system_update_alt_rounded),
      title: Text('CRM ${release.versionName} is ready'),
      content: Text(
        release.notes.isEmpty
            ? 'Download the latest version now?'
            : release.notes,
      ),
      actions: [
        if (!release.mandatory)
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Later'),
          ),
        FilledButton(
          onPressed: () async {
            await onInstall();
          },
          child: const Text('Update'),
        ),
      ],
    );
  }
}
