/// Mensaje de chat.
class ChatMessage {
  final String id;
  final String matchId;
  final String senderId;
  final String content;
  final DateTime createdAt;
  final DateTime? readAt;

  const ChatMessage({
    required this.id,
    required this.matchId,
    required this.senderId,
    required this.content,
    required this.createdAt,
    this.readAt,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] as String,
      matchId: json['match_id'] as String,
      senderId: json['sender_id'] as String,
      content: json['content'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
      readAt: json['read_at'] != null
          ? DateTime.parse(json['read_at'] as String)
          : null,
    );
  }

  bool get isRead => readAt != null;
}

/// Información del otro usuario en un match.
class ChatUser {
  final String id;
  final String? displayName;
  final String? avatarUrl;

  const ChatUser({
    required this.id,
    this.displayName,
    this.avatarUrl,
  });

  factory ChatUser.fromJson(Map<String, dynamic> json) {
    return ChatUser(
      id: json['id'] as String,
      displayName: json['display_name'] as String?,
      avatarUrl: json['avatar_url'] as String?,
    );
  }
}

/// Conversación (match + último mensaje + usuario).
class ChatConversation {
  final String matchId;
  final ChatUser otherUser;
  final ChatMessage? lastMessage;
  final int unreadCount;

  const ChatConversation({
    required this.matchId,
    required this.otherUser,
    this.lastMessage,
    this.unreadCount = 0,
  });

  factory ChatConversation.fromJson(Map<String, dynamic> json) {
    final match = json['match'] as Map<String, dynamic>;
    final otherUser = json['otherUser'] as Map<String, dynamic>;
    final lastMsg = json['lastMessage'] as Map<String, dynamic>?;

    return ChatConversation(
      matchId: match['id'] as String,
      otherUser: ChatUser.fromJson(otherUser),
      lastMessage: lastMsg != null ? ChatMessage.fromJson(lastMsg) : null,
      unreadCount: json['unreadCount'] as int? ?? 0,
    );
  }

  bool get hasUnread => unreadCount > 0;
}
