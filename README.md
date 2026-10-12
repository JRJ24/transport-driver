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
EXPO_PUBLIC_API_URL=https://api.larutard.com.do/api/v1
EXPO_PUBLIC_SOCKET_URL=https://api.larutard.com.do
EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY=
EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY=
```

Contra un `transport-api` local usa `http://<host>:3000/api/v1` y
`http://<host>:3000`: en emulador Android `<host>` es `10.0.2.2`; en dispositivo
físico, la IP LAN de tu máquina. `http://` solo funciona en el dev client (build
debug): un build release bloquea el tráfico cleartext.

## API

La app consume el `transport-api` desplegado:

| Uso | URL |
| --- | --- |
| REST (`EXPO_PUBLIC_API_URL`) | `https://api.larutard.com.do/api/v1` |
| Socket.IO (`EXPO_PUBLIC_SOCKET_URL`) | `https://api.larutard.com.do` |

`https://conductores.larutard.com.do` es un origen equivalente: también proxya
`/api` y `/socket.io`. Si `EXPO_PUBLIC_SOCKET_URL` falta, la app usa el origen
de `EXPO_PUBLIC_API_URL`.

Dónde se configuran:

- **Metro local** (`pnpm start`, `npx expo run:*`): `.env`. Tras cambiarlo,
  reinicia con `npx expo start --clear`.
- **EAS Build**: el bloque `env` de cada perfil en `eas.json`. EAS no recibe
  `.env` (está en `.gitignore`). Si una variable del environment de EAS tiene el
  mismo nombre, gana el valor de `eas.json` y EAS CLI lo avisa en el log.

Para comprobar que no hay variables EAS con otro host:

```bash
eas env:list --environment <development|preview|production> --include-sensitive
```

En `__DEV__` la app imprime `[env] api ... socket ...` al arrancar.

## Configuración de Google Cloud

Habilita en tu proyecto de Google Cloud:

- **Maps SDK for Android**
- **Maps SDK for iOS**

(La **Routes API** y **Geocoding API** se habilitan y consumen SOLO desde
`transport-api`, no desde la app.)

Crea dos claves de API **restringidas**:

- **Android:** restringe por *package name* (`com.flypack.rutardriver`) +
  huella **SHA-1/SHA-256** del certificado de firma (obtén el SHA con
  `eas credentials` o `keytool`).
- **iOS:** restringe por *bundle identifier* (`do.com.flypack.rutardriver`).

Ponlas en `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` /
`EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY`. `app.config.ts` las inyecta en
`android.config.googleMaps.apiKey` e `ios.config.googleMapsApiKey`.

## Configuración de Firebase (FCM)

1. Crea un proyecto Firebase y añade apps Android e iOS con los mismos
   identificadores (Android `com.flypack.rutardriver`, iOS
   `do.com.flypack.rutardriver`).
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
  components/     UI compartida: botones, badges, SwipeButton, Sheet, Toast, timeline
  features/       auth, orders, map (Ruta en vivo), evidence (stepper), trip, profile, notifications
  navigation/     tabs (Inicio · Ruta · Perfil) + modales (Evidencia, Entrega completada, perfil)
  services/
    location/     permisos, watch foreground, tarea background, cola offline
    notifications/registro FCM + ruteo seguro desde el payload
    socket/        socket.io (updates en vivo)
    storage/       expo-secure-store (tokens) + AsyncStorage (cache/colas)
  store/          zustand: auth, order (lista), trip (servicio activo), tracking,
                  evidence (borrador), toast, connectivity, notifications
  theme/          tokens de diseño (claro y cálido)
  types/          contrato compartido con transport-api
```

### Estado global (zustand)
Separado por dominio: `auth`, `order`, `trip`, `tracking`, `evidence`, `toast`,
`connectivity`, `notifications`.

`useTrip` es **el** servicio en curso (uno solo). Ver el detalle de otra orden
no lo cambia. Al arrancar se reconcilia con el servidor
(`GET /tracking/sessions/active` y las asignaciones EN CURSO). Iniciar otra
orden con un servicio vivo se bloquea en la app, y en la API con un 409
`ACTIVE_TRIP_EXISTS` en cuanto la API lo implemente. Los tokens **nunca** se guardan en almacenamiento inseguro
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
5. Aceptar → `POST /orders/:id/accept` (o rechazar → `PATCH /assignments/:id/reject`).
6. **Deslizar para iniciar.** Pide permisos y crea la sesión con
   `POST /tracking/sessions {orderId, pickupFlow: true}`. La app marca el servicio
   como iniciado y abre Ruta.
7. **Ruta en vivo.** La cámara sigue al vehículo y el tramo se recalcula desde el GPS
   actual (`GET /routes/orders/:id/approach?latitude&longitude&heading&reroute`).
   Fases:
   - Hacia la recogida: «Llegué» → `POST /orders/:id/stops/:stopId/arrive`.
   - Recoger: deslizar «carga recogida» → `POST /orders/:id/stops/:stopId/complete`.
   - Hacia la entrega: «Llegué» → `arrive` en la parada de entrega.
8. **Evidencia obligatoria** (stepper: receptor → foto → firma → confirmar).
   El borrador queda en disco y el envío se puede reintentar sin duplicar.
   Deslizar «completar entrega» envía la evidencia y `DELIVERED`, detiene el
   tracking y muestra la confirmación.

### Compatibilidad con la API desplegada
Los puntos nuevos de la API (`pickupFlow`, endpoints de paradas, origen en vivo
del tramo, 409 `ACTIVE_TRIP_EXISTS`) se usan si existen:
- `pickupFlow`: si la API responde 400, se reintenta sin el campo.
- Paradas: si el endpoint da 404, se registra un evento `ARRIVED`/`PICKED_UP` y la
  fase se guarda en el teléfono.
- Origen en vivo: si la API ignora `latitude/longitude`, el tramo hacia la
  recogida se dibuja recto hasta que la API calcule hacia la recogida.

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
