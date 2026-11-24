import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/main.dart';

void main() {
  testWidgets('IamApp renders splash screen on launch', (WidgetTester tester) async {
    await tester.pumpWidget(const IamApp());

    // Splash screen muestra el logo (imagen), ya no texto "IAM"
    expect(find.byType(Image), findsOneWidget);
  });
}
