# Firebase Setup — IAM Mobile

Guía para configurar Firebase Cloud Messaging (FCM) para notificaciones push en Android e iOS.

---

## 1. Crear proyecto Firebase

1. Ir a [Firebase Console](https://console.firebase.google.com/)
2. **Agregar proyecto** → nombre: `iam-app` (o el que prefieras)
3. Deshabilitar Google Analytics (opcional)

---

## 2. Android — `google-services.json`

1. Firebase Console → ⚙️ Configuración del proyecto → **Tus apps** → **Agregar app Android**
2. **Nombre del paquete**: `com.iam.iam_mobile` (debe coincidir con `android/app/build.gradle.kts → applicationId`)
3. **Apodo**: `IAM Android` (opcional)
4. **Certificado SHA-1** (opcional para FCM, requerido para Google Sign-In):
   ```bash
   cd apps/mobile/android
   ./gradlew signingReport
   ```
5. Descargar `google-services.json`
6. Colocarlo en: `apps/mobile/android/app/google-services.json`

✅ Ya está configurado en Gradle (ver `settings.gradle.kts` y `app/build.gradle.kts`).

---

## 3. iOS — `GoogleService-Info.plist`

1. Firebase Console → **Agregar app iOS**
2. **Bundle ID**: `com.iam.iamMobile` (debe coincidir con Xcode)
3. Descargar `GoogleService-Info.plist`
4. Abrir `apps/mobile/ios/Runner.xcworkspace` en Xcode
5. Arrastrar `GoogleService-Info.plist` dentro del grupo `Runner` (marcar "Copy items if needed")
6. Habilitar **Push Notifications** capability:
   - Runner → Signing & Capabilities → + Capability → **Push Notifications**
   - + Capability → **Background Modes** → marcar **Remote notifications**

### APNs (requerido para iOS real, no simulador)

1. [Apple Developer](https://developer.apple.com/) → Certificates, Identifiers & Profiles → **Keys** → crear una **APNs Auth Key** (.p8)
2. Firebase Console → ⚙️ Cloud Messaging → **iOS app configuration** → subir la Auth Key
3. Completar:
   - **Key ID** (del archivo .p8)
   - **Team ID** (de la cuenta de developer)

---

## 4. Backend — Service Account

Para que el backend (NestJS) pueda enviar notifications:

1. Firebase Console → ⚙️ Configuración → **Cuentas de servicio** → **Generar nueva clave privada**
2. Guardar el JSON en el servidor (nunca commitear)
3. Agregar variable de entorno en backend:
   ```
   FIREBASE_SERVICE_ACCOUNT_PATH=/ruta/segura/service-account.json
   ```

---

## 5. Verificar configuración

```bash
cd apps/mobile

# Reinstalar pods (iOS)
cd ios && pod install && cd ..

# Build Android debug
flutter build apk --debug

# Build iOS (en macOS)
flutter build ios --debug --no-codesign
```

### Debug de FCM

```bash
# Ver logs de FCM en tiempo real
flutter logs | grep FCM
```

Al hacer login exitoso, deberías ver:
```
[FCM] Push notification service inicializado
[FCM] Token registrado: eXAMpLe-TOKEN...
```

---

## 6. Testear notificación

Desde Firebase Console → Cloud Messaging → **Send test message**:

1. Copiar el token FCM de los logs
2. Enviar notificación de prueba con ese token
3. La app debería mostrar la notificación (foreground como local notification, background como push nativa)

---

## Archivos afectados

| Archivo | Propósito |
|---------|-----------|
| `android/settings.gradle.kts` | Plugin `com.google.gms.google-services` declarado |
| `android/app/build.gradle.kts` | Plugin aplicado |
| `android/app/src/main/AndroidManifest.xml` | Permisos INTERNET, POST_NOTIFICATIONS + channel default |
| `android/app/google-services.json` | ⚠️ No commitear — usar `.example` como referencia |
| `ios/Runner/Info.plist` | UIBackgroundModes (remote-notification) + FirebaseAppDelegateProxyEnabled |
| `ios/Runner/GoogleService-Info.plist` | ⚠️ No commitear — usar `.example` como referencia |
| `lib/core/services/push_notification_service.dart` | Servicio Flutter que usa FCM |

---

## Troubleshooting

### Android: "google-services.json is missing"
El archivo debe estar en `android/app/`, no en `android/`.

### iOS: "No Firebase App '[DEFAULT]' has been created"
Asegurarse de que `GoogleService-Info.plist` esté agregado al target Runner en Xcode (no solo copiado al directorio).

### Notificación no llega en iOS simulador
Las push notifications nativas no funcionan en simulador. Usar dispositivo real o local notifications.

### Token no se registra en backend
Verificar que el endpoint `POST /notifications/devices` exista y el usuario esté autenticado.
