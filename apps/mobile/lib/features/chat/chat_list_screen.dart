import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:provider/provider.dart';

import '../../core/services/media_service.dart';
import 'chat_models.dart';
import 'chat_provider.dart';

/// Lista de conversaciones activas (matches) + barra superior de Historias (24h).
class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final chat = context.read<ChatProvider>();
      chat.loadConversations();
      chat.loadStories();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final chat = context.watch<ChatProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mensajes'),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Column(
        children: [
          _StoriesBar(
            storyGroups: chat.storyGroups,
            isUploading: chat.isUploadingStory,
            isGroupViewed: chat.isStoryGroupViewed,
            onAddStory: () => _pickAndUploadStory(context, chat),
            onOpenGroup: (group) => _openStoryViewer(context, chat, group),
          ),
          Divider(
            height: 1,
            thickness: 0.5,
            color: theme.dividerColor.withValues(alpha: 0.45),
          ),
          Expanded(child: _buildBody(context, chat, theme)),
        ],
      ),
    );
  }

  Widget _buildBody(BuildContext context, ChatProvider chat, ThemeData theme) {
    if (chat.isLoadingConversations && chat.conversations.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (chat.error != null && chat.conversations.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(PhosphorIcons.warningCircle(PhosphorIconsStyle.regular),
                size: 48,
                color: theme.colorScheme.onSurface.withValues(alpha: 0.3)),
            const SizedBox(height: 16),
            Text(chat.error!,
                style: TextStyle(
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.5))),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => chat.loadConversations(),
              child: const Text('Reintentar'),
            ),
          ],
        ),
      );
    }

    if (chat.conversations.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(PhosphorIcons.chatCircle(PhosphorIconsStyle.regular),
                  size: 64,
                  color: theme.colorScheme.primary.withValues(alpha: 0.4)),
              const SizedBox(height: 16),
              Text(
                'Sin conversaciones',
                style: TextStyle(
                  fontSize: 18,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Haz match con alguien para empezar a chatear',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([
          chat.loadConversations(),
          chat.loadStories(),
        ]);
      },
      child: ListView.separated(
        itemCount: chat.conversations.length,
        separatorBuilder: (_, __) => Divider(
          height: 1,
          thickness: 0.5,
          indent: 76,
          color: theme.dividerColor.withValues(alpha: 0.4),
        ),
        itemBuilder: (context, index) {
          final conv = chat.conversations[index];
          final storyGroup = chat.storyGroups
              .where((g) => !g.isOwn && g.userId == conv.otherUser.id)
              .firstOrNull;
          return _ConversationTile(
            conversation: conv,
            storyGroup: storyGroup,
            isStoryViewed:
                storyGroup != null && chat.isStoryGroupViewed(storyGroup),
            onTap: () => context.go('/chat/${conv.matchId}'),
            onTapStory: storyGroup != null
                ? () => _openStoryViewer(context, chat, storyGroup)
                : null,
          );
        },
      ),
    );
  }

  Future<void> _pickAndUploadStory(
    BuildContext context,
    ChatProvider chat,
  ) async {
    final media = context.read<MediaService>();
    final source = await showModalBottomSheet<ImageSourceType>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            ListTile(
              leading: Icon(
                  PhosphorIcons.imagesSquare(PhosphorIconsStyle.regular)),
              title: const Text('Elegir foto de galería'),
              onTap: () => Navigator.pop(ctx, ImageSourceType.gallery),
            ),
            ListTile(
              leading: Icon(PhosphorIcons.camera(PhosphorIconsStyle.regular)),
              title: const Text('Tomar foto'),
              onTap: () => Navigator.pop(ctx, ImageSourceType.camera),
            ),
          ],
        ),
      ),
    );
    if (source == null || !context.mounted) return;

    final picked = await media.pickImage(source: source);
    if (picked == null || !context.mounted) return;

    final caption = await Navigator.of(context).push<String?>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => _StoryComposerScreen(imageBytes: picked.bytes),
      ),
    );
    if (caption == null) return;

    await chat.uploadStory(
      bytes: picked.bytes,
      filename: picked.filename,
      caption: caption,
    );
  }

  void _openStoryViewer(
    BuildContext context,
    ChatProvider chat,
    UserStoryGroup group,
  ) {
    final viewableGroups =
        chat.storyGroups.where((g) => g.stories.isNotEmpty).toList();
    final idx = viewableGroups.indexWhere((g) => g.userId == group.userId);
    if (idx < 0) return;

    showDialog<void>(
      context: context,
      barrierColor: Colors.black,
      builder: (_) => _StoryViewerDialog(
        groups: viewableGroups,
        initialGroupIndex: idx,
        onStoryViewed: chat.markStoryViewed,
      ),
    );
  }
}

class _StoriesBar extends StatelessWidget {
  final List<UserStoryGroup> storyGroups;
  final bool isUploading;
  final bool Function(UserStoryGroup) isGroupViewed;
  final VoidCallback onAddStory;
  final ValueChanged<UserStoryGroup> onOpenGroup;

  const _StoriesBar({
    required this.storyGroups,
    required this.isUploading,
    required this.isGroupViewed,
    required this.onAddStory,
    required this.onOpenGroup,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ownGroup = storyGroups.where((g) => g.isOwn).firstOrNull;
    final otherGroups = storyGroups.where((g) => !g.isOwn).toList();

    return SizedBox(
      height: 102,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        itemCount: 1 + otherGroups.length,
        separatorBuilder: (_, __) => const SizedBox(width: 14),
        itemBuilder: (context, index) {
          if (index == 0) {
            final hasOwn = ownGroup != null && ownGroup.stories.isNotEmpty;
            return GestureDetector(
              onTap: hasOwn ? () => onOpenGroup(ownGroup) : onAddStory,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Stack(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(2.5),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: hasOwn
                                ? theme.colorScheme.primary
                                : theme.dividerColor,
                            width: 2,
                          ),
                        ),
                        child: CircleAvatar(
                          radius: 26,
                          backgroundColor:
                              theme.colorScheme.primary.withValues(alpha: 0.12),
                          backgroundImage: ownGroup?.avatarUrl != null
                              ? NetworkImage(ownGroup!.avatarUrl!)
                              : null,
                          child: isUploading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : ownGroup?.avatarUrl == null
                                  ? Icon(
                                      PhosphorIcons.user(
                                          PhosphorIconsStyle.regular),
                                      color: theme.colorScheme.primary,
                                    )
                                  : null,
                        ),
                      ),
                      Positioned(
                        bottom: 0,
                        right: 0,
                        child: GestureDetector(
                          onTap: onAddStory,
                          child: Container(
                            width: 20,
                            height: 20,
                            decoration: BoxDecoration(
                              color: theme.colorScheme.primary,
                              shape: BoxShape.circle,
                              border:
                                  Border.all(color: Colors.white, width: 1.5),
                            ),
                            child: const Icon(Icons.add,
                                size: 13, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text('Tu historia',
                      style: TextStyle(fontSize: 11),
                      overflow: TextOverflow.ellipsis),
                ],
              ),
            );
          }

          final group = otherGroups[index - 1];
          final viewed = isGroupViewed(group);
          return GestureDetector(
            onTap: () => onOpenGroup(group),
            child: SizedBox(
              width: 64,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(2.5),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: viewed ? Colors.grey.shade400 : null,
                      gradient: viewed
                          ? null
                          : LinearGradient(
                              colors: [
                                theme.colorScheme.primary,
                                theme.colorScheme.secondary,
                              ],
                            ),
                    ),
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white,
                      ),
                      child: CircleAvatar(
                        radius: 24,
                        backgroundColor:
                            theme.colorScheme.primary.withValues(alpha: 0.15),
                        backgroundImage: group.avatarUrl != null
                            ? NetworkImage(group.avatarUrl!)
                            : null,
                        child: group.avatarUrl == null
                            ? Text(
                                group.displayName.isNotEmpty
                                    ? group.displayName[0].toUpperCase()
                                    : '?',
                                style: TextStyle(
                                  color: theme.colorScheme.primary,
                                  fontWeight: FontWeight.bold,
                                ),
                              )
                            : null,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    group.displayName.split(' ').first,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _StoryViewerDialog extends StatefulWidget {
  final List<UserStoryGroup> groups;
  final int initialGroupIndex;
  final ValueChanged<String> onStoryViewed;

  const _StoryViewerDialog({
    required this.groups,
    required this.initialGroupIndex,
    required this.onStoryViewed,
  });

  @override
  State<_StoryViewerDialog> createState() => _StoryViewerDialogState();
}

class _StoryViewerDialogState extends State<_StoryViewerDialog> {
  late int _groupIndex;
  int _index = 0;

  UserStoryGroup get _currentGroup => widget.groups[_groupIndex];

  @override
  void initState() {
    super.initState();
    _groupIndex = widget.initialGroupIndex;
    _markCurrentViewed();
  }

  void _markCurrentViewed() {
    final stories = _currentGroup.stories;
    if (_index >= 0 && _index < stories.length) {
      widget.onStoryViewed(stories[_index].id);
    }
  }

  void _next() {
    if (_index < _currentGroup.stories.length - 1) {
      setState(() => _index++);
      _markCurrentViewed();
    } else if (_groupIndex < widget.groups.length - 1) {
      setState(() {
        _groupIndex++;
        _index = 0;
      });
      _markCurrentViewed();
    } else {
      Navigator.pop(context);
    }
  }

  void _prev() {
    if (_index > 0) {
      setState(() => _index--);
      _markCurrentViewed();
    } else if (_groupIndex > 0) {
      setState(() {
        _groupIndex--;
        _index = (_currentGroup.stories.length - 1).clamp(0, 999);
      });
      _markCurrentViewed();
    }
  }

  void _nextUser() {
    if (_groupIndex < widget.groups.length - 1) {
      setState(() {
        _groupIndex++;
        _index = 0;
      });
      _markCurrentViewed();
    } else {
      Navigator.pop(context);
    }
  }

  void _prevUser() {
    if (_groupIndex > 0) {
      setState(() {
        _groupIndex--;
        _index = 0;
      });
      _markCurrentViewed();
    }
  }

  @override
  Widget build(BuildContext context) {
    final group = _currentGroup;
    final story = group.stories[_index];
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: GestureDetector(
          onHorizontalDragEnd: (details) {
            final v = details.primaryVelocity ?? 0;
            if (v < -200) {
              _nextUser();
            } else if (v > 200) {
              _prevUser();
            }
          },
          onTapUp: (details) {
            final width = MediaQuery.of(context).size.width;
            if (details.localPosition.dx < width * 0.35) {
              _prev();
            } else {
              _next();
            }
          },
          child: Stack(
            fit: StackFit.expand,
            children: [
              Image.network(
                story.imageUrl,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Center(
                  child: Icon(Icons.broken_image_outlined,
                      color: Colors.white54, size: 48),
                ),
              ),
              Positioned(
                top: 12,
                left: 12,
                right: 12,
                child: Column(
                  children: [
                    Row(
                      children: [
                        for (var i = 0; i < group.stories.length; i++)
                          Expanded(
                            child: Container(
                              height: 3,
                              margin: const EdgeInsets.symmetric(horizontal: 2),
                              decoration: BoxDecoration(
                                color: i <= _index
                                    ? Colors.white
                                    : Colors.white.withValues(alpha: 0.35),
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 16,
                          backgroundImage: group.avatarUrl != null
                              ? NetworkImage(group.avatarUrl!)
                              : null,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            group.displayName,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, color: Colors.white),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (story.caption != null && story.caption!.isNotEmpty)
                Positioned(
                  bottom: 32,
                  left: 20,
                  right: 20,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Text(
                      story.caption!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white, fontSize: 15),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  final ChatConversation conversation;
  final UserStoryGroup? storyGroup;
  final bool isStoryViewed;
  final VoidCallback onTap;
  final VoidCallback? onTapStory;

  const _ConversationTile({
    required this.conversation,
    this.storyGroup,
    this.isStoryViewed = false,
    required this.onTap,
    this.onTapStory,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final user = conversation.otherUser;
    final lastMsg = conversation.lastMessage;

    final avatar = CircleAvatar(
      radius: storyGroup != null ? 22 : 24,
      backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.2),
      backgroundImage:
          user.avatarUrl != null ? NetworkImage(user.avatarUrl!) : null,
      child: user.avatarUrl == null
          ? Text(
              (user.displayName ?? '?')[0].toUpperCase(),
              style: TextStyle(
                color: theme.colorScheme.primary,
                fontWeight: FontWeight.bold,
              ),
            )
          : null,
    );

    final leadingWidget = storyGroup != null
        ? GestureDetector(
            onTap: onTapStory,
            child: Container(
              padding: const EdgeInsets.all(2.5),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isStoryViewed ? Colors.grey.shade400 : null,
                gradient: isStoryViewed
                    ? null
                    : LinearGradient(
                        colors: [
                          theme.colorScheme.primary,
                          theme.colorScheme.secondary,
                        ],
                      ),
              ),
              child: Container(
                padding: const EdgeInsets.all(2),
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white,
                ),
                child: avatar,
              ),
            ),
          )
        : avatar;

    return ListTile(
      onTap: onTap,
      leading: leadingWidget,
      title: Text(
        user.displayName ?? 'Usuario',
        style: TextStyle(
          fontWeight:
              conversation.hasUnread ? FontWeight.bold : FontWeight.normal,
        ),
      ),
      subtitle: lastMsg != null
          ? Text(
              lastMsg.content,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: theme.colorScheme.onSurface.withValues(
                    alpha: conversation.hasUnread ? 0.8 : 0.5),
                fontWeight: conversation.hasUnread
                    ? FontWeight.w500
                    : FontWeight.normal,
              ),
            )
          : Text(
              'Nuevo match',
              style: TextStyle(
                fontStyle: FontStyle.italic,
                color: theme.colorScheme.primary.withValues(alpha: 0.7),
              ),
            ),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (lastMsg != null)
            Text(
              _formatTime(lastMsg.createdAt),
              style: TextStyle(
                fontSize: 12,
                color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
              ),
            ),
          if (conversation.hasUnread) ...[
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: theme.colorScheme.primary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '${conversation.unreadCount}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _formatTime(DateTime dateTime) {
    final now = DateTime.now();
    final diff = now.difference(dateTime);

    if (diff.inMinutes < 1) return 'ahora';
    if (diff.inHours < 1) return '${diff.inMinutes}m';
    if (diff.inDays < 1) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return '${dateTime.day}/${dateTime.month}';
  }
}

/// Pantalla completa estilo WhatsApp/Instagram para previsualizar la foto
/// de la historia mientras se escribe un comentario opcional.
class _StoryComposerScreen extends StatefulWidget {
  final List<int> imageBytes;

  const _StoryComposerScreen({required this.imageBytes});

  @override
  State<_StoryComposerScreen> createState() => _StoryComposerScreenState();
}

class _StoryComposerScreenState extends State<_StoryComposerScreen> {
  final _captionCtrl = TextEditingController();

  @override
  void dispose() {
    _captionCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bytes = widget.imageBytes is Uint8List
        ? widget.imageBytes as Uint8List
        : Uint8List.fromList(widget.imageBytes);

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          fit: StackFit.expand,
          children: [
            Center(
              child: InteractiveViewer(
                child: Image.memory(
                  bytes,
                  fit: BoxFit.contain,
                ),
              ),
            ),
            Positioned(
              top: 8,
              left: 8,
              right: 8,
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white, size: 28),
                    onPressed: () => Navigator.of(context).pop(null),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Tu historia',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            Positioned(
              left: 12,
              right: 12,
              bottom: 12,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _captionCtrl,
                      style: const TextStyle(color: Colors.white, fontSize: 15),
                      cursorColor: Colors.white,
                      maxLines: 3,
                      minLines: 1,
                      maxLength: 140,
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Colors.black.withValues(alpha: 0.65),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 18, vertical: 12),
                        hintText: 'Agrega un comentario...',
                        hintStyle: const TextStyle(color: Colors.white70),
                        counterText: '',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(28),
                          borderSide: BorderSide(
                            color: Colors.white.withValues(alpha: 0.28),
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(28),
                          borderSide: BorderSide(
                            color: Colors.white.withValues(alpha: 0.28),
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(28),
                          borderSide: const BorderSide(color: Colors.white70),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Material(
                    color: theme.colorScheme.primary,
                    shape: const CircleBorder(),
                    child: IconButton(
                      onPressed: () =>
                          Navigator.of(context).pop(_captionCtrl.text.trim()),
                      icon: Icon(
                        PhosphorIcons.paperPlaneTilt(PhosphorIconsStyle.fill),
                        color: Colors.white,
                      ),
                      tooltip: 'Publicar historia',
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
