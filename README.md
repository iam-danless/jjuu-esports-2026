# Sistema de Resultados JJUU 2026 - Esports

Aplicación web oficial para gestionar los resultados de League of Legends y Valorant.

## Configuración Técnica y Despliegue

### 1. Variables de Entorno (.env)
Copia el archivo `.env.example` como `.env.local` y completa con las credenciales de tu proyecto de Firebase.
`cp .env.example .env.local`

### 2. Firebase
1. **Autenticación**: Habilita Email/Password. Crea un usuario administrador.
2. **Firestore**: Habilita Firestore Database.
3. **Seguridad**: Aplica las reglas proporcionadas en `firestore.rules`.
4. **Permisos**: 
   - Copia el UID del administrador recién creado.
   - Crea una colección `admins` en Firestore.
   - Añade un documento donde el ID sea exactamente el UID copiado (el contenido puede ser `{ email: "admin@tuemail.com" }`).

### 3. Vercel (Despliegue)
El proyecto incluye un `vercel.json` preparado para enrutamiento SPA.
1. Sube el código a GitHub.
2. Conecta el repositorio en Vercel.
3. Añade las variables de entorno de Firebase en la configuración del proyecto en Vercel.
4. Despliega (Build command: `npm run build`, Output directory: `dist`).
