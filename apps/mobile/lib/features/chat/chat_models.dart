import '../../core/config/env.dart';

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
    final rawAvatar = json['avatar_url'] as String?;
    return ChatUser(
      id: json['id'] as String,
      displayName: json['display_name'] as String?,
      avatarUrl: rawAvatar != null ? Env.resolveMediaUrl(rawAvatar) : null,
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

/// Historia efímera (24h) de un usuario.
class StoryItem {
  final String id;
  final String imageUrl;
  final String? caption;
  final DateTime createdAt;

  const StoryItem({
    required this.id,
    required this.imageUrl,
    this.caption,
    required this.createdAt,
  });

  factory StoryItem.fromJson(Map<String, dynamic> json) {
    return StoryItem(
      id: json['id'] as String,
      imageUrl: Env.resolveMediaUrl(json['image_url'] as String? ?? ''),
      caption: json['caption'] as String?,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
    );
  }
}

/// Grupo de historias por usuario.
class UserStoryGroup {
  final String userId;
  final String displayName;
  final String? avatarUrl;
  final bool isOwn;
  final List<StoryItem> stories;

  const UserStoryGroup({
    required this.userId,
    required this.displayName,
    this.avatarUrl,
    this.isOwn = false,
    required this.stories,
  });

  factory UserStoryGroup.fromJson(Map<String, dynamic> json) {
    final rawAvatar = json['avatar_url'] as String?;
    final list = json['stories'] as List<dynamic>? ?? [];
    return UserStoryGroup(
      userId: json['user_id'] as String,
      displayName: json['display_name'] as String? ?? 'Usuario',
      avatarUrl: rawAvatar != null ? Env.resolveMediaUrl(rawAvatar) : null,
      isOwn: json['is_own'] as bool? ?? false,
      stories: list
          .map((s) => StoryItem.fromJson(s as Map<String, dynamic>))
          .toList(),
    );
  }
}
