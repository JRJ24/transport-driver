# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# `android/` es un artefacto, no una fuente

La carpeta `android/` esta en `.gitignore` y se genera. Nunca la edites a mano:
cualquier cambio en `app.config.ts`, `package.json` o `.env` obliga a
regenerarla con `npx expo prebuild --clean`, o el binario quedara con la
configuracion anterior.

Comprobacion rapida de que la clave de mapas entro en el manifest:

```sh
grep -n "com.google.android.geo.API_KEY" android/app/src/main/AndroidManifest.xml
```

# EAS Build no recibe los archivos ignorados

`.env`, `google-services.json` y `GoogleService-Info.plist` no estan en el
repo. En EAS llegan como variables de entorno (`GOOGLE_SERVICES_JSON` y
`GOOGLE_SERVICES_PLIST` son de tipo *file*), y cada perfil de `eas.json`
declara su `environment`.
