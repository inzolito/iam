import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/env.dart';

/// Cliente HTTP para comunicarse con el backend NestJS.
class ApiService {
  final String _baseUrl;
  String? _accessToken;

  ApiService({String? baseUrl})
      : _baseUrl = baseUrl ?? Env.effectiveApiBaseUrl;

  void setToken(String token) {
    _accessToken = token;
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
      };

  Future<Map<String, dynamic>> get(String path) async {
    final response = await http.get(
      Uri.parse('$_baseUrl$path'),
      headers: _headers,
    );
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl$path'),
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> patch(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final response = await http.patch(
      Uri.parse('$_baseUrl$path'),
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> delete(String path) async {
    final response = await http.delete(
      Uri.parse('$_baseUrl$path'),
      headers: _headers,
    );
    return _handleResponse(response);
  }

  /// Upload multipart — envía bytes como archivo.
  ///
  /// [field] nombre del field en el form (ej: 'file', 'avatar').
  /// [filename] nombre con extensión (ej: 'avatar.jpg').
  /// [method] POST (default), o PATCH.
  /// [extraFields] campos adicionales de texto.
  ///
  /// Nota: el Content-Type del part se infiere del backend a partir
  /// de la extensión del filename (NestJS/Fastify/Express manejan esto).
  Future<Map<String, dynamic>> uploadFile(
    String path, {
    required List<int> bytes,
    required String field,
    required String filename,
    String method = 'POST',
    Map<String, String>? extraFields,
  }) async {
    final uri = Uri.parse('$_baseUrl$path');
    final request = http.MultipartRequest(method, uri);

    if (_accessToken != null) {
      request.headers['Authorization'] = 'Bearer $_accessToken';
    }
    if (extraFields != null) {
      request.fields.addAll(extraFields);
    }

    request.files.add(
      http.MultipartFile.fromBytes(field, bytes, filename: filename),
    );

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    return _handleResponse(response);
  }

  Map<String, dynamic> _handleResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return {};
      return jsonDecode(response.body) as Map<String, dynamic>;
    }

    final error = response.body.isNotEmpty
        ? jsonDecode(response.body)
        : {'message': 'Error desconocido'};

    throw ApiException(
      statusCode: response.statusCode,
      message: error['message'] ?? 'Error del servidor',
    );
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String message;

  ApiException({required this.statusCode, required this.message});

  @override
  String toString() => 'ApiException($statusCode): $message';
}
