import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';

class TechMediaApi {
  TechMediaApi(String baseUrl) : _baseUri = Uri.parse(baseUrl);

  final Uri _baseUri;

  Future<ApiHealth> health() async {
    return ApiHealth.fromJson(await _request('/health'));
  }

  Future<UserSession> signIn({
    required String email,
    required String password,
  }) async {
    final data = await _request(
      '/auth/login',
      body: {'email': email, 'password': password},
      method: 'POST',
    );
    return UserSession.fromJson(data);
  }

  Future<UserProfile> session(String accessToken) async {
    return UserProfile.fromJson(
      await _request('/auth/session', accessToken: accessToken),
    );
  }

  Future<String> changePassword({
    required String accessToken,
    required UserProfile profile,
    required String password,
  }) async {
    final data = await _request(
      '/identity/profile',
      accessToken: accessToken,
      method: 'PUT',
      body: {
        'email': profile.email,
        'name': profile.name,
        'password': password,
      },
    ) as Map<String, dynamic>;
    return data['accessToken'] as String;
  }

  Future<List<CrmJob>> assignedJobs(String accessToken) async {
    final data = await _request(
      '/mobile/crm/jobs',
      accessToken: accessToken,
      query: const {'status': 'active'},
    );
    if (data is! List) {
      throw const TechMediaApiException('Unexpected jobs response.');
    }
    return data.whereType<Map<String, dynamic>>().map(CrmJob.fromJson).toList();
  }

  Future<List<AppNotification>> notifications(String accessToken) async {
    final data = await _request('/notifications', accessToken: accessToken);
    if (data is! List) {
      throw const TechMediaApiException('Unexpected notifications response.');
    }
    return data
        .whereType<Map<String, dynamic>>()
        .map(AppNotification.fromJson)
        .toList();
  }

  Future<List<CrmJob>> createdEnquiries(String accessToken) async {
    final data = await _request(
      '/crm/enquiries',
      accessToken: accessToken,
      query: const {'view': 'created'},
    );
    if (data is! List) {
      throw const TechMediaApiException(
        'Unexpected created enquiries response.',
      );
    }
    return data.whereType<Map<String, dynamic>>().map(CrmJob.fromJson).toList();
  }

  Future<List<CrmJob>> assignedJobDetails(String accessToken) async {
    final jobs = await assignedJobs(accessToken);
    return Future.wait(jobs.map((item) => job(accessToken, item.sourceId)));
  }

  Future<List<CrmCustomerReference>> customerReferences({
    required String accessToken,
    String search = '',
  }) async {
    final data = await _request(
      '/crm/enquiries/customer-references',
      accessToken: accessToken,
      query: search.trim().isEmpty ? const {} : {'search': search.trim()},
    );
    if (data is! List) {
      throw const TechMediaApiException('Unexpected customer lookup response.');
    }
    return data
        .whereType<Map<String, dynamic>>()
        .map(CrmCustomerReference.fromJson)
        .toList();
  }

  Future<List<CrmPartyReference>> partiesByMobile({
    required String accessToken,
    required String mobile,
  }) async {
    final data = await _request(
      '/crm/enquiries/party-by-mobile',
      accessToken: accessToken,
      query: {'mobile': mobile},
    );
    if (data is! List) {
      throw const TechMediaApiException('Unexpected contact lookup response.');
    }
    return data
        .whereType<Map<String, dynamic>>()
        .map(CrmPartyReference.fromJson)
        .toList();
  }

  Future<CrmJob> job(String accessToken, String id) async {
    final data = await _request(
      '/crm/enquiries/${Uri.encodeComponent(id)}',
      accessToken: accessToken,
    );
    return CrmJob.fromJson(data as Map<String, dynamic>);
  }

  Future<List<CrmMobileEnquiryMatch>> mobileEnquiries({
    required String accessToken,
    required String mobile,
  }) async {
    final data = await _request(
      '/crm/enquiries/mobile-matches',
      accessToken: accessToken,
      query: {'mobile': mobile},
    );
    if (data is! List) {
      throw const TechMediaApiException('Unexpected mobile enquiry response.');
    }
    return data
        .whereType<Map<String, dynamic>>()
        .map(CrmMobileEnquiryMatch.fromJson)
        .toList();
  }

  Future<CrmJob> addJobComment({
    required String accessToken,
    required String id,
    required String comment,
  }) async {
    final data = await _request(
      '/mobile/crm/jobs/${Uri.encodeComponent(id)}/comments',
      accessToken: accessToken,
      method: 'POST',
      body: {'comment': comment},
    );
    return CrmJob.fromJson(data as Map<String, dynamic>);
  }

  Future<CrmCallEnquiryFormData> callEnquiryFormData(String accessToken) async {
    final responses = await Future.wait([
      _request('/mobile/crm/options', accessToken: accessToken),
      _request('/crm/enquiries/user-references', accessToken: accessToken),
    ]);
    final options = responses[0] as Map<String, dynamic>;
    final users = responses[1] as List<dynamic>;
    return CrmCallEnquiryFormData(
      groups: (options['groups'] as List<dynamic>)
          .whereType<Map<String, dynamic>>()
          .map(CrmCallEnquiryGroup.fromJson)
          .toList(),
      assignees: users
          .whereType<Map<String, dynamic>>()
          .map(CrmCallEnquiryAssignee.fromJson)
          .toList(),
    );
  }

  Future<CrmJob> createCallEnquiry({
    required String accessToken,
    required String mobile,
    required String customerName,
    required String title,
    required String enquiryGroup,
    required String? assignedToUserId,
    required String message,
    required String direction,
    required int durationSeconds,
    required DateTime occurredAt,
  }) async {
    final data = await _request(
      '/mobile/crm/call-enquiries',
      accessToken: accessToken,
      method: 'POST',
      body: {
        'assignedToUserId': assignedToUserId,
        'customerName': customerName,
        'direction': direction,
        'durationSeconds': durationSeconds,
        'enquiryGroup': enquiryGroup,
        'message': message,
        'mobile': mobile,
        'occurredAt': occurredAt.toUtc().toIso8601String(),
        'title': title,
      },
    );
    return CrmJob.fromJson(data as Map<String, dynamic>);
  }

  Future<CrmJob> createEnquiry({
    required String accessToken,
    required String customer,
    required String mobile,
    required String title,
    required String enquiryGroup,
    required String? assignedToUserId,
    required String message,
  }) async {
    final data = await _request(
      '/crm/enquiries',
      accessToken: accessToken,
      method: 'POST',
      body: {
        'assignedToUserId': assignedToUserId,
        'customer': customer,
        'enquiryDate': null,
        'enquiryGroup': enquiryGroup,
        'messages': [
          {'comment': message, 'mode': 'comment'},
        ],
        'mobile': mobile,
        'priority': 'normal',
        'schedules': const [],
        'status': 'new',
        'title': title,
        'workspace': message,
      },
    );
    return CrmJob.fromJson(data as Map<String, dynamic>);
  }

  Future<CrmJob> startJob({
    required String accessToken,
    required String id,
  }) async {
    final data = await _request(
      '/mobile/crm/jobs/${Uri.encodeComponent(id)}/start',
      accessToken: accessToken,
      method: 'POST',
      body: const {},
    );
    return CrmJob.fromJson(data as Map<String, dynamic>);
  }

  Future<List<HrDuty>> duties(String accessToken) async {
    final data = await _request('/mobile/hr/duties', accessToken: accessToken);
    if (data is! List)
      throw const TechMediaApiException('Unexpected duties response.');
    return data.whereType<Map<String, dynamic>>().map(HrDuty.fromJson).toList();
  }

  Future<HrDuty> reportDuty({
    required String accessToken,
    required String sopItem,
    required String actions,
  }) async {
    final data = await _request(
      '/mobile/hr/duties/${Uri.encodeComponent(sopItem)}/reports',
      accessToken: accessToken,
      method: 'POST',
      body: {'actions': actions},
    );
    return HrDuty.fromJson(data as Map<String, dynamic>);
  }

  Future<CrmJob> stopJob({
    required String accessToken,
    required String id,
    required String jobName,
  }) async {
    final data = await _request(
      '/mobile/crm/jobs/${Uri.encodeComponent(id)}/jobs/${Uri.encodeComponent(jobName)}/stop',
      accessToken: accessToken,
      method: 'POST',
      body: const {},
    );
    return CrmJob.fromJson(data as Map<String, dynamic>);
  }

  Future<List<MessagingConversation>> conversations({
    required String accessToken,
    required String currentEmail,
  }) async {
    final data = await _request(
      '/messaging/conversations',
      accessToken: accessToken,
    );
    if (data is! List) {
      throw const TechMediaApiException('Unexpected conversations response.');
    }
    return data
        .whereType<Map<String, dynamic>>()
        .map((item) => MessagingConversation.fromJson(item, currentEmail))
        .toList();
  }

  Future<List<MessagingContact>> messagingContacts({
    required String accessToken,
    String search = '',
  }) async {
    final data = await _request(
      '/messaging/contacts',
      accessToken: accessToken,
      query: {'search': search},
    );
    if (data is! List) {
      throw const TechMediaApiException('Unexpected contacts response.');
    }
    return data
        .whereType<Map<String, dynamic>>()
        .map(MessagingContact.fromJson)
        .toList();
  }

  Future<MessagingConversation> openDirectConversation({
    required String accessToken,
    required String currentEmail,
    required MessagingContact contact,
  }) async {
    final data = await _request(
      '/messaging/conversations',
      accessToken: accessToken,
      method: 'POST',
      body: {
        'memberIds': [contact.id],
        'type': 'DIRECT',
      },
    );
    return MessagingConversation.fromJson(
      data as Map<String, dynamic>,
      currentEmail,
    );
  }

  Future<List<MessagingMessage>> messages(
    String accessToken,
    int conversationId,
  ) async {
    final data = await _request(
      '/messaging/conversations/$conversationId/messages',
      accessToken: accessToken,
      query: const {'limit': '100'},
    );
    if (data is! List) {
      throw const TechMediaApiException('Unexpected messages response.');
    }
    return data
        .whereType<Map<String, dynamic>>()
        .map(MessagingMessage.fromJson)
        .toList();
  }

  Future<MessagingMessage> sendMessage({
    required String accessToken,
    required int conversationId,
    required String content,
  }) async {
    return MessagingMessage.fromJson(
      await _request(
        '/messaging/conversations/$conversationId/messages',
        accessToken: accessToken,
        method: 'POST',
        body: {
          'clientMessageId':
              '${DateTime.now().microsecondsSinceEpoch}-$conversationId',
          'content': content,
          'type': 'TEXT',
        },
      ) as Map<String, dynamic>,
    );
  }

  Future<void> markConversationRead({
    required String accessToken,
    required int conversationId,
    required int messageId,
  }) async {
    await _request(
      '/messaging/conversations/$conversationId/read',
      accessToken: accessToken,
      method: 'POST',
      body: {'messageId': messageId},
    );
  }

  Future<dynamic> _request(
    String path, {
    String? accessToken,
    Map<String, dynamic>? body,
    String method = 'GET',
    Map<String, String>? query,
  }) async {
    final request = http.Request(
      method,
      _baseUri.replace(path: '${_baseUri.path}$path', queryParameters: query),
    );
    request.headers['Accept'] = 'application/json';
    if (accessToken != null) {
      request.headers['Authorization'] = 'Bearer $accessToken';
    }
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    final response = await request.send();
    final payload = jsonDecode(
      utf8.decode(await response.stream.toBytes()),
    ) as Map<String, dynamic>;
    if (payload['success'] != true || response.statusCode >= 400) {
      final error = payload['error'] as Map<String, dynamic>?;
      throw TechMediaApiException(
        error?['message'] as String? ?? 'Request failed.',
      );
    }
    return payload['data'];
  }
}

class ApiHealth {
  const ApiHealth({required this.isHealthy});

  final bool isHealthy;

  factory ApiHealth.fromJson(Map<String, dynamic> json) {
    return ApiHealth(isHealthy: json['status'] == 'ok');
  }
}

class UserSession {
  const UserSession({required this.accessToken, required this.profile});

  final String accessToken;
  final UserProfile profile;

  factory UserSession.fromJson(Map<String, dynamic> json) {
    return UserSession(
      accessToken: json['accessToken'] as String,
      profile: UserProfile.fromJson(json),
    );
  }
}

class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: json['id'] as int? ?? 0,
        title: json['title'] as String? ?? AppConfig.brandName,
        body: json['body'] as String? ?? '',
        type: json['type'] as String? ?? '',
      );

  final int id;
  final String title;
  final String body;
  final String type;
}

class CrmCustomerReference {
  const CrmCustomerReference({required this.id, required this.name});

  factory CrmCustomerReference.fromJson(Map<String, dynamic> json) =>
      CrmCustomerReference(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
      );

  final String id;
  final String name;
}

class CrmPartyReference extends CrmCustomerReference {
  const CrmPartyReference({
    required super.id,
    required super.name,
    required this.type,
  });

  factory CrmPartyReference.fromJson(Map<String, dynamic> json) =>
      CrmPartyReference(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        type: json['type'] as String? ?? '',
      );

  final String type;
}

class UserProfile {
  const UserProfile({
    required this.email,
    required this.name,
    required this.role,
  });

  final String email;
  final String name;
  final String role;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      email: json['email'] as String,
      name: json['name'] as String? ?? json['email'] as String,
      role: json['role'] as String? ?? 'user',
    );
  }
}

class TechMediaApiException implements Exception {
  const TechMediaApiException(this.message);

  final String message;
}

class CrmCallEnquiryFormData {
  const CrmCallEnquiryFormData({required this.groups, required this.assignees});

  final List<CrmCallEnquiryGroup> groups;
  final List<CrmCallEnquiryAssignee> assignees;
}

class CrmCallEnquiryGroup {
  const CrmCallEnquiryGroup({required this.label, required this.value});

  final String label;
  final String value;

  factory CrmCallEnquiryGroup.fromJson(Map<String, dynamic> json) =>
      CrmCallEnquiryGroup(
        label: json['label'] as String? ?? '',
        value: json['value'] as String? ?? '',
      );
}

class CrmCallEnquiryAssignee {
  const CrmCallEnquiryAssignee({required this.id, required this.name});

  final String id;
  final String name;

  factory CrmCallEnquiryAssignee.fromJson(Map<String, dynamic> json) =>
      CrmCallEnquiryAssignee(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
      );
}

class CrmMobileEnquiryMatch {
  const CrmMobileEnquiryMatch({
    required this.frappeName,
    required this.number,
    required this.title,
    required this.status,
    required this.createdAt,
  });

  final String frappeName;
  final int number;
  final String title;
  final String status;
  final DateTime createdAt;

  factory CrmMobileEnquiryMatch.fromJson(Map<String, dynamic> json) =>
      CrmMobileEnquiryMatch(
        frappeName: json['frappeName'] as String? ?? '',
        number: json['id'] as int? ?? 0,
        title: json['title'] as String? ?? 'Untitled enquiry',
        status: json['status'] as String? ?? 'Open',
        createdAt:
            DateTime.tryParse(json['createdAt'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0),
      );
}

class CrmJob {
  const CrmJob({
    required this.id,
    required this.sourceId,
    required this.number,
    required this.title,
    required this.customer,
    this.mobile = '',
    this.assignedTo = '',
    required this.list,
    required this.dueDate,
    required this.createdBy,
    required this.createdAt,
    required this.lastAction,
    required this.status,
    required this.priority,
    required this.comments,
    required this.jobs,
    required this.activities,
  });

  final int id;
  final String sourceId;
  final String number;
  final String title;
  final String customer;
  final String mobile;
  final String assignedTo;
  final String list;
  final String dueDate;
  final String createdBy;
  final DateTime createdAt;
  final String lastAction;
  final String status;
  final String priority;
  final List<CrmComment> comments;
  final List<CrmJobExecution> jobs;
  final List<CrmActivity> activities;

  factory CrmJob.fromJson(Map<String, dynamic> json) {
    final comments = (json['messages'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
    final schedule = (json['schedules'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
    final customerName = json['customerName'] as String? ?? '';
    final sourceId = json['frappeName'] as String? ?? json['id'].toString();
    return CrmJob(
      id: json['id'] as int,
      sourceId: sourceId,
      number: sourceId.replaceAll(RegExp(r'[^0-9]'), ''),
      title: json['title'] as String? ?? 'Untitled enquiry',
      customer: customerName.isNotEmpty
          ? customerName
          : json['customer'] as String? ?? 'Customer',
      mobile: json['mobile'] as String? ?? '',
      assignedTo: _assignedToName(json['assignedTo']),
      list: json['enquiryGroup'] as String? ?? 'General',
      dueDate: _dateLabel(
        schedule.isEmpty ? null : schedule.first['scheduledOn'] as String?,
      ),
      createdBy:
          (json['createdBy'] as Map<String, dynamic>?)?['name'] as String? ??
          AppConfig.brandName,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
      lastAction: comments.isEmpty
          ? 'No recent activity'
          : comments.last['comment'] as String? ?? 'No recent activity',
      status: json['status'] as String? ?? 'open',
      priority: json['priority'] as String? ?? 'normal',
      comments: comments.map(CrmComment.fromJson).toList(),
      jobs: (json['jobs'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(CrmJobExecution.fromJson)
          .toList(),
      activities: (json['activities'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(CrmActivity.fromJson)
          .toList(),
    );
  }
}

class HrDuty {
  const HrDuty({
    required this.department,
    required this.frequency,
    required this.index,
    required this.reports,
    required this.sopItem,
    required this.sopName,
    required this.steps,
  });

  final String department;
  final String frequency;
  final int index;
  final List<HrDutyReport> reports;
  final String sopItem;
  final String sopName;
  final String steps;

  factory HrDuty.fromJson(Map<String, dynamic> json) => HrDuty(
    department: json['department'] as String? ?? '',
    frequency: json['frequency'] as String? ?? 'Daily',
    index: json['index'] as int? ?? 0,
    reports: (json['reports'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(HrDutyReport.fromJson)
        .toList(),
    sopItem: json['sopItem'] as String? ?? '',
    sopName: json['sopName'] as String? ?? '',
    steps: _plainTextComment(json['steps'] as String? ?? ''),
  );
}

class HrDutyReport {
  const HrDutyReport({
    required this.actions,
    required this.createdAt,
    required this.date,
    required this.name,
  });

  final String actions;
  final DateTime createdAt;
  final String date;
  final String name;

  factory HrDutyReport.fromJson(Map<String, dynamic> json) => HrDutyReport(
    actions: _plainTextComment(json['actions'] as String? ?? ''),
    createdAt:
        DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    date: json['date'] as String? ?? '',
    name: json['name'] as String? ?? '',
  );
}

String _assignedToName(Object? value) {
  if (value is! Map<String, dynamic>) return '';
  return value['title'] as String? ?? value['name'] as String? ?? '';
}

class CrmJobExecution {
  const CrmJobExecution({
    required this.name,
    required this.employee,
    required this.createdAt,
    required this.date,
    required this.startTime,
    required this.stopTime,
    required this.hours,
    required this.employeeCostPerHour,
    required this.totalCost,
    required this.status,
  });

  final String name;
  final String employee;
  final DateTime createdAt;
  final String? date;
  final String startTime;
  final String? stopTime;
  final double hours;
  final double employeeCostPerHour;
  final double totalCost;
  final String status;

  bool get isRunning => status == 'Running';

  factory CrmJobExecution.fromJson(
    Map<String, dynamic> json,
  ) => CrmJobExecution(
    name: json['name'] as String? ?? '',
    employee: json['employee'] as String? ?? '',
    createdAt:
        DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    date: json['date'] as String?,
    startTime: json['startTime'] as String? ?? '',
    stopTime: json['stopTime'] as String?,
    hours: (json['hours'] as num? ?? 0).toDouble(),
    employeeCostPerHour: (json['employeeCostPerHour'] as num? ?? 0).toDouble(),
    totalCost: (json['totalCost'] as num? ?? 0).toDouble(),
    status: json['status'] as String? ?? 'Running',
  );
}

class CrmActivity {
  const CrmActivity({
    required this.id,
    required this.action,
    required this.details,
    required this.createdAt,
    required this.createdBy,
  });

  final String id;
  final String action;
  final String details;
  final DateTime createdAt;
  final String createdBy;

  factory CrmActivity.fromJson(Map<String, dynamic> json) => CrmActivity(
    id: json['uuid']?.toString() ?? json['id']?.toString() ?? '',
    action: json['action'] as String? ?? 'updated',
    details: _plainTextComment(json['details'] as String? ?? ''),
    createdAt:
        DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    createdBy: json['createdBy'] as String? ?? '',
  );
}

class CrmComment {
  const CrmComment({
    required this.id,
    required this.comment,
    required this.createdAt,
    required this.createdByUserId,
  });

  final String id;
  final String comment;
  final DateTime createdAt;
  final String createdByUserId;

  factory CrmComment.fromJson(Map<String, dynamic> json) => CrmComment(
    id: json['id']?.toString() ?? '',
    comment: _plainTextComment(json['comment'] as String? ?? ''),
    createdAt:
        DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    createdByUserId: json['createdByUserId'] as String? ?? AppConfig.brandName,
  );
}

String _plainTextComment(String value) {
  var text = value
      .replaceAll(
        RegExp(
          r'<(?:script|style)\b[^>]*>.*?</(?:script|style)>',
          caseSensitive: false,
          dotAll: true,
        ),
        '',
      )
      .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'</(?:div|li|p)>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'<li\b[^>]*>', caseSensitive: false), '• ')
      .replaceAll(RegExp(r'<[^>]+>'), '');

  text = text.replaceAllMapped(RegExp(r'&#(?:x([0-9a-fA-F]+)|(\d+));'), (
    match,
  ) {
    final hexadecimal = match.group(1);
    final codePoint = int.tryParse(
      hexadecimal ?? match.group(2)!,
      radix: hexadecimal == null ? 10 : 16,
    );
    if (codePoint == null ||
        codePoint < 0 ||
        codePoint > 0x10FFFF ||
        (codePoint >= 0xD800 && codePoint <= 0xDFFF)) {
      return '';
    }
    return String.fromCharCode(codePoint);
  });

  const entities = {
    '&nbsp;': ' ',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
  };
  for (final entry in entities.entries) {
    text = text.replaceAll(entry.key, entry.value);
  }

  return text
      .split('\n')
      .map((line) => line.replaceAll(RegExp(r'[ \t]+'), ' ').trim())
      .where((line) => line.isNotEmpty)
      .join('\n')
      .trim();
}

class MessagingConversation {
  const MessagingConversation({
    required this.id,
    required this.title,
    required this.preview,
    required this.updatedAt,
    required this.unreadCount,
  });

  final int id;
  final String title;
  final String preview;
  final DateTime updatedAt;
  final int unreadCount;

  factory MessagingConversation.fromJson(
    Map<String, dynamic> json,
    String currentEmail,
  ) {
    final last = json['lastMessage'] as Map<String, dynamic>?;
    final members = (json['members'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
    return MessagingConversation(
      id: json['id'] as int,
      title:
          json['title'] as String? ??
          (members.isEmpty
              ? 'Conversation'
              : _otherMemberName(members, currentEmail)),
      preview: last?['content'] as String? ?? 'No messages yet',
      updatedAt:
          DateTime.tryParse(json['updatedAt'] as String? ?? '') ??
          DateTime.now(),
      unreadCount: json['unreadCount'] as int? ?? 0,
    );
  }
}

class MessagingContact {
  const MessagingContact({
    required this.id,
    required this.name,
    required this.email,
  });

  final int id;
  final String name;
  final String email;

  factory MessagingContact.fromJson(Map<String, dynamic> json) =>
      MessagingContact(
        id: json['id'] as int,
        name: json['name'] as String? ?? 'CRM user',
        email: json['email'] as String? ?? '',
      );
}

class MessagingMessage {
  const MessagingMessage({
    required this.id,
    required this.senderName,
    required this.senderEmail,
    required this.content,
    required this.createdAt,
    required this.status,
  });

  final int id;
  final String senderName;
  final String senderEmail;
  final String content;
  final DateTime createdAt;
  final String status;

  factory MessagingMessage.fromJson(Map<String, dynamic> json) =>
      MessagingMessage(
        id: json['id'] as int,
        senderName: json['senderName'] as String? ?? 'User',
        senderEmail: json['senderEmail'] as String? ?? '',
        content: json['content'] as String? ?? '',
        createdAt:
            DateTime.tryParse(json['createdAt'] as String? ?? '') ??
            DateTime.now(),
        status: json['status'] as String? ?? 'SENT',
      );
}

String _dateLabel(String? value) {
  if (value == null || value.isEmpty) return 'Not scheduled';
  final date = DateTime.tryParse(value);
  if (date == null) return value;
  return '${date.day.toString().padLeft(2, '0')} ${_months[date.month - 1]}';
}

String _otherMemberName(
  List<Map<String, dynamic>> members,
  String currentEmail,
) {
  final member = members.cast<Map<String, dynamic>?>().firstWhere(
    (item) =>
        item?['email']?.toString().toLowerCase() != currentEmail.toLowerCase(),
    orElse: () => members.isEmpty ? null : members.first,
  );
  return member?['userName'] as String? ?? 'Conversation';
}

const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
