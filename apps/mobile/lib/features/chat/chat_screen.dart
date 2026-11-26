import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';

import 'chat_provider.dart';
import 'chat_models.dart';
import '../../core/providers/auth_provider.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

/// Pantalla de chat individual — historial de mensajes + input.
class ChatScreen extends StatefulWidget {
  final String matchId;

  const ChatScreen({super.key, required this.matchId});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  bool _isSending = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ChatProvider>().openConversation(widget.matchId);
    });

    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    if (_scrollController.position.pixels <=
        _scrollController.position.minScrollExtent + 50) {
      context.read<ChatProvider>().loadOlderMessages();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final chat = context.watch<ChatProvider>();
    final currentUserId = context.read<AuthProvider>().user?.id;

    // Buscar nombre del otro usuario
    final conv = chat.conversations
        .where((c) => c.matchId == widget.matchId)
        .toList();
    final otherUser = conv.isNotEmpty ? conv.first.otherUser : null;
    final otherName = otherUser?.displayName;

    return Scaffold(
      appBar: AppBar(
        title: InkWell(
          onTap: otherUser != null
              ? () => context.push('/user/${otherUser.id}')
              : null,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (otherUser?.avatarUrl != null &&
                  otherUser!.avatarUrl!.isNotEmpty) ...[
                CircleAvatar(
                  radius: 16,
                  backgroundImage: NetworkImage(otherUser.avatarUrl!),
                ),
                const SizedBox(width: 8),
              ],
              Text(otherName ?? 'Chat'),
              if (otherUser != null) ...[
                const SizedBox(width: 4),
                Icon(PhosphorIcons.caretRight(PhosphorIconsStyle.bold), size: 20),
              ],
            ],
          ),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          PopupMenuButton<String>(
            icon: Icon(PhosphorIcons.dotsThreeVertical(PhosphorIconsStyle.bold)),
            onSelected: (value) async {
              if (value == 'profile' && otherUser != null) {
                context.push('/user/${otherUser.id}');
              } else if (value == 'unmatch') {
                final confirmed = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: Text('¿Deshacer match${otherName != null ? ' con $otherName' : ''}?'),
                    content: const Text(
                      'Esta acción cerrará el chat y ya no podrán escribirse.',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text('Cancelar'),
                      ),
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        style: TextButton.styleFrom(
                          foregroundColor: theme.colorScheme.error,
                        ),
                        child: const Text('Deshacer match'),
                      ),
                    ],
                  ),
                );
                if (confirmed == true && context.mounted) {
                  final ok = await chat.unmatch(widget.matchId);
                  if (ok && context.mounted) {
                    context.go('/chat');
                  }
                }
              }
            },
            itemBuilder: (_) => [
              if (otherUser != null)
                const PopupMenuItem(
                  value: 'profile',
                  child: Text('Ver perfil'),
                ),
              PopupMenuItem(
                value: 'unmatch',
                child: Text(
                  'Deshacer match',
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          // Mensajes
          Expanded(
            child: _buildMessages(chat, currentUserId, theme),
          ),
          // Input
          _buildInput(context, chat, theme),
        ],
      ),
    );
  }

  Widget _buildMessages(
      ChatProvider chat, String? currentUserId, ThemeData theme) {
    if (chat.isLoadingMessages && chat.messages.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (chat.error != null && chat.messages.isEmpty) {
      return Center(
        child: Text(
          chat.error!,
          style: TextStyle(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
        ),
      );
    }

    if (chat.messages.isEmpty) {
      return Center(
        child: Text(
          'Envía el primer mensaje',
          style: TextStyle(
            color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
            fontSize: 16,
          ),
        ),
      );
    }

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      itemCount: chat.messages.length,
      itemBuilder: (context, index) {
        final message = chat.messages[index];
        final isMine = message.senderId == currentUserId;

        return _MessageBubble(
          message: message,
          isMine: isMine,
          theme: theme,
        );
      },
    );
  }

  Widget _buildInput(
      BuildContext context, ChatProvider chat, ThemeData theme) {
    return Container(
      padding: EdgeInsets.only(
        left: 12,
        right: 8,
        top: 8,
        bottom: MediaQuery.of(context).padding.bottom + 8,
      ),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border(
          top: BorderSide(
            color: theme.colorScheme.onSurface.withValues(alpha: 0.1),
          ),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _controller,
              maxLines: 4,
              minLines: 1,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                hintText: 'Escribe un mensaje...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide.none,
                ),
                filled: true,
                fillColor:
                    theme.colorScheme.onSurface.withValues(alpha: 0.05),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 10),
              ),
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            tooltip: 'Enviar mensaje',
            onPressed: _isSending ? null : () => _send(chat),
            icon: _isSending
                ? SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: theme.colorScheme.primary,
                    ),
                  )
                : Icon(PhosphorIcons.paperPlaneRight(PhosphorIconsStyle.fill), color: theme.colorScheme.primary),
          ),
        ],
      ),
    );
  }

  Future<void> _send(ChatProvider chat) async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;

    setState(() => _isSending = true);
    _controller.clear();

    await chat.sendMessage(text);

    setState(() => _isSending = false);

    // Scroll al final
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent + 60,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      );
    }
  }
}

class _MessageBubble extends StatelessWidget {
  final ChatMessage message;
  final bool isMine;
  final ThemeData theme;

  const _MessageBubble({
    required this.message,
    required this.isMine,
    required this.theme,
  });

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 3),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.75,
        ),
        decoration: BoxDecoration(
          color: isMine
              ? theme.colorScheme.primary
              : theme.colorScheme.onSurface.withValues(alpha: 0.08),
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isMine ? 16 : 4),
            bottomRight: Radius.circular(isMine ? 4 : 16),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              message.content,
              style: TextStyle(
                color: isMine
                    ? Colors.white
                    : theme.colorScheme.onSurface,
                fontSize: 15,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              _formatMessageTime(message.createdAt),
              style: TextStyle(
                fontSize: 11,
                color: isMine
                    ? Colors.white.withValues(alpha: 0.6)
                    : theme.colorScheme.onSurface.withValues(alpha: 0.4),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatMessageTime(DateTime dt) {
    return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}
