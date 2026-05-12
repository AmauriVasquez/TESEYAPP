# 📦 Instrucciones para Subir a Hostinger

## ✅ Archivo ZIP Listo

El archivo **`tesey-app-dist.zip`** contiene todos los archivos compilados listos para producción.

---

## 📋 Pasos para Subir a Hostinger

### 1. Acceder al Administrador de Archivos

1. Inicia sesión en tu panel de Hostinger
2. Ve a **"Administrador de Archivos"** o **"File Manager"**
3. Navega a la carpeta **`public_html`** (o la carpeta raíz de tu dominio)

### 2. Hacer Backup (Recomendado)

Antes de subir la nueva versión:
- Crea una carpeta llamada `backup-YYYYMMDD` (ej: `backup-20250216`)
- Mueve todos los archivos actuales de `public_html` a esa carpeta de backup

### 3. Subir el ZIP

1. En el Administrador de Archivos, haz clic en **"Subir"** o **"Upload"**
2. Selecciona el archivo **`tesey-app-dist.zip`**
3. Espera a que termine la subida

### 4. Extraer el ZIP

1. Una vez subido, haz clic derecho sobre **`tesey-app-dist.zip`**
2. Selecciona **"Extraer"** o **"Extract"**
3. Elige extraer en la misma ubicación (`public_html`)

### 5. Organizar los Archivos

**IMPORTANTE:** Después de extraer, tendrás una estructura así:
```
public_html/
  ├── tesey-app-dist/
  │   ├── index.html
  │   ├── assets/
  │   └── LOGOTIPO ISOTIPO.svg
  └── tesey-app-dist.zip
```

**Debes mover el contenido de `tesey-app-dist/` a la raíz de `public_html`:**

1. Entra a la carpeta `tesey-app-dist`
2. Selecciona **todos los archivos** (Ctrl+A)
3. **Córtalos** (Ctrl+X)
4. Ve a la carpeta `public_html` (un nivel arriba)
5. **Pégalos** (Ctrl+V)

Resultado final esperado:
```
public_html/
  ├── index.html          ← Archivo principal
  ├── assets/             ← CSS y JS minificados
  ├── LOGOTIPO ISOTIPO.svg
  └── tesey-app-dist.zip  ← Puedes borrarlo después
```

### 6. Limpiar

1. Borra la carpeta vacía `tesey-app-dist`
2. Opcional: Borra el archivo `tesey-app-dist.zip` para ahorrar espacio

### 7. Verificar

1. Abre tu dominio en el navegador
2. Verifica que la aplicación carga correctamente
3. Prueba las funcionalidades principales:
   - ✅ Crear proyecto → Debe enviar notificación a Telegram
   - ✅ Agregar comentario en bitácora → Debe enviar notificación
   - ✅ Aprobar cotización → Debe enviar notificación

---

## ⚠️ Notas Importantes

### Variables de Entorno

**IMPORTANTE:** Las variables de entorno de Telegram están compiladas en el código JavaScript. 

Si necesitas cambiarlas después:
1. Edita el archivo `.env` en tu proyecto local
2. Ejecuta `npm run build` nuevamente
3. Sube la nueva versión de `dist`

### Archivos Incluidos en el ZIP

- ✅ `index.html` - Punto de entrada
- ✅ `assets/index-*.css` - Estilos minificados
- ✅ `assets/index-*.js` - JavaScript minificado (incluye todas las funcionalidades)
- ✅ `LOGOTIPO ISOTIPO.svg` - Logo estático

### Archivos NO Incluidos (Correcto)

- ❌ `node_modules/` - No necesario en producción
- ❌ `src/` - Código fuente, no necesario
- ❌ `.env` - Variables de entorno (ya están compiladas en el JS)

---

## 🔧 Solución de Problemas

### Si la página muestra pantalla en blanco:

1. Verifica que `index.html` esté en la raíz de `public_html`
2. Verifica que la carpeta `assets/` exista y tenga contenido
3. Revisa la consola del navegador (F12) para ver errores
4. Verifica los permisos de archivos en Hostinger (deben ser 644 para archivos, 755 para carpetas)

### Si las notificaciones de Telegram no funcionan:

1. Verifica que las variables de entorno estén correctas en `.env` antes del build
2. Revisa la consola del navegador para ver si hay errores de red
3. Verifica que el Bot Token y Chat ID sean correctos

---

## 📞 Soporte

Si encuentras algún problema durante la subida, verifica:
- ✅ Que el ZIP se haya extraído correctamente
- ✅ Que los archivos estén en la ubicación correcta
- ✅ Que no haya archivos duplicados o conflictos

---

**Fecha de Build:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Versión:** Incluye todas las mejoras recientes (Error Boundary, Clientes refactorizado, Telegram integrado)
