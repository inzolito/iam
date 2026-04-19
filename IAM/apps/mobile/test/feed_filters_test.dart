import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/features/feed/feed_filters.dart';

void main() {
  // ============================================================
  // HAPPY PATH
  // ============================================================

  group('Happy Path', () {
    test('FeedFilters.none no tiene filtros activos', () {
      const f = FeedFilters.none;

      expect(f.hasActiveFilters, false);
      expect(f.activeCount, 0);
      expect(f.isValid, true);
      expect(f.toQueryParams(), isEmpty);
      expect(f.toQueryString(), '');
    });

    test('toggleDiagnosis agrega y remueve', () {
      const f = FeedFilters.none;

      final withTea = f.toggleDiagnosis('TEA');
      expect(withTea.diagnoses, {'TEA'});
      expect(withTea.activeCount, 1);

      final withTeaTdah = withTea.toggleDiagnosis('TDAH');
      expect(withTeaTdah.diagnoses, {'TEA', 'TDAH'});

      final backToTea = withTeaTdah.toggleDiagnosis('TDAH');
      expect(backToTea.diagnoses, {'TEA'});
    });

    test('toggleTag agrega y remueve', () {
      const f = FeedFilters.none;

      final f2 = f.toggleTag('tag1').toggleTag('tag2');
      expect(f2.tagIds, {'tag1', 'tag2'});

      final f3 = f2.toggleTag('tag1');
      expect(f3.tagIds, {'tag2'});
    });

    test('toQueryParams serializa diagnósticos con coma', () {
      const f = FeedFilters(diagnoses: {'TEA', 'TDAH'});

      final params = f.toQueryParams();

      expect(params['diagnoses'], isNotNull);
      final values = params['diagnoses']!.split(',');
      expect(values.toSet(), {'TEA', 'TDAH'});
    });

    test('toQueryParams serializa edad y radio', () {
      const f = FeedFilters(
        minAge: 18,
        maxAge: 35,
        radiusMeters: 25000,
      );

      final params = f.toQueryParams();

      expect(params['minAge'], '18');
      expect(params['maxAge'], '35');
      expect(params['radius'], '25000');
    });

    test('toQueryParams serializa tags con coma', () {
      const f = FeedFilters(tagIds: {'t1', 't2', 't3'});

      final params = f.toQueryParams();

      final values = params['tags']!.split(',');
      expect(values.toSet(), {'t1', 't2', 't3'});
    });

    test('toQueryParams incluye sort solo si no es compatibility', () {
      const defaultSort = FeedFilters();
      const byDistance = FeedFilters(sort: FeedSort.distance);

      expect(defaultSort.toQueryParams().containsKey('sort'), false);
      expect(byDistance.toQueryParams()['sort'], 'distance');
    });

    test('toQueryParams serializa minEnergy e includeTeens', () {
      const f = FeedFilters(
        minEnergyLevel: 2,
        includeTeens: false,
      );

      final params = f.toQueryParams();

      expect(params['minEnergy'], '2');
      expect(params['includeTeens'], 'false');
    });

    test('toQueryString genera prefijo ? y encoding', () {
      const f = FeedFilters(minAge: 18, maxAge: 30);

      final qs = f.toQueryString();

      expect(qs.startsWith('?'), true);
      expect(qs, contains('minAge=18'));
      expect(qs, contains('maxAge=30'));
    });

    test('activeCount cuenta grupos, no campos individuales', () {
      const f = FeedFilters(
        minAge: 18,
        maxAge: 30, // mismo grupo "edad"
      );

      expect(f.activeCount, 1);
    });

    test('activeCount 0 con FeedFilters.none', () {
      expect(FeedFilters.none.activeCount, 0);
    });

    test('copyWith preserva campos no especificados', () {
      const original = FeedFilters(
        diagnoses: {'TEA'},
        minAge: 20,
        sort: FeedSort.distance,
      );

      final copy = original.copyWith(maxAge: 40);

      expect(copy.diagnoses, {'TEA'});
      expect(copy.minAge, 20);
      expect(copy.maxAge, 40);
      expect(copy.sort, FeedSort.distance);
    });

    test('copyWith clearMinAge resetea a null', () {
      const f = FeedFilters(minAge: 20);

      final cleared = f.copyWith(clearMinAge: true);

      expect(cleared.minAge, isNull);
    });

    test('copyWith clearRadius resetea a null', () {
      const f = FeedFilters(radiusMeters: 10000);

      final cleared = f.copyWith(clearRadius: true);

      expect(cleared.radiusMeters, isNull);
    });

    test('copyWith clearMinEnergy + clearIncludeTeens', () {
      const f = FeedFilters(minEnergyLevel: 2, includeTeens: true);

      final cleared =
          f.copyWith(clearMinEnergy: true, clearIncludeTeens: true);

      expect(cleared.minEnergyLevel, isNull);
      expect(cleared.includeTeens, isNull);
    });

    test('FeedSort.apiValue y label', () {
      expect(FeedSort.compatibility.apiValue, 'compatibility');
      expect(FeedSort.distance.apiValue, 'distance');
      expect(FeedSort.recent.apiValue, 'recent');

      expect(FeedSort.compatibility.label, 'Compatibilidad');
      expect(FeedSort.distance.label, 'Distancia');
      expect(FeedSort.recent.label, 'Actividad reciente');
    });

    test('equality: dos FeedFilters idénticos son iguales', () {
      const a = FeedFilters(diagnoses: {'TEA'}, minAge: 20);
      const b = FeedFilters(diagnoses: {'TEA'}, minAge: 20);

      expect(a == b, true);
      expect(a.hashCode, b.hashCode);
    });

    test('equality: orden del Set no importa', () {
      final a = FeedFilters(diagnoses: {'TEA', 'TDAH'}.toSet());
      final b = FeedFilters(diagnoses: {'TDAH', 'TEA'}.toSet());

      expect(a == b, true);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  group('Error Forzado', () {
    test('isValid false: minAge < 13', () {
      const f = FeedFilters(minAge: 10);
      expect(f.isValid, false);
    });

    test('isValid false: maxAge > 120', () {
      const f = FeedFilters(maxAge: 150);
      expect(f.isValid, false);
    });

    test('isValid false: minAge > maxAge', () {
      const f = FeedFilters(minAge: 40, maxAge: 20);
      expect(f.isValid, false);
    });

    test('isValid false: radius negativo', () {
      const f = FeedFilters(radiusMeters: -100);
      expect(f.isValid, false);
    });

    test('isValid false: minEnergyLevel fuera de rango', () {
      const low = FeedFilters(minEnergyLevel: 0);
      const high = FeedFilters(minEnergyLevel: 5);

      expect(low.isValid, false);
      expect(high.isValid, false);
    });

    test('isValid true: bordes válidos', () {
      const f = FeedFilters(
        minAge: 13,
        maxAge: 120,
        radiusMeters: 0,
        minEnergyLevel: 1,
      );

      expect(f.isValid, true);
    });

    test('inequality: diferente diagnosis', () {
      const a = FeedFilters(diagnoses: {'TEA'});
      const b = FeedFilters(diagnoses: {'TDAH'});

      expect(a == b, false);
    });

    test('inequality: diferente sort', () {
      const a = FeedFilters(minAge: 20, sort: FeedSort.compatibility);
      const b = FeedFilters(minAge: 20, sort: FeedSort.distance);

      expect(a == b, false);
    });

    test('inequality: comparación con null / otro tipo', () {
      const f = FeedFilters.none;

      expect(f == null, false);
      expect(f == 'string', false);
    });

    test('toggleDiagnosis con misma clave toggleada 2x vuelve al inicio', () {
      const f = FeedFilters(diagnoses: {'TEA'});

      final f2 = f.toggleDiagnosis('TEA').toggleDiagnosis('TEA');

      expect(f2.diagnoses, {'TEA'}); // toggle twice = same
    });
  });

  // ============================================================
  // PEOR CASO
  // ============================================================

  group('Peor Caso', () {
    test('toQueryString con todos los filtros activos', () {
      const f = FeedFilters(
        diagnoses: {'TEA', 'TDAH'},
        minAge: 18,
        maxAge: 40,
        radiusMeters: 50000,
        tagIds: {'t1', 't2'},
        minEnergyLevel: 2,
        includeTeens: false,
        sort: FeedSort.distance,
      );

      final qs = f.toQueryString();
      final params = f.toQueryParams();

      expect(qs.startsWith('?'), true);
      // al menos 8 pares clave=valor
      expect('?'.allMatches(qs).length, 1);
      expect('&'.allMatches(qs).length, params.length - 1);
      expect(f.activeCount, 7);
    });

    test('copyWith sobreescribe Set completo, no lo mergea', () {
      const original = FeedFilters(diagnoses: {'TEA', 'TDAH'});

      final replaced = original.copyWith(diagnoses: {'AACC'});

      expect(replaced.diagnoses, {'AACC'});
    });

    test('toQueryParams con diagnoses vacío no incluye el campo', () {
      const f = FeedFilters(diagnoses: {});

      expect(f.toQueryParams().containsKey('diagnoses'), false);
    });

    test('toQueryParams con tagIds vacío no incluye el campo', () {
      const f = FeedFilters(tagIds: {});

      expect(f.toQueryParams().containsKey('tags'), false);
    });

    test('hashCode consistente con equality bajo Set reordering', () {
      final a = FeedFilters(diagnoses: {'A', 'B', 'C'});
      final b = FeedFilters(diagnoses: {'C', 'A', 'B'});

      expect(a == b, true);
      expect(a.hashCode == b.hashCode, true);
    });

    test('supportedDiagnoses contiene los 6 esperados', () {
      expect(FeedFilters.supportedDiagnoses.length, 6);
      expect(FeedFilters.supportedDiagnoses, contains('TEA'));
      expect(FeedFilters.supportedDiagnoses, contains('TDAH'));
      expect(FeedFilters.supportedDiagnoses, contains('AACC'));
      expect(FeedFilters.supportedDiagnoses, contains('DISLEXIA'));
      expect(FeedFilters.supportedDiagnoses, contains('AUTOIDENTIFIED'));
      expect(FeedFilters.supportedDiagnoses, contains('OTHER'));
    });

    test('rango de edad: min == max es válido', () {
      const f = FeedFilters(minAge: 25, maxAge: 25);

      expect(f.isValid, true);
    });

    test('activeCount caps at 7 (total grupos)', () {
      const f = FeedFilters(
        diagnoses: {'TEA'},
        minAge: 18,
        maxAge: 40, // cuenta como 1 grupo (age)
        radiusMeters: 10000,
        tagIds: {'t1'},
        minEnergyLevel: 2,
        includeTeens: false,
        sort: FeedSort.recent,
      );

      expect(f.activeCount, 7); // diagnoses, age, radius, tags, energy, teens, sort
    });

    test('toQueryString codifica caracteres especiales en tagIds', () {
      const f = FeedFilters(tagIds: {'tag with space', 'tag&special'});

      final qs = f.toQueryString();

      expect(qs, contains('tags='));
      // no debería haber & literal dentro del valor
      expect(qs, isNot(contains('tag&special')));
    });

    test('includeTeens: true vs false produce diferentes queries', () {
      const yes = FeedFilters(includeTeens: true);
      const no = FeedFilters(includeTeens: false);

      expect(yes.toQueryParams()['includeTeens'], 'true');
      expect(no.toQueryParams()['includeTeens'], 'false');
      expect(yes == no, false);
    });
  });
}
