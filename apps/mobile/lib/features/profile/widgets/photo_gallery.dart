import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/services/media_service.dart';
import '../media_provider.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

/// Grilla de fotos editable (añadir, borrar, marcar como principal).
class PhotoGallery extends StatelessWidget {
  const PhotoGallery({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final media = context.watch<MediaProvider>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('Fotos',
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.w600)),
            const Spacer(),
            Text(
              '${media.photos.length}/${MediaProvider.maxPhotos}',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        if (media.isUploading) ...[
          LinearProgressIndicator(value: media.uploadProgress),
          const SizedBox(height: 8),
        ],

        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 3,
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
          children: [
            for (var i = 0; i < media.photos.length; i++)
              _PhotoTile(
                photo: media.photos[i],
                index: i,
                allPhotos: media.photos,
                theme: theme,
              ),
            if (media.canAddMorePhotos)
              _AddPhotoTile(
                onTap: () => _showPickerSheet(context, media),
                theme: theme,
              ),
          ],
        ),
        if (media.error != null) ...[
          const SizedBox(height: 8),
          Text(
            media.error!,
            style: TextStyle(
                color: theme.colorScheme.error, fontSize: 12),
          ),
        ],
      ],
    );
  }

  void _showPickerSheet(BuildContext context, MediaProvider media) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 8),
            ListTile(
              leading: Icon(PhosphorIcons.imagesSquare(PhosphorIconsStyle.regular)),
              title: const Text('Elegir de galería'),
              onTap: () {
                Navigator.pop(ctx);
                media.pickAndUploadPhoto(
                    source: ImageSourceType.gallery);
              },
            ),
            if (media.isUploading == false)
              ListTile(
                leading: Icon(PhosphorIcons.camera(PhosphorIconsStyle.regular)),
                title: const Text('Tomar foto'),
                onTap: () {
                  Navigator.pop(ctx);
                  media.pickAndUploadPhoto(source: ImageSourceType.camera);
                },
              ),
          ],
        ),
      ),
    );
  }
}

class _PhotoTile extends StatelessWidget {
  final UserPhoto photo;
  final int index;
  final List<UserPhoto> allPhotos;
  final ThemeData theme;

  const _PhotoTile({
    required this.photo,
    required this.index,
    required this.allPhotos,
    required this.theme,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        GestureDetector(
          onTap: () => _openViewer(context),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.network(
              photo.thumbnailUrl ?? photo.url,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                color: theme.colorScheme.surfaceContainerHighest,
                child: Icon(PhosphorIcons.imageBroken(PhosphorIconsStyle.regular)),
              ),
            ),
          ),
        ),
        if (photo.isPrimary)
          Positioned(
            top: 4,
            left: 4,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: theme.colorScheme.primary,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'Principal',
                style: TextStyle(
                    color: theme.colorScheme.onPrimary,
                    fontSize: 10,
                    fontWeight: FontWeight.w600),
              ),
            ),
          ),
        Positioned(
          top: 4,
          right: 4,
          child: Material(
            color: Colors.black54,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => _showActions(context),
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: Icon(PhosphorIcons.dotsThreeVertical(PhosphorIconsStyle.bold),
                    size: 16, color: Colors.white),
              ),
            ),
          ),
        ),
      ],
    );
  }

  void _openViewer(BuildContext context) {
    showDialog<void>(
      context: context,
      barrierColor: Colors.black,
      builder: (_) => _FullScreenGalleryViewer(
        photos: allPhotos,
        initialIndex: index,
      ),
    );
  }

  void _showActions(BuildContext context) {
    final provider = context.read<MediaProvider>();
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!photo.isPrimary)
              ListTile(
                leading: Icon(PhosphorIcons.star(PhosphorIconsStyle.regular)),
                title: const Text('Marcar como principal'),
                onTap: () {
                  Navigator.pop(ctx);
                  provider.setPrimaryPhoto(photo.id);
                },
              ),
            ListTile(
              leading: Icon(PhosphorIcons.trash(PhosphorIconsStyle.regular),
                  color: theme.colorScheme.error),
              title: Text('Eliminar',
                  style: TextStyle(color: theme.colorScheme.error)),
              onTap: () {
                Navigator.pop(ctx);
                provider.deletePhoto(photo.id);
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _AddPhotoTile extends StatelessWidget {
  final VoidCallback onTap;
  final ThemeData theme;

  const _AddPhotoTile({required this.onTap, required this.theme});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: theme.colorScheme.primary.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: theme.colorScheme.primary.withValues(alpha: 0.4),
            style: BorderStyle.solid,
            width: 1.5,
          ),
        ),
        child: Center(
          child: Icon(PhosphorIcons.cameraPlus(PhosphorIconsStyle.regular),
              color: theme.colorScheme.primary, size: 32),
        ),
      ),
    );
  }
}

class _FullScreenGalleryViewer extends StatefulWidget {
  final List<UserPhoto> photos;
  final int initialIndex;

  const _FullScreenGalleryViewer({
    required this.photos,
    required this.initialIndex,
  });

  @override
  State<_FullScreenGalleryViewer> createState() =>
      _FullScreenGalleryViewerState();
}

class _FullScreenGalleryViewerState extends State<_FullScreenGalleryViewer> {
  late final PageController _controller;
  late int _current;

  @override
  void initState() {
    super.initState();
    _current = widget.initialIndex;
    _controller = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text('${_current + 1} / ${widget.photos.length}'),
        centerTitle: true,
        leading: IconButton(
          icon: Icon(PhosphorIcons.x(PhosphorIconsStyle.bold)),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: PageView.builder(
        controller: _controller,
        itemCount: widget.photos.length,
        onPageChanged: (i) => setState(() => _current = i),
        itemBuilder: (_, i) => InteractiveViewer(
          minScale: 1,
          maxScale: 4,
          child: Center(
            child: Image.network(
              widget.photos[i].url,
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => const Icon(
                Icons.broken_image_outlined,
                color: Colors.white54,
                size: 48,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
