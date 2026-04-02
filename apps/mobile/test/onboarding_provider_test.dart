import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/features/onboarding/onboarding_provider.dart';
import 'package:iam_mobile/core/services/api_service.dart';

/// Mock ApiService que no hace HTTP real.
class MockApiService extends ApiService {
  final Map<String, dynamic> Function(String method, String path, Map<String, dynamic>? body)? handler;

  MockApiService({this.handler}) : super(baseUrl: 'http://localhost');

  @override
  Future<Map<String, dynamic>> get(String path) async {
    return handler?.call('GET', path, null) ?? {};
  }

  @override
  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body}) async {
    return handler?.call('POST', path, body) ?? {};
  }

  @override
  Future<Map<String, dynamic>> patch(String path, {Map<String, dynamic>? body}) async {
    return handler?.call('PATCH', path, body) ?? {};
  }
}

void main() {
  late OnboardingProvider provider;
  late MockApiService mockApi;

  setUp(() {
    mockApi = MockApiService(
      handler: (method, path, body) {
        if (path.contains('/diagnoses')) {
          return {
            'diagnoses': body?['diagnoses'] ?? [],
            'theme': {'key': 'zen'},
          };
        }
        if (path.contains('/spin') && method == 'POST') {
          return {'spin': []};
        }
        if (path.contains('/complete')) {
          return {'onboarding_completed': true};
        }
        return {};
      },
    );
    provider = OnboardingProvider(mockApi);
  });

  // ============================================================
  // HAPPY PATH
  // ============================================================

  group('Happy Path', () {
    test('initial state has step 0, no diagnoses, no spin', () {
      expect(provider.currentStep, 0);
      expect(provider.selectedDiagnoses, isEmpty);
      expect(provider.primaryDiagnosis, isNull);
      expect(provider.selectedTagIds, isEmpty);
    });

    test('toggle diagnosis adds and sets as primary', () {
      provider.toggleDiagnosis('TEA');

      expect(provider.selectedDiagnoses, contains('TEA'));
      expect(provider.primaryDiagnosis, 'TEA');
    });

    test('toggle second diagnosis keeps first as primary', () {
      provider.toggleDiagnosis('TEA');
      provider.toggleDiagnosis('AACC');

      expect(provider.selectedDiagnoses, containsAll(['TEA', 'AACC']));
      expect(provider.primaryDiagnosis, 'TEA');
    });

    test('setPrimaryDiagnosis changes primary', () {
      provider.toggleDiagnosis('TEA');
      provider.toggleDiagnosis('AACC');
      provider.setPrimaryDiagnosis('AACC');

      expect(provider.primaryDiagnosis, 'AACC');
    });

    test('TEA diagnosis sets zen theme', () {
      provider.toggleDiagnosis('TEA');
      expect(provider.currentTheme.colorScheme.primary, const Color(0xFF7EB8D4));
    });

    test('TDAH diagnosis sets dashboard theme (dark)', () {
      provider.toggleDiagnosis('TDAH');
      expect(provider.currentTheme.brightness, Brightness.dark);
    });

    test('addTag adds to selected tags', () {
      final tag = {'id': 't1', 'slug': 'anime', 'display_name': 'Anime', 'category_id': 'c1'};
      provider.addTag(tag);

      expect(provider.selectedTagIds, contains('t1'));
      expect(provider.selectedTags, hasLength(1));
    });

    test('removeTag removes from selected', () {
      provider.addTag({'id': 't1', 'slug': 'anime', 'display_name': 'Anime', 'category_id': 'c1'});
      provider.removeTag('t1');

      expect(provider.selectedTagIds, isEmpty);
      expect(provider.selectedTags, isEmpty);
    });

    test('nextStep increments, previousStep decrements', () {
      provider.toggleDiagnosis('TEA');
      provider.nextStep();
      expect(provider.currentStep, 1);

      provider.previousStep();
      expect(provider.currentStep, 0);
    });

    test('canProceedFromDiagnosis is true when diagnosis selected', () {
      expect(provider.canProceedFromDiagnosis, false);
      provider.toggleDiagnosis('TEA');
      expect(provider.canProceedFromDiagnosis, true);
    });

    test('canProceedFromSpin is true when tags selected', () {
      expect(provider.canProceedFromSpin, false);
      provider.addTag({'id': 't1', 'slug': 'anime', 'display_name': 'Anime', 'category_id': 'c1'});
      expect(provider.canProceedFromSpin, true);
    });

    test('submitOnboarding calls API and returns true', () async {
      provider.toggleDiagnosis('TEA');
      provider.addTag({'id': 't1', 'slug': 'anime', 'display_name': 'Anime', 'category_id': 'c1'});
      provider.setDisplayName('Test User');
      provider.setBirthDate('2000-01-01');

      final result = await provider.submitOnboarding();
      expect(result, true);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  group('Error Forzado', () {
    test('toggle diagnosis off removes it', () {
      provider.toggleDiagnosis('TEA');
      provider.toggleDiagnosis('TEA'); // toggle off

      expect(provider.selectedDiagnoses, isEmpty);
      expect(provider.primaryDiagnosis, isNull);
    });

    test('removing primary reassigns to first remaining', () {
      provider.toggleDiagnosis('TEA');
      provider.toggleDiagnosis('AACC');
      provider.toggleDiagnosis('TEA'); // remove primary

      expect(provider.primaryDiagnosis, 'AACC');
    });

    test('setPrimaryDiagnosis on unselected does nothing', () {
      provider.toggleDiagnosis('TEA');
      provider.setPrimaryDiagnosis('AACC'); // not selected

      expect(provider.primaryDiagnosis, 'TEA');
    });

    test('previousStep at 0 stays at 0', () {
      provider.previousStep();
      expect(provider.currentStep, 0);
    });

    test('nextStep at 2 stays at 2', () {
      provider.nextStep(); // 0→1
      provider.nextStep(); // 1→2
      provider.nextStep(); // stays 2
      expect(provider.currentStep, 2);
    });

    test('submitOnboarding handles API error', () async {
      final errorApi = MockApiService(
        handler: (method, path, body) {
          throw ApiException(statusCode: 400, message: 'Bad request');
        },
      );
      final errorProvider = OnboardingProvider(errorApi);
      errorProvider.toggleDiagnosis('TEA');
      errorProvider.setDisplayName('Test');
      errorProvider.setBirthDate('2000-01-01');

      final result = await errorProvider.submitOnboarding();
      expect(result, false);
      expect(errorProvider.error, isNotNull);
    });

    test('canComplete requires displayName and birthDate', () {
      expect(provider.canComplete, false);

      provider.setDisplayName('Name');
      expect(provider.canComplete, false);

      provider.setBirthDate('2000-01-01');
      expect(provider.canComplete, true);
    });

    test('canComplete is false with empty displayName', () {
      provider.setDisplayName('   ');
      provider.setBirthDate('2000-01-01');
      expect(provider.canComplete, false);
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  group('Peor Caso', () {
    test('cannot add more than 20 tags', () {
      for (int i = 0; i < 20; i++) {
        provider.addTag({
          'id': 'tag-$i',
          'slug': 'tag-$i',
          'display_name': 'Tag $i',
          'category_id': 'cat-${i % 5}', // 4 per category
        });
      }

      expect(provider.selectedTagIds.length, 20);

      // 21st should fail
      final canAdd = provider.canAddTag({
        'id': 'tag-21',
        'slug': 'tag-21',
        'display_name': 'Tag 21',
        'category_id': 'cat-new',
      });
      expect(canAdd, false);
    });

    test('cannot add more than 5 per category', () {
      for (int i = 0; i < 5; i++) {
        provider.addTag({
          'id': 'tag-$i',
          'slug': 'tag-$i',
          'display_name': 'Tag $i',
          'category_id': 'same-cat',
        });
      }

      final canAdd = provider.canAddTag({
        'id': 'tag-5',
        'slug': 'tag-5',
        'display_name': 'Tag 5',
        'category_id': 'same-cat',
      });
      expect(canAdd, false);
    });

    test('cannot add duplicate tag', () {
      provider.addTag({
        'id': 'tag-1',
        'slug': 'anime',
        'display_name': 'Anime',
        'category_id': 'c1',
      });

      final canAdd = provider.canAddTag({
        'id': 'tag-1',
        'slug': 'anime',
        'display_name': 'Anime',
        'category_id': 'c1',
      });
      expect(canAdd, false);
    });

    test('all diagnoses can be selected simultaneously', () {
      for (final diag in OnboardingProvider.availableDiagnoses) {
        provider.toggleDiagnosis(diag['key']!);
      }

      expect(provider.selectedDiagnoses.length,
          OnboardingProvider.availableDiagnoses.length);
      expect(provider.primaryDiagnosis, 'TEA'); // first selected
    });

    test('rapid toggle does not corrupt state', () {
      for (int i = 0; i < 100; i++) {
        provider.toggleDiagnosis('TEA');
      }
      // Even iterations = unselected
      expect(provider.selectedDiagnoses, isEmpty);
    });

    test('theme resets to default when all diagnoses removed', () {
      provider.toggleDiagnosis('TDAH');
      expect(provider.currentTheme.brightness, Brightness.dark);

      provider.toggleDiagnosis('TDAH'); // remove
      expect(provider.currentTheme.brightness, Brightness.light); // default
    });
  });
}
