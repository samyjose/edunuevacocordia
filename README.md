# Unidad Educativa Nueva Concordia — Registro (prototipo)

Esta carpeta contiene una página estática (HTML/CSS/JS) y un backend minimal en Node.js + SQLite para guardar usuarios y registros (asistencia y notas).

Qué incluye
- `pagian.html` — interfaz principal.
- `pagian.css` — estilos.
- `pagian script.js` — lógica cliente; usa LocalStorage como fallback y, si detecta el backend, usará la API para persistir en la base de datos.
- `server.js` — servidor Express que sirve los archivos estáticos y expone una API REST sobre SQLite.
- `package.json` — dependencias y script `start`.

Instalar y ejecutar el servidor (Windows PowerShell)

1. Abre PowerShell en la carpeta `c:\Users\Usuario\Downloads\junior`
2. Instala dependencias:

```powershell
npm install
```

3. Arranca el servidor:

```powershell
npm start
```

4. Abre el navegador en: `http://localhost:3000/pagian.html`

Notas
- El servidor crea automáticamente una base de datos SQLite en `data.sqlite` y un usuario por defecto `admin` / `admin123` la primera vez.
- Autenticación en el servidor usa JWT. El frontend guarda el token en LocalStorage y lo incluye en las peticiones.
- Si abres `pagian.html` directamente con `file://` el frontend seguirá funcionando con LocalStorage (modo offline), pero para persistencia centralizada ejecuta el servidor y abre `http://localhost:3000/pagian.html`.

Configuración para Google Sign-In (opcional)
- Si quieres permitir login con Google y que el servidor valide el ID token, exporta la variable de entorno `GOOGLE_CLIENT_ID` con tu client id antes de arrancar el servidor. Ejemplo (PowerShell):

```powershell
$env:GOOGLE_CLIENT_ID = 'TU_CLIENT_ID'
$env:JWT_SECRET = 'una_clave_larga_y_segura'
npm install
npm start
```

El servidor expondrá `/api/google-login` que acepta { idToken } en POST y devolverá un JWT válido para las siguientes peticiones.

Siguientes mejoras sugeridas
- Validar tokens en el servidor con refresco de tokens (refresh tokens).
- Añadir roles (admin/profesor) y permisos.
- Mostrar la foto/nombre real del usuario cuando se use Google Sign-In.
- Añadir tests automatizados y respaldo de la base de datos.

Si quieres, configuro también un script para ejecutar el servidor automáticamente (PM2) o la verificación del token de Google en el backend.
