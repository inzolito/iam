import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/services/api_service.dart';
import 'chat_models.dart';

/// Provider de chat — conversaciones y mensajes.
class ChatProvider extends ChangeNotifier {
  static const _viewedStoriesKey = 'iam_viewed_story_ids';
  final ApiService _api;

  // ── Historias ──
  List<UserStoryGroup> _storyGroups = [];
  List<UserStoryGroup> get storyGroups => _storyGroups;

  final Set<String> _viewedStoryIds = {};
  bool _viewedLoaded = false;

  bool isStoryGroupViewed(UserStoryGroup group) {
    if (group.stories.isEmpty) return false;
    return group.stories.every((s) => _viewedStoryIds.contains(s.id));
  }

  bool _isUploadingStory = false;
  bool get isUploadingStory => _isUploadingStory;

  // ── Conversaciones ──
  List<ChatConversation> _conversations = [];
  List<ChatConversation> get conversations => _conversations;

  bool _isLoadingConversations = false;
  bool get isLoadingConversations => _isLoadingConversations;

  // ── Mensajes de la conversación activa ──
  String? _activeMatchId;
  String? get activeMatchId => _activeMatchId;

  List<ChatMessage> _messages = [];
  List<ChatMessage> get messages => _messages;

  bool _isLoadingMessages = false;
  bool get isLoadingMessages => _isLoadingMessages;

  bool _hasMoreMessages = true;
  bool get hasMoreMessages => _hasMoreMessages;

  int _messagesPage = 0;

  String? _error;
  String? get error => _error;

  ChatProvider({required ApiService api}) : _api = api;

  // ── Conversaciones ──

  /// Cargar lista de conversaciones (matches con último mensaje).
  Future<void> loadConversations() async {
    _isLoadingConversations = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.get('/matches');
      final list = response['matches'] as List<dynamic>? ?? [];

      _conversations = list
          .map((c) => ChatConversation.fromJson(c as Map<String, dynamic>))
          .toList();
      _isLoadingConversations = false;
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      _isLoadingConversations = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _isLoadingConversations = false;
      notifyListeners();
    }
  }

  /// Total de mensajes no leídos en todas las conversaciones.
  int get totalUnreadCount =>
      _conversations.fold(0, (sum, c) => sum + c.unreadCount);

  // ── Historias ──

  Future<void> loadStories() async {
    await _ensureViewedLoaded();
    try {
      final response = await _api.get('/stories');
      final list = response['stories'] as List<dynamic>? ?? [];
      _storyGroups = list
          .map((g) => UserStoryGroup.fromJson(g as Map<String, dynamic>))
          .toList();
      notifyListeners();
    } catch (_) {
      // Silenciar si aún no hay historias o falla secundario
    }
  }

  Future<void> _ensureViewedLoaded() async {
    if (_viewedLoaded) return;
    _viewedLoaded = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getStringList(_viewedStoriesKey);
      if (saved != null) {
        _viewedStoryIds.addAll(saved);
      }
    } catch (_) {
      // En tests sin binding de SharedPreferences, continúa en memoria.
    }
  }

  Future<void> markStoryViewed(String storyId) async {
    if (_viewedStoryIds.contains(storyId)) return;
    _viewedStoryIds.add(storyId);
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(_viewedStoriesKey, _viewedStoryIds.toList());
    } catch (_) {}
  }

  /// Romper match (archiva el match en backend y lo quita de conversaciones).
  Future<bool> unmatch(String matchId) async {
    try {
      await _api.delete('/matches/$matchId');
      _conversations.removeWhere((c) => c.matchId == matchId);
      if (_activeMatchId == matchId) {
        _activeMatchId = null;
        _messages = [];
      }
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> uploadStory({
    required List<int> bytes,
    required String filename,
    String? caption,
  }) async {
    _isUploadingStory = true;
    _error = null;
    notifyListeners();

    try {
      await _api.uploadFile(
        '/stories',
        bytes: bytes,
        field: 'file',
        filename: filename,
        extraFields:
            caption != null && caption.trim().isNotEmpty
                ? {'caption': caption.trim()}
                : null,
      );
      await loadStories();
      _isUploadingStory = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _isUploadingStory = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = e.toString();
      _isUploadingStory = false;
      notifyListeners();
      return false;
    }
  }

  // ── Mensajes ──

  /// Abrir una conversación y cargar mensajes.
  Future<void> openConversation(String matchId) async {
    _activeMatchId = matchId;
    _messages = [];
    _messagesPage = 0;
    _hasMoreMessages = true;
    _isLoadingMessages = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.get('/matches/$matchId/messages?page=0');
      final list = response['messages'] as List<dynamic>? ?? [];

      _messages = list
          .map((m) => ChatMessage.fromJson(m as Map<String, dynamic>))
          .toList();
      _hasMoreMessages = response['hasMore'] as bool? ?? false;
      _isLoadingMessages = false;
      notifyListeners();

      // Marcar como leídos
      await markAsRead(matchId);
    } on ApiException catch (e) {
      _error = e.message;
      _isLoadingMessages = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _isLoadingMessages = false;
      notifyListeners();
    }
  }

  /// Cargar mensajes más antiguos (paginación).
  Future<void> loadOlderMessages() async {
    if (!_hasMoreMessages || _isLoadingMessages || _activeMatchId == null) {
      return;
    }

    _messagesPage++;
    _isLoadingMessages = true;
    notifyListeners();

    try {
      final response = await _api
          .get('/matches/$_activeMatchId/messages?page=$_messagesPage');
      final list = response['messages'] as List<dynamic>? ?? [];

      final older = list
          .map((m) => ChatMessage.fromJson(m as Map<String, dynamic>))
          .toList();
      // Mensajes más viejos van al inicio
      _messages.insertAll(0, older);
      _hasMoreMessages = response['hasMore'] as bool? ?? false;
      _isLoadingMessages = false;
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      _messagesPage--;
      _isLoadingMessages = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _messagesPage--;
      _isLoadingMessages = false;
      notifyListeners();
    }
  }

  /// Enviar un mensaje.
  Future<bool> sendMessage(String content) async {
    if (_activeMatchId == null) return false;

    final trimmed = content.trim();
    if (trimmed.isEmpty) return false;

    try {
      final response = await _api.post(
        '/matches/$_activeMatchId/messages',
        body: {'content': trimmed},
      );

      final message = ChatMessage.fromJson(response);
      _messages.add(message);
      notifyListeners();

      // Actualizar último mensaje en la conversación
      _updateConversationLastMessage(message);

      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  /// Marcar mensajes de una conversación como leídos.
  Future<void> markAsRead(String matchId) async {
    try {
      await _api.patch('/matches/$matchId/read');
      // Actualizar unread count local
      final index = _conversations.indexWhere((c) => c.matchId == matchId);
      if (index >= 0) {
        final conv = _conversations[index];
        _conversations[index] = ChatConversation(
          matchId: conv.matchId,
          otherUser: conv.otherUser,
          lastMessage: conv.lastMessage,
          unreadCount: 0,
        );
        notifyListeners();
      }
    } catch (_) {
      // Silenciar error de mark-read
    }
  }

  /// Cerrar conversación activa.
  void closeConversation() {
    _activeMatchId = null;
    _messages = [];
    _messagesPage = 0;
    _hasMoreMessages = true;
    notifyListeners();
  }

  void _updateConversationLastMessage(ChatMessage message) {
    final index =
        _conversations.indexWhere((c) => c.matchId == message.matchId);
    if (index >= 0) {
      final conv = _conversations[index];
      _conversations[index] = ChatConversation(
        matchId: conv.matchId,
        otherUser: conv.otherUser,
        lastMessage: message,
        unreadCount: 0,
      );
      // Mover al inicio de la lista
      final updated = _conversations.removeAt(index);
      _conversations.insert(0, updated);
      notifyListeners();
    }
  }

  /// Limpiar error.
  void clearError() {
    _error = null;
    notifyListeners();
  }
}
