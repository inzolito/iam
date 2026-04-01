import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/main.dart';

void main() {
  testWidgets('IAM placeholder screen displays correctly',
      (WidgetTester tester) async {
    await tester.pumpWidget(const IamApp());

    expect(find.text('I AM'), findsOneWidget);
    expect(find.text('Conectando mentes que se entienden'), findsOneWidget);
  });
}
