/// Variables de entorno para la app IAM.
///
/// Se inyectan via --dart-define en build/run:
/// ```bash
/// flutter run \
///   --dart-define=SUPABASE_URL=https://xxx.supabase.co \
///   --dart-define=SUPABASE_ANON_KEY=eyJ... \
///   --dart-define=API_BASE_URL=https://api.iam.app \
///   --dart-define=ENV=staging
/// ```
class Env {
  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: '',
  );

  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: '',
  );

  /// URL base del backend NestJS.
  /// - Por defecto usa Supabase Edge Functions: `${SUPABASE_URL}/functions/v1`
  /// - Si se provee API_BASE_URL, tiene prioridad (ej. staging/dev del NestJS directo)
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  /// Entorno actual: dev | staging | prod
  static const String environment = String.fromEnvironment(
    'ENV',
    defaultValue: 'dev',
  );

  static bool get isDev => environment == 'dev';
  static bool get isStaging => environment == 'staging';
  static bool get isProd => environment == 'prod';

  static bool get isConfigured =>
      supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;

  /// URL base efectiva para ApiService.
  ///
  /// El backend NestJS tiene `setGlobalPrefix('v1')`, así que todos los
  /// endpoints quedan bajo `/v1`. Los providers llaman sin ese prefix
  /// (ej: `/feed`, `/matches`) — el prefix se agrega acá.
  ///
  /// - `${SUPABASE_URL}/functions/v1` — Supabase Edge Functions (default)
  /// - `${API_BASE_URL}/v1` — NestJS directo (staging/prod)
  static String get effectiveApiBaseUrl {
    if (apiBaseUrl.isNotEmpty) {
      // Si el user ya terminó con /v1, respetar; si no, agregar
      return apiBaseUrl.endsWith('/v1') ? apiBaseUrl : '$apiBaseUrl/v1';
    }
    return '$supabaseUrl/functions/v1';
  }
}
