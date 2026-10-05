# Tropa 307 — Puntajes y expedientes

Sistema para la Tropa del Grupo Guía y Scout 307: puntajes por patrulla, expedientes de protagonistas,
recordatorios de cambio de etapa y puntaje final por ciclo.

React + Vite · Firebase Auth (Google) · Cloud Firestore · Firebase Hosting.

## Qué hace

| Pestaña | Para qué |
|---|---|
| Inicio | Ranking del ciclo actual y recordatorios (cambio de etapa, paso a Wak, expediente incompleto, cumpleaños). |
| Reuniones | Registrar cada reunión y puntuar a cada patrulla en Asistencia, Uniforme, Inspección, Juegos y Comportamiento. |
| Puntos extra | Sumar o restar puntos libres a una patrulla, con motivo. |
| Puntaje final | Crear ciclos de programa y ver la tabla final (categorías + extras). Se puede imprimir. |
| Expedientes | Datos personales, patrulla, cargo, etapa, encargado, ficha médica, notas e historial de etapas. |
| Patrullas | Nombre, color y lema de cada patrulla. |
| Ajustes | Meses de referencia por etapa, días de aviso, edad para paso a Wak, puntaje máximo; respaldo JSON. |

## Puesta en marcha (una sola vez)

1. **Crear el proyecto** en https://console.firebase.google.com (o usar uno existente).
2. **Authentication → Sign-in method →** habilitar **Google**.
3. **Firestore Database →** crear base de datos (modo producción, región `us-central1` o la más cercana).
4. **Configuración del proyecto → Tus apps →** agregar app **Web** (`</>`) y copiar los valores de `firebaseConfig`.
5. En esta carpeta:
   ```bash
   cp .env.example .env      # pegar ahí los valores de firebaseConfig
   npm install
   npm run dev               # prueba local en http://localhost:5173
   ```
6. Publicar:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add        # elegir el proyecto
   npm run deploy            # compila y sube hosting + reglas de Firestore
   ```
   La app queda en `https://<tu-proyecto>.web.app`.

> Si al entrar con Google en la web publicada da error de dominio, agregalo en
> Authentication → Settings → Authorized domains.

## Seguridad

- `firestore.rules` solo permite leer/escribir a **german.gs19@gmail.com** (correo verificado). Aunque alguien
  tenga el enlace, no puede ver ni modificar datos.
- La app además bloquea en pantalla cualquier otra cuenta (`VITE_ALLOWED_EMAIL`).
- Hay datos personales y médicos de menores (Ley 8968). Antes de dar acceso a otro dirigente, revisar las reglas
  y el consentimiento de las familias. El respaldo JSON también contiene esos datos.

## Primeros pasos dentro de la app

1. Patrullas → crear las 2 patrullas.
2. Expedientes → registrar a cada protagonista (con fecha de inicio de su etapa actual).
3. Puntaje final → crear el ciclo de programa vigente.
4. Reuniones → registrar cada sábado. Las reuniones y puntos extra se asignan solos al ciclo según la fecha.

El recordatorio de cambio de etapa usa un tiempo de referencia (6 meses por defecto, editable en Ajustes);
la decisión real se toma por la evaluación de objetivos con el protagonista.
