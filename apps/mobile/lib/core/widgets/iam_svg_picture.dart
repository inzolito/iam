import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/design_tokens.dart';

/// Datos pre-parseados de un archivo SVG (viewBox + lista de paths vectoriales).
class _ParsedSvgData {
  final double width;
  final double height;
  final List<_SvgPathEntry> paths;

  const _ParsedSvgData({
    required this.width,
    required this.height,
    required this.paths,
  });
}

class _SvgPathEntry {
  final Path path;
  final Color fill;
  final double tx;
  final double ty;

  const _SvgPathEntry({
    required this.path,
    required this.fill,
    this.tx = 0,
    this.ty = 0,
  });
}

/// Renderizador nativo y ligero de SVG para los assets vectoriales de marca IAM
/// (`iam_wordmark.svg`, `iam_header_wordmark.svg`, `iam_crowd.svg`).
///
/// Lee directamente los archivos `.svg` desde `assets/images/`, cachea las
/// curvas Bezier (`M`, `C`, `L`, `Z`) en memoria y soporta [BoxFit.contain]
/// y [BoxFit.cover] (equivalente a `preserveAspectRatio="xMidYMax slice"`).
class IamSvgPicture extends StatefulWidget {
  final String assetName;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Alignment alignment;

  const IamSvgPicture.asset(
    this.assetName, {
    super.key,
    this.width,
    this.height,
    this.fit = BoxFit.contain,
    this.alignment = Alignment.center,
  });

  static final Map<String, _ParsedSvgData> _cache = {};

  /// Precarga todos los SVG de marca antes de `runApp()` para que el Splash
  /// y el Header se pinten en el primer frame sin parpadeo.
  static Future<void> preloadAll() async {
    for (final asset in const [
      DesignTokens.wordmarkSvgAsset,
      DesignTokens.headerWordmarkSvgAsset,
      DesignTokens.crowdSvgAsset,
    ]) {
      if (_cache.containsKey(asset)) continue;
      try {
        final raw = await rootBundle.loadString(asset);
        _cache[asset] = _IamSvgPictureState._parseSvg(raw);
      } catch (_) {}
    }
  }

  @override
  State<IamSvgPicture> createState() => _IamSvgPictureState();
}

class _IamSvgPictureState extends State<IamSvgPicture> {
  _ParsedSvgData? _data;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant IamSvgPicture oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.assetName != widget.assetName) {
      _load();
    }
  }

  Future<void> _load() async {
    final cached = IamSvgPicture._cache[widget.assetName];
    if (cached != null) {
      _data = cached;
      return;
    }
    try {
      final raw = await rootBundle.loadString(widget.assetName);
      final parsed = _parseSvg(raw);
      IamSvgPicture._cache[widget.assetName] = parsed;
      if (mounted) {
        setState(() => _data = parsed);
      }
    } catch (_) {
      // En entorno de test si el asset no está cargado, no crashea.
    }
  }

  static _ParsedSvgData _parseSvg(String xml) {
    double vw = 1000;
    double vh = 1000;
    final vbMatch = RegExp(
      r'viewBox="[^"]*?([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)"',
    ).firstMatch(xml);
    if (vbMatch != null) {
      vw = double.tryParse(vbMatch.group(3) ?? '') ?? 1000;
      vh = double.tryParse(vbMatch.group(4) ?? '') ?? 1000;
    }

    final entries = <_SvgPathEntry>[];
    final pathTags = RegExp(r'<path\b([^>]*)/?>').allMatches(xml);
    for (final m in pathTags) {
      final attrs = m.group(1) ?? '';
      final dMatch = RegExp(r'\bd="([^"]+)"').firstMatch(attrs);
      final fillMatch = RegExp(r'\bfill="#([0-9A-Fa-f]{6})"').firstMatch(attrs);
      if (dMatch == null || fillMatch == null) continue;

      double tx = 0;
      double ty = 0;
      final trMatch = RegExp(
        r'transform="translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)"',
      ).firstMatch(attrs);
      if (trMatch != null) {
        tx = double.tryParse(trMatch.group(1) ?? '0') ?? 0;
        ty = double.tryParse(trMatch.group(2) ?? '0') ?? 0;
      }

      final colorVal = int.parse('FF${fillMatch.group(1)!}', radix: 16);
      final path = _parsePathData(dMatch.group(1)!);
      entries.add(
        _SvgPathEntry(
          path: path,
          fill: Color(colorVal),
          tx: tx,
          ty: ty,
        ),
      );
    }

    return _ParsedSvgData(width: vw, height: vh, paths: entries);
  }

  static Path _parsePathData(String d) {
    final path = Path();
    final tokens = RegExp(r'[A-Za-z]|[-+]?\d*\.?\d+').allMatches(d);
    String cmd = '';
    final nums = <double>[];

    void flush() {
      if (cmd.isEmpty) return;
      switch (cmd) {
        case 'M':
          for (var i = 0; i + 1 < nums.length; i += 2) {
            if (i == 0) {
              path.moveTo(nums[i], nums[i + 1]);
            } else {
              path.lineTo(nums[i], nums[i + 1]);
            }
          }
          break;
        case 'L':
          for (var i = 0; i + 1 < nums.length; i += 2) {
            path.lineTo(nums[i], nums[i + 1]);
          }
          break;
        case 'C':
          for (var i = 0; i + 5 < nums.length; i += 6) {
            path.cubicTo(
              nums[i],
              nums[i + 1],
              nums[i + 2],
              nums[i + 3],
              nums[i + 4],
              nums[i + 5],
            );
          }
          break;
        case 'Z':
        case 'z':
          path.close();
          break;
      }
      nums.clear();
    }

    for (final t in tokens) {
      final s = t.group(0)!;
      final c = s.codeUnitAt(0);
      final isLetter = (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
      if (isLetter) {
        flush();
        cmd = s;
        if (cmd == 'Z' || cmd == 'z') {
          flush();
          cmd = '';
        }
      } else {
        final v = double.tryParse(s);
        if (v != null) nums.add(v);
      }
    }
    flush();
    return path;
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    if (data == null) {
      return SizedBox(width: widget.width, height: widget.height);
    }
    double? w = widget.width;
    double? h = widget.height;
    if (w == null && h != null && data.height > 0) {
      w = h * (data.width / data.height);
    } else if (h == null && w != null && data.width > 0) {
      h = w * (data.height / data.width);
    }

    return SizedBox(
      width: w,
      height: h,
      child: CustomPaint(
        painter: _SvgDataPainter(
          data: data,
          fit: widget.fit,
          alignment: widget.alignment,
        ),
      ),
    );
  }
}

class _SvgDataPainter extends CustomPainter {
  final _ParsedSvgData data;
  final BoxFit fit;
  final Alignment alignment;

  const _SvgDataPainter({
    required this.data,
    required this.fit,
    required this.alignment,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty || data.width <= 0 || data.height <= 0) return;

    final srcSize = Size(data.width, data.height);
    final fitted = applyBoxFit(fit, srcSize, size);
    final srcRect = alignment.inscribe(fitted.source, Offset.zero & srcSize);
    final dstRect = alignment.inscribe(fitted.destination, Offset.zero & size);

    final sx = dstRect.width / srcRect.width;
    final sy = dstRect.height / srcRect.height;

    canvas.save();
    canvas.clipRect(Offset.zero & size);
    canvas.translate(dstRect.left, dstRect.top);
    canvas.scale(sx, sy);
    canvas.translate(-srcRect.left, -srcRect.top);

    final paint = Paint()..style = PaintingStyle.fill;
    for (final entry in data.paths) {
      paint.color = entry.fill;
      if (entry.tx != 0 || entry.ty != 0) {
        canvas.save();
        canvas.translate(entry.tx, entry.ty);
        canvas.drawPath(entry.path, paint);
        canvas.restore();
      } else {
        canvas.drawPath(entry.path, paint);
      }
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _SvgDataPainter oldDelegate) =>
      oldDelegate.data != data ||
      oldDelegate.fit != fit ||
      oldDelegate.alignment != alignment;
}

/// Tarjeta/Lienzo reutilizable con el logo compuesto en 3 capas:
/// Fondo `#6BB9E8` + `iam_wordmark.svg` arriba + `iam_crowd.svg` anclado abajo.
/// Se usa en Configuración (y cualquier otra pantalla que muestre la marca grande).
class IamHeroLogoBanner extends StatelessWidget {
  final double height;
  final double borderRadius;

  const IamHeroLogoBanner({
    super.key,
    this.height = 240,
    this.borderRadius = 24,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: DesignTokens.heroBackground,
        borderRadius: BorderRadius.circular(borderRadius),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          Align(
            alignment: const Alignment(0, -0.45),
            child: FractionallySizedBox(
              widthFactor: 0.54,
              child: IamSvgPicture.asset(
                DesignTokens.wordmarkSvgAsset,
                fit: BoxFit.contain,
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: height * 0.52,
            child: IamSvgPicture.asset(
              DesignTokens.crowdSvgAsset,
              fit: BoxFit.cover,
              alignment: Alignment.bottomCenter,
            ),
          ),
        ],
      ),
    );
  }
}

