import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:techmedia_flutter/core/api/techmedia_api.dart';
import 'package:techmedia_flutter/core/auth/secure_session_store.dart';
import 'package:techmedia_flutter/core/update/app_update_service.dart';
import 'package:techmedia_flutter/app/app_footer_dock.dart';
import 'package:techmedia_flutter/app/dashboard_navigation.dart';
import 'package:techmedia_flutter/features/auth/login_page.dart';
import 'package:techmedia_flutter/features/auth/pin_auth_pages.dart';
import 'package:techmedia_flutter/features/dashboard/dashboard_list_page.dart';
import 'package:techmedia_flutter/features/dashboard/dashboard_page.dart';
import 'package:techmedia_flutter/features/dashboard/job_detail_page.dart';
import 'package:techmedia_flutter/features/dashboard/job_duration.dart';
import 'package:techmedia_flutter/features/dashboard/job_start_countdown.dart';
import 'package:techmedia_flutter/features/dashboard/job_start_store.dart';
import 'package:techmedia_flutter/features/dashboard/call_log_note_store.dart';
import 'package:techmedia_flutter/features/dashboard/messages_sample_page.dart';

void main() {
  test('resets the session after ten inactive days', () {
    final store = SecureSessionStore();
    final current = StoredSession(
      accessToken: 'token',
      email: 'user@techmedia.in',
      lastActivityAt: DateTime.now().toUtc().subtract(const Duration(days: 9)),
      biometricEnabled: false,
    );
    final expired = StoredSession(
      accessToken: 'token',
      email: 'user@techmedia.in',
      lastActivityAt: DateTime.now().toUtc().subtract(const Duration(days: 11)),
      biometricEnabled: false,
    );

    expect(store.isActive(current), isTrue);
    expect(store.isActive(expired), isFalse);
  });

  test('compares app update versions safely', () {
    expect(isNewerVersion('1.0.2', '1.0.1'), isTrue);
    expect(isNewerVersion('1.0.1', '1.0.1'), isFalse);
    expect(isNewerVersion('1.0.0', '1.0.1'), isFalse);
  });

  test('rejects an HTML update response without crashing', () {
    expect(
      () => AppRelease.fromJson({'versionName': '<!doctype html>'}),
      throwsA(isA<AppUpdateException>()),
    );
  });

  test('uses the other member as a direct conversation title', () {
    final conversation = MessagingConversation.fromJson({
      'id': 44,
      'members': [
        {'email': 'vijay@techmedia.in', 'userName': 'Vijay'},
        {'email': 'meera@techmedia.in', 'userName': 'Meera'},
      ],
      'updatedAt': '2026-09-02T10:00:00.000Z',
    }, 'vijay@techmedia.in');

    expect(conversation.title, 'Meera');
  });

  test('converts Frappe rich-text comments to readable mobile text', () {
    final comment = CrmComment.fromJson({
      'id': 'message-1',
      'comment':
          '<p>Test &amp; verify</p><p>Second&nbsp;line<br>Done &#x2713;</p>',
      'createdAt': '2026-08-03T11:42:00.000Z',
      'createdByUserId': 'vijay@example.com',
    });

    expect(comment.comment, 'Test & verify\nSecond line\nDone ✓');
  });

  test('maps Frappe job executions and enquiry activities', () {
    final job = CrmJob.fromJson({
      'id': 762,
      'frappeName': '762',
      'messages': <Object>[],
      'jobs': [
        {
          'name': 'JOBEXE3',
          'employee': 'HR-EMP-00001',
          'createdAt': '2026-08-03T09:17:45.000Z',
          'startTime': '14:47:45',
          'stopTime': '14:48:12',
          'hours': 0.01,
          'employeeCostPerHour': 0,
          'totalCost': 0,
          'status': 'Completed',
        },
      ],
      'activities': [
        {
          'uuid': 'activity-1',
          'action': 'changed',
          'details': 'Vijay changed Status',
          'createdAt': '2026-08-03T09:18:12.000Z',
        },
      ],
    });

    expect(job.jobs.single.name, 'JOBEXE3');
    expect(job.jobs.single.status, 'Completed');
    expect(job.activities.single.details, 'Vijay changed Status');
  });

  test('maps live SOP duties and reporting for mobile', () {
    final duty = HrDuty.fromJson({
      'department': 'Stores - TMR',
      'frequency': 'Daily',
      'index': 1,
      'reports': [
        {
          'actions': '<p>Opening checklist completed.</p>',
          'createdAt': '2026-08-31T05:30:00.000Z',
          'date': '2026-08-31',
          'name': 'REPORTING305',
        },
      ],
      'sopItem': 'SOP-1',
      'sopName': 'Store Opening Check List',
      'steps': '<p>Check the counter.</p>',
    });

    expect(duty.sopItem, 'SOP-1');
    expect(duty.reports.single.actions, 'Opening checklist completed.');
    expect(duty.steps, 'Check the counter.');
  });

  test('formats job duration from actual recorded times', () {
    CrmJobExecution execution({
      required String start,
      String? stop,
      double hours = 0,
    }) => CrmJobExecution(
      name: 'JOBEXE1',
      employee: 'HR-EMP-00001',
      createdAt: DateTime(2026, 8, 30),
      date: '2026-08-30',
      startTime: start,
      stopTime: stop,
      hours: hours,
      employeeCostPerHour: 0,
      totalCost: 0,
      status: stop == null ? 'Running' : 'Completed',
    );

    expect(
      formatJobDuration(execution(start: '09:43:38', stop: '09:43:47')),
      '9 sec',
    );
    expect(
      formatJobDuration(execution(start: '09:43:38', stop: '09:45:12')),
      '1 min',
    );
    expect(
      formatJobDuration(execution(start: '09:43:38', stop: '10:45:12')),
      '1 hr 1 min',
    );
    expect(
      formatJobDuration(
        execution(start: '09:43:38'),
        now: DateTime(2026, 8, 30, 9, 43, 48),
      ),
      '10 sec',
    );
    expect(
      formatJobDuration(execution(start: '', stop: null, hours: 0.5)),
      'Running',
    );
  });

  test('keeps a queued job start cancellable before it is recorded', () {
    const jobId = 'test-pending-job';
    final countdown = JobStartCountdown.instance;
    var recorded = false;

    expect(
      countdown.start(
        jobId: jobId,
        onElapsed: () async {
          recorded = true;
        },
      ),
      isTrue,
    );
    expect(countdown.label(jobId), matches(RegExp(r'^[01] sec$')));
    expect(countdown.isPending(jobId), isTrue);
    expect(countdown.isCancellable(jobId), isTrue);

    countdown.cancel(jobId);

    expect(countdown.isPending(jobId), isFalse);
    expect(recorded, isFalse);
  });

  test('stores pending job deadlines in encrypted device state', () async {
    const channel = MethodChannel(
      'in.techmedia.techmedia_flutter/secure-session',
    );
    final values = <String, String>{};
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
          final key = call.arguments['key'] as String;
          switch (call.method) {
            case 'read':
              return values[key];
            case 'write':
              values[key] = call.arguments['value'] as String;
              return null;
            case 'delete':
              values.remove(key);
              return null;
          }
          return null;
        });
    addTearDown(
      () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, null),
    );

    final store = JobStartStore(SecureSessionStore(channel: channel));
    final deadline = DateTime.now().add(const Duration(seconds: 90));
    await store.write([PersistedJobStart(jobId: '762', deadline: deadline)]);

    final restored = await store.read();
    expect(restored, hasLength(1));
    expect(restored.single.jobId, '762');
    expect(
      restored.single.deadline.difference(deadline).inSeconds.abs(),
      lessThanOrEqualTo(1),
    );

    await store.write(const []);
    expect(await store.read(), isEmpty);
  });

  test('keeps rough call comments on this device until conversion', () async {
    const channel = MethodChannel(
      'in.techmedia.techmedia_flutter/secure-session',
    );
    final values = <String, String>{};
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
          final key = call.arguments['key'] as String;
          switch (call.method) {
            case 'read':
              return values[key];
            case 'write':
              values[key] = call.arguments['value'] as String;
              return null;
            case 'delete':
              values.remove(key);
              return null;
          }
          return null;
        });
    addTearDown(
      () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, null),
    );

    final store = CallLogNoteStore(
      SecureSessionStore(channel: channel),
      accountEmail: 'vijay@techmedia.in',
    );
    final note = CallLogNote(
      id: 'note-1',
      mobile: '9655227738',
      content: 'Sundar asked about a laptop.',
      createdAt: DateTime(2026, 8, 31),
    );
    await store.save(note);

    expect((await store.read('9655227738')).single.content, note.content);
    expect(await store.read('9999999999'), isEmpty);

    await store.remove(note.id);
    expect(await store.read(note.mobile), isEmpty);
  });

  testWidgets('shows the CRM sign-in screen', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: LoginPage(
          api: TechMediaApi('https://app.techmedia.in/api/platform'),
          onSignedIn: (_) {},
        ),
      ),
    );

    expect(find.text('Welcome'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
  });

  testWidgets('unlocks automatically after four PIN digits', (
    WidgetTester tester,
  ) async {
    String? submittedPin;
    await tester.pumpWidget(
      MaterialApp(
        home: PinUnlockPage(
          email: 'vijay@techmedia.in',
          biometricEnabled: false,
          onPin: (pin) async {
            submittedPin = pin;
            return true;
          },
          onBiometric: () async => false,
          onUsePassword: () {},
        ),
      ),
    );

    final pinInput = tester.widget<TextField>(find.byType(TextField));
    expect(pinInput.autofocus, isTrue);

    await tester.enterText(find.byType(TextField), '12345');
    await tester.pump();

    expect(submittedPin, '1234');
    expect(find.text('•'), findsNWidgets(4));
  });

  testWidgets('sets a PIN automatically after both four-digit entries', (
    WidgetTester tester,
  ) async {
    String? savedPin;
    await tester.pumpWidget(
      MaterialApp(
        home: PinSetupPage(
          biometricAvailable: false,
          onComplete: (pin, _) async => savedPin = pin,
        ),
      ),
    );

    final inputs = find.byType(TextField);
    expect(inputs, findsNWidgets(2));
    expect(tester.widget<TextField>(inputs.first).autofocus, isTrue);

    await tester.enterText(inputs.first, '2468');
    await tester.pump();
    await tester.enterText(inputs.last, '2468');
    await tester.pump();

    expect(savedPin, '2468');
  });

  testWidgets('shows the dashboard dock destinations', (
    WidgetTester tester,
  ) async {
    final navigation = DashboardNavigation();
    await tester.pumpWidget(
      MaterialApp(
        home: Stack(
          children: [
            DashboardPage(
              api: TechMediaApi('https://app.techmedia.in/api/platform'),
              session: const UserSession(
                accessToken: 'test-token',
                profile: UserProfile(
                  name: 'Vijay Anand',
                  email: 'vijay@techmedia.in',
                  role: 'admin',
                ),
              ),
              navigation: navigation,
              onSignOut: () {},
              enableLiveNotifications: false,
            ),
            Align(
              alignment: Alignment.bottomCenter,
              child: AppFooterDock(
                selectedIndex: navigation.selectedIndex,
                onDestinationSelected: navigation.selectDockDestination,
              ),
            ),
          ],
        ),
      ),
    );

    expect(find.text('Job'), findsOneWidget);
    expect(find.text('Duty'), findsNothing);
    expect(find.text('Chat'), findsOneWidget);
    expect(find.text('Menu'), findsOneWidget);

    await tester.tap(find.text('Menu'));
    await tester.pumpAndSettle();
    expect(find.text('Duty'), findsOneWidget);
    expect(find.text('Call logs'), findsOneWidget);
    Navigator.of(tester.element(find.text('Duty'))).pop();
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Account options'));
    await tester.pumpAndSettle();
    expect(find.text('Account'), findsOneWidget);
    expect(find.text('vijay@techmedia.in'), findsOneWidget);
    expect(find.text('Sign out'), findsOneWidget);
    Navigator.of(tester.element(find.text('Account'))).pop();
    await tester.pumpAndSettle();

    await tester.tap(find.text('Job'));
    await tester.pump();

    expect(
      find.text('Could not load your assigned enquiries.'),
      findsOneWidget,
    );
  });

  testWidgets('shows the job detail comments and reply flow', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: JobDetailPage(
          api: _FakeTechMediaApi(),
          session: const UserSession(
            accessToken: 'test-token',
            profile: UserProfile(
              email: 'vijay@example.com',
              name: 'Vijay Anand',
              role: 'user',
            ),
          ),
          initialJob: _testCrmJob,
          enquiry: const DashboardListItem(
            enquiryNumber: '762',
            title: 'ROG Asus Adopter 240W',
            customer: 'Vee Cee Exports',
            list: 'Spares',
            assignedTo: 'Vijay Anand',
            dueDate: '03 Aug',
            createdBy: 'Vijay Anand',
            createdAgo: '3 days ago',
            lastAction: 'Awaiting customer confirmation',
          ),
        ),
      ),
    );

    expect(find.text('#762  Open'), findsOneWidget);
    expect(find.text('Comments'), findsNothing);
    expect(find.text('Jobs'), findsNothing);
    expect(find.text('Activity'), findsNothing);

    await tester.tap(find.byTooltip('Add action'));
    await tester.pumpAndSettle();
    expect(find.text('Scan document'), findsOneWidget);
    expect(find.text('Take photo'), findsOneWidget);
    expect(find.text('Log location'), findsOneWidget);
    expect(find.text('Mark completed'), findsOneWidget);
    expect(find.text('Charges'), findsOneWidget);
    expect(find.text('Collected Rs.'), findsOneWidget);
    Navigator.of(tester.element(find.text('Scan document'))).pop();
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byType(TextField),
      'Customer asked for a quotation update.',
    );
    await tester.tap(find.byTooltip('Send reply'));
    await tester.pumpAndSettle();

    expect(find.text('Customer asked for a quotation update.'), findsOneWidget);
  });

  testWidgets('shows the live Messages loading state', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: MessagesPage(
          api: TechMediaApi('https://app.techmedia.in/api/platform'),
          session: const UserSession(
            accessToken: 'test-token',
            profile: UserProfile(
              name: 'Vijay Anand',
              email: 'vijay@techmedia.in',
              role: 'admin',
            ),
          ),
        ),
      ),
    );

    expect(find.text('Messages'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}

final _testCrmJob = CrmJob(
  id: 762,
  sourceId: '762',
  number: '762',
  title: 'ROG Asus Adopter 240W',
  customer: 'Vee Cee Exports',
  list: 'Spares',
  dueDate: '03 Aug',
  createdBy: 'Vijay Anand',
  createdAt: DateTime(2026, 8, 3),
  lastAction: 'Awaiting customer confirmation',
  status: 'open',
  priority: 'normal',
  comments: const [],
  jobs: const [],
  activities: const [],
);

class _FakeTechMediaApi extends TechMediaApi {
  _FakeTechMediaApi() : super('https://app.techmedia.in/api/platform');

  CrmJob _job = _testCrmJob;

  @override
  Future<CrmJob> job(String accessToken, String id) async => _job;

  @override
  Future<CrmJob> addJobComment({
    required String accessToken,
    required String id,
    required String comment,
  }) async {
    _job = CrmJob(
      id: _job.id,
      sourceId: _job.sourceId,
      number: _job.number,
      title: _job.title,
      customer: _job.customer,
      list: _job.list,
      dueDate: _job.dueDate,
      createdBy: _job.createdBy,
      createdAt: _job.createdAt,
      lastAction: comment,
      status: _job.status,
      priority: _job.priority,
      comments: [
        ..._job.comments,
        CrmComment(
          id: 'new-comment',
          comment: comment,
          createdAt: DateTime.now(),
          createdByUserId: 'vijay@example.com',
        ),
      ],
      jobs: _job.jobs,
      activities: _job.activities,
    );
    return _job;
  }
}
