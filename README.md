# transport-driver

Aplicación móvil **para conductores** del ecosistema RUTA RD (Expo SDK 57 / React
Native 0.86 / React 19). Se integra con `transport-api` para autenticación,
órdenes asignadas, ruta con Google Maps, tracking GPS en tiempo real
(foreground + background), sincronización offline-first y notificaciones push
(FCM). El Portal TMS y la app de cliente son proyectos separados; esta app
**no** contiene lógica administrativa.

> ⚠️ **Expo Go no es el entorno final.** El tracking en segundo plano y las
> notificaciones push nativas (FCM) **requieren un development build** (EAS o
> `expo prebuild`). En Expo Go, Android no entrega push remoto desde SDK 53.

## Requisitos

- Node 20+ y `pnpm`
- Cuenta Expo + EAS CLI (`npm i -g eas-cli`) para development builds
- Android Studio (emulador/SDK) y/o Xcode (iOS)
- `transport-api` corriendo y accesible desde el dispositivo
- Proyecto de Google Cloud (Maps SDK) y proyecto Firebase (FCM)

## Instalación

```bash
pnpm install
cp .env.example .env   # completa los valores
```

## Variables de entorno (`.env`)

Solo valores **públicos** (van embebidos en el bundle). Ningún secreto de
servidor vive aquí — la clave de Routes API y las credenciales de Firebase Admin
están únicamente en `transport-api`.

```env
EXPO_PUBLIC_API_URL=http://<host>:3000/api/v1
EXPO_PUBLIC_SOCKET_URL=http://<host>:3000
EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY=
EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY=
```

En emulador Android usa `http://10.0.2.2:3000`; en dispositivo físico, la IP LAN
de tu máquina.

## Configuración de Google Cloud

Habilita en tu proyecto de Google Cloud:

- **Maps SDK for Android**
- **Maps SDK for iOS**

(La **Routes API** y **Geocoding API** se habilitan y consumen SOLO desde
`transport-api`, no desde la app.)

Crea dos claves de API **restringidas**:

- **Android:** restringe por *package name* (`do.com.flypack.rutardriver`) +
  huella **SHA-1/SHA-256** del certificado de firma (obtén el SHA con
  `eas credentials` o `keytool`).
- **iOS:** restringe por *bundle identifier* (`do.com.flypack.rutardriver`).

Ponlas en `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` /
`EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY`. `app.config.ts` las inyecta en
`android.config.googleMaps.apiKey` e `ios.config.googleMapsApiKey`.

## Configuración de Firebase (FCM)

1. Crea un proyecto Firebase y añade apps Android e iOS con los mismos
   identificadores (`do.com.flypack.rutardriver`).
2. Descarga `google-services.json` (Android) y `GoogleService-Info.plist` (iOS)
   y colócalos en la raíz del proyecto. **No los subas a Git.**
3. Descomenta en `app.config.ts`:
   - `android.googleServicesFile: './google-services.json'`
   - `ios.googleServicesFile: './GoogleService-Info.plist'`
4. En iOS, sube tu **APNs key** a Firebase para que FCM entregue a iOS.
5. El **service account** de Firebase Admin va en `transport-api` (backend), no
   aquí.

## Development build

Expo Go no soporta background location ni push nativo. Usa un dev build:

```bash
# Nube (EAS)
eas build --profile development --platform android
eas build --profile development --platform ios

# O local con prebuild
npx expo prebuild
npx expo run:android   # o run:ios
```

## Comandos

```bash
pnpm start        # Metro dev server (para dev build)
pnpm android      # abre en Android
pnpm ios          # abre en iOS
npx tsc --noEmit  # type-check
```

## Arquitectura

```
src/
  api/            cliente axios (refresh token + envelope) y módulos por dominio
  config/         env público (expo-constants)
  components/     UI compartida (tema oscuro del diseño)
  features/       auth, orders, map (Ruta), evidence, profile, notifications
  navigation/     tabs (Inicio · Ruta · Evid. · Perfil) + stack + deep-link push
  services/
    location/     permisos, watch foreground, tarea background, cola offline
    notifications/registro FCM + ruteo seguro desde el payload
    socket/        socket.io (updates en vivo)
    storage/       expo-secure-store (tokens) + AsyncStorage (cache/colas)
  store/          zustand: auth, order, tracking, connectivity, notifications
  theme/          tokens de diseño (dark)
  types/          contrato compartido con transport-api
```

### Estado global (zustand)
Separado por dominio: `auth`, `order`, `tracking`, `connectivity`,
`notifications`. Los tokens **nunca** se guardan en almacenamiento inseguro
(solo `expo-secure-store`).

### Offline-first
- Orden activa y ruta/polyline se cachean en `AsyncStorage`.
- Los puntos GPS que fallan al enviarse se encolan localmente
  (`location-sync.service`) con `clientId` idempotente y se sincronizan por
  lote al recuperar conexión (el backend deduplica).
- Indicador visible de conexión y última sincronización en la pantalla de Ruta.

## Flujo del conductor

1. Login → `POST /auth/login`, perfil → `GET /auth/me` + `GET /drivers/me`.
2. Registro de token FCM → `POST /devices`.
3. Órdenes asignadas → `GET /assignments/me`.
4. Detalle de orden (origen, destino, paradas, ruta, distancia, ETA, carga).
5. Aceptar → `POST /orders/:id/accept`. Iniciar servicio → crea sesión de
   tracking (`POST /tracking/sessions`), pide permisos y arranca GPS.
6. Coordenadas cada ~5 s → `POST /tracking/sessions/:id/locations` (+ batch
   offline). Foreground service visible en Android.
7. Estados permitidos → `PATCH /orders/:id/status`.
8. Completar → `DELIVERED`, detiene tracking (`POST /tracking/sessions/:id/stop`)
   y sincroniza pendientes.

## Cómo probar el tracking con ubicación simulada

- **Emulador Android:** *Extended controls → Location* → fija/rutea posiciones,
  o usa *Routes* para reproducir un trayecto.
- **iOS Simulator:** *Features → Location → Custom Location* o *City Run*.
- Los puntos marcados por el SO como simulados llegan con `isMocked: true`.
- Verifica en el backend: `GET /tracking/sessions/active` y
  `GET /locations/orders/:orderId`; el Portal TMS los ve por WebSocket.

## Cómo enviar una notificación de prueba

Con sesión iniciada en la app:

- Pantalla **Notificaciones** → botón "Enviar notificación de prueba"
  (`POST /notifications/test`), o desde el backend con un token ADMIN/OPERATOR
  apuntando al `userId` del conductor. Requiere Firebase configurado en el
  backend y un dev build en el dispositivo. Al pulsar la notificación, la app
  valida el payload y navega a la orden correcta.

## Troubleshooting

- **El mapa sale en blanco (Android):** clave de Maps SDK Android ausente o mal
  restringida (SHA/package). Revisa `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY`.
- **No llegan push:** estás en Expo Go (usa dev build), falta
  `google-services.json`, o el backend no tiene credenciales Firebase.
- **No hay GPS en segundo plano:** faltó conceder permiso "Permitir siempre" o el
  dev build no incluye los permisos (`app.config.ts`).
- **401 en llamadas:** el access token expiró; el cliente refresca solo. Si
  persiste, cierra sesión y reingresa.
- **`@/` no resuelve:** verifica `tsconfig.json` `paths` y reinicia Metro con
  `--clear`.
```
