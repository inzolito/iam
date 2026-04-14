import 'package:flutter_test/flutter_test.dart';
import 'package:iam_mobile/main.dart';

void main() {
  testWidgets('IamApp renders splash screen on launch', (WidgetTester tester) async {
    await tester.pumpWidget(const IamApp());

    // Splash screen muestra el logo IAM y subtítulo
    expect(find.text('IAM'), findsOneWidget);
    expect(find.text('I Am Me'), findsOneWidget);
  });
}
