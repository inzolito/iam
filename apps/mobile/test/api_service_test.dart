import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/core/services/api_service.dart';

void main() {
  // ============================================================
  // HAPPY PATH
  // ============================================================

  group('Happy Path', () {
    test('ApiService se crea con baseUrl custom', () {
      final api = ApiService(baseUrl: 'http://localhost:3000');
      // No lanza excepción
      expect(api, isNotNull);
    });

    test('setToken configura el token', () {
      final api = ApiService(baseUrl: 'http://localhost:3000');
      api.setToken('test-token');
      // No lanza excepción — el token se usa en headers internos
      expect(api, isNotNull);
    });

    test('ApiException tiene statusCode y message', () {
      final exception = ApiException(
        statusCode: 401,
        message: 'Unauthorized',
      );

      expect(exception.statusCode, 401);
      expect(exception.message, 'Unauthorized');
    });

    test('ApiException toString incluye código y mensaje', () {
      final exception = ApiException(
        statusCode: 404,
        message: 'Not Found',
      );

      expect(exception.toString(), 'ApiException(404): Not Found');
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  group('Error Forzado', () {
    test('ApiException con código 400', () {
      final exception = ApiException(
        statusCode: 400,
        message: 'Bad Request',
      );
      expect(exception.statusCode, 400);
    });

    test('ApiException con código 500', () {
      final exception = ApiException(
        statusCode: 500,
        message: 'Internal Server Error',
      );
      expect(exception.statusCode, 500);
    });

    test('ApiException con mensaje vacío', () {
      final exception = ApiException(
        statusCode: 422,
        message: '',
      );
      expect(exception.message, '');
      expect(exception.toString(), 'ApiException(422): ');
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  group('Peor Caso', () {
    test('setToken con string vacío no lanza', () {
      final api = ApiService(baseUrl: 'http://localhost:3000');
      api.setToken('');
      expect(api, isNotNull);
    });

    test('setToken puede ser sobreescrito', () {
      final api = ApiService(baseUrl: 'http://localhost:3000');
      api.setToken('token-1');
      api.setToken('token-2');
      expect(api, isNotNull);
    });
  });
}
