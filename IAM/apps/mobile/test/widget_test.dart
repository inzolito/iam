import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/main.dart';

void main() {
  testWidgets('IamApp renders onboarding screen', (WidgetTester tester) async {
    await tester.pumpWidget(const IamApp());

    // Onboarding step 1: Diagnosis selection
    expect(find.text('I AM...'), findsOneWidget);
    expect(find.text('Diagnóstico'), findsOneWidget);
  });
}
