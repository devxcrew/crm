import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/techmedia_api.dart';
import '../../core/auth/secure_session_store.dart';
import '../../core/config/app_config.dart';
import '../../core/presentation/app_brand_logo.dart';
import '../../core/messaging/live_message_notifications.dart';
import '../../core/notifications/mobile_notification_service.dart';
import '../../app/dashboard_navigation.dart';
import 'action_activity_page.dart';
import 'admin_call_log_page.dart';
import 'dashboard_home.dart';
import 'dashboard_jobs_feed.dart';
import 'dashboard_list_page.dart';
import 'duty_page.dart';
import 'job_start_countdown.dart';
import 'job_start_store.dart';
import 'messages_sample_page.dart';
import 'my_enquiries_page.dart';
import 'home_enquiry_form_page.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({
    super.key,
    required this.api,
    required this.session,
    required this.navigation,
    required this.onSignOut,
    this.onResetPin,
    this.onCheckForUpdate,
    this.onChangePassword,
    this.enableLiveNotifications = true,
  });

  final TechMediaApi api;
  final UserSession session;
  final DashboardNavigation navigation;
  final VoidCallback onSignOut;
  final Future<void> Function()? onResetPin;
  final Future<void> Function()? onCheckForUpdate;
  final Future<void> Function()? onChangePassword;
  final bool enableLiveNotifications;

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  var _homeRefreshKey = 0;
  final _messagesPageKey = GlobalKey<MessagesPageState>();
  late final LiveMessageNotifications _messageNotifications;
  late final MobileNotificationService _mobileNotifications;
  late final DashboardJobsFeed _jobsFeed;
  late final JobStartStore _jobStartStore;

  @override
  void initState() {
    super.initState();
    _mobileNotifications = MobileNotificationService(
      api: widget.api,
      session: widget.session,
    );
    _messageNotifications = LiveMessageNotifications(
      api: widget.api,
      session: widget.session,
      onNewUnreadMessages: (count) =>
          unawaited(_mobileNotifications.showChatAlert(count)),
    );
    _jobsFeed = DashboardJobsFeed(api: widget.api, session: widget.session)
      ..start();
    widget.navigation.addListener(_onNavigationChanged);
    _messageNotifications.addListener(_updateBadges);
    _mobileNotifications.addListener(_updateBadges);
    _jobStartStore = JobStartStore(SecureSessionStore());
    unawaited(_restorePendingJobStarts());
    if (widget.enableLiveNotifications) {
      unawaited(_messageNotifications.start());
      unawaited(_mobileNotifications.start());
    }
  }

  Future<void> _restorePendingJobStarts() {
    return JobStartCountdown.instance.restore(
      store: _jobStartStore,
      onElapsed: (jobId) async {
        await widget.api.startJob(
          accessToken: widget.session.accessToken,
          id: jobId,
        );
        await _jobsFeed.refresh();
      },
    );
  }

  @override
  void dispose() {
    widget.navigation.removeListener(_onNavigationChanged);
    _messageNotifications.removeListener(_updateBadges);
    _mobileNotifications.removeListener(_updateBadges);
    _messageNotifications.dispose();
    _mobileNotifications.dispose();
    _jobsFeed.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([
        _messageNotifications,
        _mobileNotifications,
      ]),
      builder: (context, _) => Scaffold(
        appBar: AppBar(
          toolbarHeight: 56,
          titleSpacing: 20,
          title: Row(
            children: [
              const AppBrandLogo(height: 28, width: 34),
              const SizedBox(width: 9),
              Text(AppConfig.brandName),
              if (_selectedIndex == 1 || _selectedIndex == 3) ...[
                const SizedBox(width: 12),
                Container(height: 28, width: 1, color: const Color(0xFFD7D1DA)),
                const SizedBox(width: 12),
                Text(
                  _selectedIndex == 1 ? 'My Jobs' : 'Chat',
                  style: Theme.of(context).textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
              ],
            ],
          ),
          actions: switch (_selectedIndex) {
            0 => [
              PopupMenuButton<_HomeMenuAction>(
                tooltip: 'Account options',
                icon: const Icon(Icons.more_vert_rounded),
                onSelected: _handleHomeMenuAction,
                itemBuilder: (context) => [
                  PopupMenuItem<_HomeMenuAction>(
                    enabled: false,
                    child: _AccountMenuHeader(profile: widget.session.profile),
                  ),
                  const PopupMenuDivider(),
                  PopupMenuItem(
                    value: _HomeMenuAction.resetPin,
                    child: _HomeMenuItem(
                      icon: Icons.pin_outlined,
                      label: 'Reset PIN',
                    ),
                  ),
                  PopupMenuItem(
                    value: _HomeMenuAction.changePassword,
                    child: _HomeMenuItem(
                      icon: Icons.lock_reset_outlined,
                      label: 'Change password',
                    ),
                  ),
                  PopupMenuDivider(),
                  PopupMenuItem<_HomeMenuAction>(
                    enabled: false,
                    child: _CurrentVersionMenuItem(
                      version: AppConfig.appVersion,
                    ),
                  ),
                  PopupMenuItem(
                    value: _HomeMenuAction.checkForUpdates,
                    child: _HomeMenuItem(
                      icon: Icons.system_update_alt_rounded,
                      label: 'Check for updates',
                    ),
                  ),
                  PopupMenuDivider(),
                  PopupMenuItem(
                    value: _HomeMenuAction.signOut,
                    child: _HomeMenuItem(icon: Icons.logout, label: 'Sign out'),
                  ),
                ],
              ),
            ],
            3 => [
              IconButton(
                tooltip: 'New chat',
                onPressed: () => _messagesPageKey.currentState?.openNewChat(),
                icon: const Icon(Icons.add_rounded),
              ),
            ],
            _ => const [],
          },
        ),
        body: SafeArea(top: false, child: _buildBody()),
        floatingActionButton: _selectedIndex == 0
            ? FloatingActionButton(
                tooltip: 'Add',
                onPressed: _showHomeAddMenu,
                child: const Icon(Icons.add_rounded),
              )
            : null,
      ),
    );
  }

  int get _selectedIndex => widget.navigation.selectedIndex;

  Widget _buildBody() {
    if (_selectedIndex == 0) {
      return DashboardHome(
        key: ValueKey(_homeRefreshKey),
        api: widget.api,
        session: widget.session,
        jobsFeed: _jobsFeed,
        onOpenList: _selectDestination,
        onOpenMyEnquiries: _openMyEnquiries,
      );
    }
    if (_selectedIndex == 2) {
      return DutyPage(api: widget.api, session: widget.session);
    }
    if (_selectedIndex == 3) {
      return MessagesPage(
        key: _messagesPageKey,
        api: widget.api,
        session: widget.session,
        embedded: true,
      );
    }
    return DashboardListPage(
      api: widget.api,
      session: widget.session,
      jobsFeed: _jobsFeed,
      section: dashboardListSections[_selectedIndex],
    );
  }

  void _onNavigationChanged() {
    if (!mounted) return;
    setState(() {});
    if (widget.navigation.takeMenuRequest()) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _showMenu();
      });
    }
  }

  void _updateBadges() => widget.navigation.updateBadges(
    jobs: _mobileNotifications.assignmentCount,
    chat: _messageNotifications.unreadCount,
  );

  void _selectDestination(int index) => widget.navigation.selectContent(index);

  Future<void> _openCallLogs() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) =>
            AdminCallLogPage(api: widget.api, session: widget.session),
      ),
    );
  }

  Future<void> _openMyEnquiries() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) =>
            MyEnquiriesPage(api: widget.api, session: widget.session),
      ),
    );
  }

  Future<void> _showHomeAddMenu() async {
    final action = await showModalBottomSheet<_HomeAddAction>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: ListTile(
          leading: const Icon(Icons.note_add_outlined),
          title: const Text('New enquiry'),
          subtitle: const Text('Create a new CRM enquiry.'),
          onTap: () => Navigator.pop(context, _HomeAddAction.newEnquiry),
        ),
      ),
    );
    if (action == _HomeAddAction.newEnquiry && mounted) {
      final created = await Navigator.of(context).push<CrmJob>(
        MaterialPageRoute(
          builder: (context) =>
              HomeEnquiryFormPage(api: widget.api, session: widget.session),
        ),
      );
      if (created != null && mounted) setState(() => _homeRefreshKey += 1);
    }
  }

  void _handleHomeMenuAction(_HomeMenuAction action) {
    if (action == _HomeMenuAction.signOut) {
      widget.onSignOut();
      return;
    }
    final task = switch (action) {
      _HomeMenuAction.resetPin => widget.onResetPin,
      _HomeMenuAction.changePassword => widget.onChangePassword,
      _HomeMenuAction.checkForUpdates => widget.onCheckForUpdate,
      _HomeMenuAction.signOut => null,
    };
    if (task != null) unawaited(task());
  }

  void _showMenu() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 6, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.calendar_month_outlined),
                  title: const Text('Duty'),
                  subtitle: const Text('View duty schedule and reminders.'),
                  onTap: () {
                    Navigator.pop(context);
                    _selectDestination(2);
                  },
                ),
                if (_canViewCallLogs)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.call_outlined),
                    title: const Text('Call logs'),
                    subtitle: const Text('Admin device calls and CRM logging.'),
                    onTap: () {
                      Navigator.pop(context);
                      _openCallLogs();
                    },
                  ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.bolt_outlined),
                  title: const Text('Actions'),
                  subtitle: const Text('View enquiry activity and follow-ups.'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.of(context).push<void>(
                      MaterialPageRoute(
                        builder: (context) => ActionActivityPage(
                          api: widget.api,
                          session: widget.session,
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  bool get _canViewCallLogs {
    final role = widget.session.profile.role.trim().toLowerCase();
    return const {
      'admin',
      'administrator',
      'super-admin',
      'system-admin',
      'system administrator',
    }.contains(role);
  }
}

enum _HomeMenuAction { resetPin, changePassword, checkForUpdates, signOut }

enum _HomeAddAction { newEnquiry }

class _HomeMenuItem extends StatelessWidget {
  const _HomeMenuItem({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, size: 20),
      const SizedBox(width: 12),
      Expanded(child: Text(label, overflow: TextOverflow.ellipsis)),
    ],
  );
}

class _AccountMenuHeader extends StatelessWidget {
  const _AccountMenuHeader({required this.profile});

  final UserProfile profile;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    mainAxisSize: MainAxisSize.min,
    children: [
      Text('Account', style: Theme.of(context).textTheme.labelLarge),
      const SizedBox(height: 4),
      Text(profile.name, style: Theme.of(context).textTheme.titleSmall),
      Text(profile.email, style: Theme.of(context).textTheme.bodySmall),
    ],
  );
}

class _CurrentVersionMenuItem extends StatelessWidget {
  const _CurrentVersionMenuItem({required this.version});

  final String version;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      const Icon(Icons.info_outline_rounded, size: 20),
      const SizedBox(width: 12),
      Expanded(child: Text('Current version $version')),
    ],
  );
}
