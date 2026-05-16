# Sistema de Versionado y Actualización

## ¿Cómo funciona?

El sistema de versionado de SRS-Medic utiliza números de versión semántica en lugar de timestamps para evitar notificaciones falsas de actualización.

## Archivos involucrados

1. **`package.json`**: Contiene la versión oficial de la aplicación
2. **`vite.config.js`**: Lee la versión de package.json y la inyecta en el build
3. **`public/version.json`**: Archivo generado durante el build con la versión actual
4. **`src/hooks/useAppVersion.js`**: Hook que verifica actualizaciones
5. **`src/App.jsx`**: Componente que muestra el banner de actualización

## Proceso de versionado

1. **Desarrollo**: La versión se lee desde `package.json`
2. **Build**: Vite inyecta la versión en `__BUILD_VERSION__` y genera `public/version.json`
3. **Ejecución**: El hook `useAppVersion` compara la versión actual con la del servidor
4. **Actualización**: Solo se notifica si hay una diferencia real de versión

## Cómo incrementar la versión

Para crear una nueva versión, actualiza el campo `version` en `package.json` siguiendo el estándar de versionado semántico:

- **MAJOR**: Cambios que rompen compatibilidad (1.0.0 → 2.0.0)
- **MINOR**: Nuevas funcionalidades retrocompatibles (1.0.0 → 1.1.0)
- **PATCH**: Correcciones de errores retrocompatibles (1.0.0 → 1.0.1)

Ejemplo:
```json
{
  "name": "srs-medico",
  "version": "1.2.3",
  ...
}
```

## Beneficios de este enfoque

1. **Evita actualizaciones falsas**: Solo se notifican cambios reales
2. **Control preciso**: Sabes exactamente cuándo hay una actualización real
3. **Compatibilidad**: Sigue estándares de la industria
4. **Transparencia**: Es fácil entender qué versión está en producción

## Solución de problemas

Si el banner de actualización sigue apareciendo:

1. **Verifica que la versión en `package.json` sea correcta**
2. **Asegúrate de ejecutar `npm run build` después de cambiar la versión**
3. **Limpia la caché del navegador si es necesario**
4. **Verifica que `public/version.json` tenga la versión correcta después del build**