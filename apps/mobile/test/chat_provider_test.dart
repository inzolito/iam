import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/core/services/api_service.dart';
import 'package:iam_mobile/features/chat/chat_provider.dart';
import 'package:iam_mobile/features/chat/chat_models.dart';

/// Mock ApiService para tests de chat.
class MockApiService extends ApiService {
  final Map<String, dynamic> Function(String path)? _onGet;
  final Map<String, dynamic> Function(String path, {Map<String, dynamic>? body})?
      _onPost;
  final Map<String, dynamic> Function(String path, {Map<String, dynamic>? body})?
      _onPatch;

  MockApiService({
    Map<String, dynamic> Function(String path)? onGet,
    Map<String, dynamic> Function(String path, {Map<String, dynamic>? body})?
        onPost,
    Map<String, dynamic> Function(String path, {Map<String, dynamic>? body})?
        onPatch,
  })  : _onGet = onGet,
        _onPost = onPost,
        _onPatch = onPatch,
        super(baseUrl: 'http://localhost');

  @override
  Future<Map<String, dynamic>> get(String path) async {
    if (_onGet != null) return _onGet!(path);
    return {};
  }

  @override
  Future<Map<String, dynamic>> post(String path,
      {Map<String, dynamic>? body}) async {
    if (_onPost != null) return _onPost!(path, body: body);
    return {};
  }

  @override
  Future<Map<String, dynamic>> patch(String path,
      {Map<String, dynamic>? body}) async {
    if (_onPatch != null) return _onPatch!(path, body: body);
    return {};
  }
}

Map<String, dynamic> _makeConversation(String matchId,
    {String? userName, int unread = 0, String? lastMsg}) {
  return {
    'match': {
      'id': matchId,
      'user_a_id': 'me',
      'user_b_id': 'other-$matchId',
      'status': 'active',
      'created_at': '2026-01-01T00:00:00Z',
    },
    'otherUser': {
      'id': 'other-$matchId',
      'display_name': userName ?? 'User $matchId',
      'avatar_url': null,
    },
    'lastMessage': lastMsg != null
        ? {
            'id': 'msg-last-$matchId',
            'match_id': matchId,
            'sender_id': 'other-$matchId',
            'content': lastMsg,
            'created_at': '2026-01-01T12:00:00Z',
            'read_at': null,
          }
        : null,
    'unreadCount': unread,
  };
}

Map<String, dynamic> _makeMessage(String id,
    {String matchId = 'm1',
    String senderId = 'me',
    String content = 'Hola'}) {
  return {
    'id': id,
    'match_id': matchId,
    'sender_id': senderId,
    'content': content,
    'created_at': '2026-01-01T12:00:00Z',
    'read_at': null,
  };
}

void main() {
  // ============================================================
  // HAPPY PATH
  // ============================================================

  group('Happy Path', () {
    test('estado inicial limpio', () {
      final api = MockApiService();
      final provider = ChatProvider(api: api);

      expect(provider.conversations, isEmpty);
      expect(provider.messages, isEmpty);
      expect(provider.activeMatchId, isNull);
      expect(provider.isLoadingConversations, false);
      expect(provider.isLoadingMessages, false);
      expect(provider.error, isNull);
    });

    test('loadConversations carga lista del backend', () async {
      final api = MockApiService(
        onGet: (path) => {
              'matches': [
                _makeConversation('m1', userName: 'Ana', lastMsg: 'Hola!'),
                _makeConversation('m2', userName: 'Leo'),
              ]
            },
      );
      final provider = ChatProvider(api: api);

      await provider.loadConversations();

      expect(provider.conversations.length, 2);
      expect(provider.conversations[0].matchId, 'm1');
      expect(provider.conversations[0].otherUser.displayName, 'Ana');
      expect(provider.conversations[0].lastMessage!.content, 'Hola!');
      expect(provider.conversations[1].lastMessage, isNull);
    });

    test('totalUnreadCount suma todos los unread', () async {
      final api = MockApiService(
        onGet: (path) => {
              'matches': [
                _makeConversation('m1', unread: 3),
                _makeConversation('m2', unread: 5),
                _makeConversation('m3', unread: 0),
              ]
            },
      );
      final provider = ChatProvider(api: api);

      await provider.loadConversations();
      expect(provider.totalUnreadCount, 8);
    });

    test('openConversation carga mensajes', () async {
      final api = MockApiService(
        onGet: (path) {
          if (path.contains('/messages')) {
            return {
              'messages': [
                _makeMessage('msg1', content: 'Hola'),
                _makeMessage('msg2', content: 'Que tal'),
              ],
              'hasMore': false,
            };
          }
          return {'matches': []};
        },
        onPatch: (path, {body}) => {'markedRead': 2},
      );
      final provider = ChatProvider(api: api);

      await provider.openConversation('m1');

      expect(provider.activeMatchId, 'm1');
      expect(provider.messages.length, 2);
      expect(provider.messages[0].content, 'Hola');
      expect(provider.hasMoreMessages, false);
    });

    test('sendMessage agrega mensaje a la lista', () async {
      final api = MockApiService(
        onGet: (path) {
          if (path.contains('/messages')) {
            return {'messages': [], 'hasMore': false};
          }
          return {'matches': [_makeConversation('m1')]};
        },
        onPost: (path, {body}) => _makeMessage('new-1',
            matchId: 'm1', senderId: 'me', content: body!['content']),
        onPatch: (path, {body}) => {'markedRead': 0},
      );
      final provider = ChatProvider(api: api);

      await provider.loadConversations();
      await provider.openConversation('m1');

      final result = await provider.sendMessage('Hola mundo');

      expect(result, true);
      expect(provider.messages.length, 1);
      expect(provider.messages.last.content, 'Hola mundo');
    });

    test('loadOlderMessages agrega al inicio', () async {
      int callCount = 0;
      final api = MockApiService(
        onGet: (path) {
          if (path.contains('/messages')) {
            callCount++;
            if (callCount == 1) {
              return {
                'messages': [_makeMessage('msg3'), _makeMessage('msg4')],
                'hasMore': true,
              };
            }
            return {
              'messages': [_makeMessage('msg1'), _makeMessage('msg2')],
              'hasMore': false,
            };
          }
          return {'matches': []};
        },
        onPatch: (path, {body}) => {'markedRead': 0},
      );
      final provider = ChatProvider(api: api);

      await provider.openConversation('m1');
      expect(provider.messages.length, 2);

      await provider.loadOlderMessages();
      expect(provider.messages.length, 4);
      expect(provider.messages[0].id, 'msg1');
      expect(provider.hasMoreMessages, false);
    });

    test('markAsRead actualiza unread count local', () async {
      final api = MockApiService(
        onGet: (path) => {
              'matches': [_makeConversation('m1', unread: 5)]
            },
        onPatch: (path, {body}) => {'markedRead': 5},
      );
      final provider = ChatProvider(api: api);

      await provider.loadConversations();
      expect(provider.conversations[0].unreadCount, 5);

      await provider.markAsRead('m1');
      expect(provider.conversations[0].unreadCount, 0);
    });

    test('closeConversation limpia estado', () async {
      final api = MockApiService(
        onGet: (path) {
          if (path.contains('/messages')) {
            return {
              'messages': [_makeMessage('msg1')],
              'hasMore': false,
            };
          }
          return {'matches': []};
        },
        onPatch: (path, {body}) => {'markedRead': 0},
      );
      final provider = ChatProvider(api: api);

      await provider.openConversation('m1');
      expect(provider.activeMatchId, 'm1');

      provider.closeConversation();
      expect(provider.activeMatchId, isNull);
      expect(provider.messages, isEmpty);
    });

    test('clearError limpia error', () async {
      final api = MockApiService(
        onGet: (path) =>
            throw ApiException(statusCode: 500, message: 'Server error'),
      );
      final provider = ChatProvider(api: api);

      await provider.loadConversations();
      expect(provider.error, 'Server error');

      provider.clearError();
      expect(provider.error, isNull);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  group('Error Forzado', () {
    test('loadConversations con error del servidor', () async {
      final api = MockApiService(
        onGet: (path) =>
            throw ApiException(statusCode: 500, message: 'DB down'),
      );
      final provider = ChatProvider(api: api);

      await provider.loadConversations();

      expect(provider.error, 'DB down');
      expect(provider.conversations, isEmpty);
      expect(provider.isLoadingConversations, false);
    });

    test('openConversation con error', () async {
      final api = MockApiService(
        onGet: (path) =>
            throw ApiException(statusCode: 404, message: 'MATCH_NOT_FOUND'),
      );
      final provider = ChatProvider(api: api);

      await provider.openConversation('m-inexistente');

      expect(provider.error, 'MATCH_NOT_FOUND');
      expect(provider.messages, isEmpty);
    });

    test('sendMessage con contenido vacío retorna false', () async {
      final api = MockApiService(
        onGet: (path) {
          if (path.contains('/messages')) {
            return {'messages': [], 'hasMore': false};
          }
          return {'matches': []};
        },
        onPatch: (path, {body}) => {'markedRead': 0},
      );
      final provider = ChatProvider(api: api);

      await provider.openConversation('m1');
      final result = await provider.sendMessage('   ');

      expect(result, false);
      expect(provider.messages, isEmpty);
    });

    test('sendMessage sin conversación activa retorna false', () async {
      final api = MockApiService();
      final provider = ChatProvider(api: api);

      final result = await provider.sendMessage('Hola');
      expect(result, false);
    });

    test('sendMessage con error del servidor', () async {
      final api = MockApiService(
        onGet: (path) {
          if (path.contains('/messages')) {
            return {'messages': [], 'hasMore': false};
          }
          return {'matches': []};
        },
        onPost: (path, {body}) => throw ApiException(
            statusCode: 403, message: 'MATCH_NOT_ACTIVE'),
        onPatch: (path, {body}) => {'markedRead': 0},
      );
      final provider = ChatProvider(api: api);

      await provider.openConversation('m1');
      final result = await provider.sendMessage('Hola');

      expect(result, false);
      expect(provider.error, 'MATCH_NOT_ACTIVE');
    });

    test('loadOlderMessages con error revierte página', () async {
      int callCount = 0;
      final api = MockApiService(
        onGet: (path) {
          if (path.contains('/messages')) {
            callCount++;
            if (callCount == 1) {
              return {
                'messages': [_makeMessage('m1')],
                'hasMore': true,
              };
            }
            throw ApiException(statusCode: 500, message: 'Timeout');
          }
          return {'matches': []};
        },
        onPatch: (path, {body}) => {'markedRead': 0},
      );
      final provider = ChatProvider(api: api);

      await provider.openConversation('m1');
      await provider.loadOlderMessages();

      expect(provider.error, 'Timeout');
      expect(provider.messages.length, 1);
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  group('Peor Caso', () {
    test('conversaciones vacías', () async {
      final api = MockApiService(
        onGet: (path) => {'matches': []},
      );
      final provider = ChatProvider(api: api);

      await provider.loadConversations();

      expect(provider.conversations, isEmpty);
      expect(provider.totalUnreadCount, 0);
    });

    test('mensajes vacíos en conversación', () async {
      final api = MockApiService(
        onGet: (path) {
          if (path.contains('/messages')) {
            return {'messages': [], 'hasMore': false};
          }
          return {'matches': []};
        },
        onPatch: (path, {body}) => {'markedRead': 0},
      );
      final provider = ChatProvider(api: api);

      await provider.openConversation('m1');

      expect(provider.messages, isEmpty);
      expect(provider.hasMoreMessages, false);
    });

    test('loadOlderMessages no hace nada si hasMore=false', () async {
      int callCount = 0;
      final api = MockApiService(
        onGet: (path) {
          if (path.contains('/messages')) {
            callCount++;
            return {'messages': [], 'hasMore': false};
          }
          return {'matches': []};
        },
        onPatch: (path, {body}) => {'markedRead': 0},
      );
      final provider = ChatProvider(api: api);

      await provider.openConversation('m1'); // callCount = 1
      await provider.loadOlderMessages(); // No debería llamar

      expect(callCount, 1);
    });

    test('loadOlderMessages no hace nada sin conversación activa', () async {
      int callCount = 0;
      final api = MockApiService(
        onGet: (path) {
          callCount++;
          return {'messages': [], 'hasMore': true};
        },
      );
      final provider = ChatProvider(api: api);

      await provider.loadOlderMessages();
      expect(callCount, 0);
    });

    test('sendMessage actualiza lastMessage en conversación', () async {
      final api = MockApiService(
        onGet: (path) {
          if (path.contains('/messages')) {
            return {'messages': [], 'hasMore': false};
          }
          return {
            'matches': [_makeConversation('m1')]
          };
        },
        onPost: (path, {body}) => _makeMessage('new-1',
            matchId: 'm1', content: body!['content']),
        onPatch: (path, {body}) => {'markedRead': 0},
      );
      final provider = ChatProvider(api: api);

      await provider.loadConversations();
      await provider.openConversation('m1');
      await provider.sendMessage('Actualizado');

      expect(provider.conversations[0].lastMessage!.content, 'Actualizado');
    });

    test('markAsRead silencia errores', () async {
      final api = MockApiService(
        onGet: (path) => {
              'matches': [_makeConversation('m1', unread: 3)]
            },
        onPatch: (path, {body}) => throw Exception('Network error'),
      );
      final provider = ChatProvider(api: api);

      await provider.loadConversations();
      // No debería lanzar excepción
      await provider.markAsRead('m1');
      // unread no cambia porque falló
      expect(provider.conversations[0].unreadCount, 3);
    });
  });

  // ============================================================
  // MODELOS
  // ============================================================

  group('ChatModels', () {
    test('ChatMessage.fromJson parsea todos los campos', () {
      final msg = ChatMessage.fromJson({
        'id': 'msg-1',
        'match_id': 'm1',
        'sender_id': 'u1',
        'content': 'Hola',
        'created_at': '2026-01-15T14:30:00Z',
        'read_at': '2026-01-15T14:31:00Z',
      });

      expect(msg.id, 'msg-1');
      expect(msg.matchId, 'm1');
      expect(msg.senderId, 'u1');
      expect(msg.content, 'Hola');
      expect(msg.isRead, true);
    });

    test('ChatMessage sin read_at tiene isRead=false', () {
      final msg = ChatMessage.fromJson({
        'id': 'msg-1',
        'match_id': 'm1',
        'sender_id': 'u1',
        'content': 'Test',
        'created_at': '2026-01-15T14:30:00Z',
        'read_at': null,
      });

      expect(msg.isRead, false);
    });

    test('ChatUser.fromJson parsea campos', () {
      final user = ChatUser.fromJson({
        'id': 'u1',
        'display_name': 'Ana',
        'avatar_url': 'https://example.com/avatar.png',
      });

      expect(user.id, 'u1');
      expect(user.displayName, 'Ana');
      expect(user.avatarUrl, 'https://example.com/avatar.png');
    });

    test('ChatUser.fromJson con campos mínimos', () {
      final user = ChatUser.fromJson({'id': 'u1'});

      expect(user.id, 'u1');
      expect(user.displayName, isNull);
      expect(user.avatarUrl, isNull);
    });

    test('ChatConversation.fromJson completo', () {
      final conv = ChatConversation.fromJson(
          _makeConversation('m1', userName: 'Leo', unread: 3, lastMsg: 'Bye'));

      expect(conv.matchId, 'm1');
      expect(conv.otherUser.displayName, 'Leo');
      expect(conv.lastMessage!.content, 'Bye');
      expect(conv.unreadCount, 3);
      expect(conv.hasUnread, true);
    });

    test('ChatConversation sin lastMessage', () {
      final conv = ChatConversation.fromJson(
          _makeConversation('m1', unread: 0));

      expect(conv.lastMessage, isNull);
      expect(conv.hasUnread, false);
    });
  });
}
