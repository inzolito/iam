import 'package:flutter/foundation.dart';

import '../../core/services/api_service.dart';
import 'chat_models.dart';

/// Provider de chat — conversaciones y mensajes.
class ChatProvider extends ChangeNotifier {
  final ApiService _api;

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
