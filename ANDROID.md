# Android APK (Capacitor 6)

La app es el mismo frontend Vite empaquetado en un WebView nativo de Android.
**No es una app reescrita en Kotlin**; sí es instalable como APK.

## Requisitos
- JDK **17** (ya validado en este Mac)
- Android SDK (`~/Library/Android/sdk`)
- Emulador o tablet/teléfono USB con depuración USB

## Generar / actualizar
```bash
npm run android:sync          # build web (CAPACITOR=1) + sync a android/
# Opcional: abrir Android Studio
npm run android:open
```

Compilar APK debug desde terminal:
```bash
export JAVA_HOME="/Users/salvio/Library/Java/jdk-17.0.19+10/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
cd android && ./gradlew assembleDebug
```

APK resultante:
`android/app/build/outputs/apk/debug/app-debug.apk`

Instalar en dispositivo conectado:
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
# o
npm run android:run
```

## Impresión en la APK
Al pulsar **Imprimir**, se genera el PDF (mismo motor corregido de captura) y se abre el menú nativo de Android (**Compartir / Imprimir / Abrir con…**). Desde ahí eliges impresora, Drive o un visor PDF. Esto evita `window.print()` y las páginas en blanco del navegador.

## Firebase
En Authentication → Authorized domains, asegúrate de tener `localhost` (Capacitor usa esquema `https://localhost`). Login con correo/contraseña no depende del aviso OAuth.

## Nombre e icono
- Nombre en el launcher: **Centro Medico Santa Cruz**
- Icono adaptativo: cruz/caduceo sobre fondo blanco (`res/mipmap-*`)

## Descarga en el dominio
Link público (tras `deploy.sh` con APK en `releases/`):

`https://centromedicosantacruz.com/descargas/`

APK directo:

`https://centromedicosantacruz.com/descargas/SRS-Medic.apk`

Generar APK para publicar:
```bash
npm run android:apk   # → releases/SRS-Medic.apk
./deploy.sh           # copia el APK a dist/descargas/ y lo sube
```

## Actualizaciones (sin Play Store)
El APK apunta a la web de producción (`server.url` → `https://centromedicosantacruz.com`).
Cuando corres `deploy.sh`, **los usuarios ya instalados ven la nueva versión** al reabrir la app (o al refrescar). No hay que redistribuir APK por cada cambio de frontend.

Solo hay que generar y compartir un APK nuevo si cambias:
- plugins nativos (Share, Filesystem, StatusBar, etc.),
- `appId` / icono / splash / permisos Android,
- o la propia URL de `server.url`.

Requiere internet. Sin red, la app no carga el ERP.

## Notas
- `CAPACITOR=1` hace el build con `base: './'` (necesario si pruebas con assets embebidos).
- Con `server.url` activo, el WebView ignora el `dist` embebido y carga producción.
- Capacitor está en **v6** a propósito (compatible con JDK 17). Capacitor 8 exige JDK 21.
