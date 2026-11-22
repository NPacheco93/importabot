# Guía para correr ImportaBot en tu Mac

Seguí los pasos en orden. Lo que tenés que escribir en la Terminal está en los recuadros grises: copialo tal cual y presioná **Enter** después de cada línea.

## 1. Instalar Node.js (una sola vez)

1. Entrá a **nodejs.org** y descargá la versión **LTS** para macOS (archivo `.pkg`).
2. Abrí el archivo descargado e instalalo con las opciones que trae.
3. Abrí la app **Terminal** (Cmd + Espacio, escribí "Terminal" y Enter) y comprobá que quedó instalado:

```
node -v
```

Tiene que aparecer un número como `v22.x` o mayor.

## 2. Preparar la carpeta del proyecto

1. Descomprimí `importabot.zip` con doble clic y mové la carpeta **importabot** a **Documentos**.
2. En la Terminal escribí `cd ` (con un espacio al final), **arrastrá la carpeta importabot** a la ventana de la Terminal y presioná Enter.
3. Instalá las librerías del proyecto (tarda menos de un minuto):

```
npm install
```

## 3. Poner tu API key (sin exponerla)

1. Creá tu archivo secreto a partir de la plantilla y abrilo en TextEdit:

```
cp .env.example .env
open -e .env
```

2. Reemplazá `pega-aqui-tu-clave` por tu clave de OpenAI, la que empieza con `sk-`. No dejes espacios ni comillas.
3. Guardá con **Cmd + S** y cerrá TextEdit.

El archivo `.env` queda solo en tu Mac: el proyecto está configurado para que **nunca** se suba a GitHub.

## 4. Probar la calculadora (no gasta saldo)

```
npm test
```

Tienen que salir **10 de 10 pruebas correctas**. **Captura 1:** tomá una captura de esta salida con **Cmd + Shift + 4** y arrastrando sobre la ventana.

## 5. Encender el asistente

```
npm start
```

Tiene que decir `ImportaBot funcionando en http://localhost:3000` y `API key cargada desde .env`.

1. Abrí **http://localhost:3000** en Chrome.
2. Probá una consulta, por ejemplo: *Busco una Tacoma 2008 doble cabina 4x4, reparada con daño leve. Tengo 200 mil lempiras.*
3. **Captura 2:** el chat con la respuesta y la tarjeta del estimado.
4. **Captura 3:** la Terminal, donde aparece una línea como `/api/chat 200 en 3200 ms · función: ok`. Esa es la prueba de que la API respondió.
5. Probá también desde la vista de celular de Chrome si querés (Cmd + Option + I y el ícono del teléfono).

Para apagar el asistente, volvé a la Terminal y presioná **Ctrl + C**.

## 6. Correr las pruebas con la API real

```
npm run pruebas
```

Envía 12 preguntas al asistente (normales, con datos faltantes y tramposas) y califica cada respuesta. Cuesta menos de 2 centavos de dólar.

- **Captura 4:** la parte final, donde dice el porcentaje de exactitud.
- Se crea el archivo **registros/resultados_pruebas.md**. **Enviámelo** para armar la sección de pruebas del documento. No contiene tu clave ni datos personales.

## 7. Crear el repositorio en GitHub

1. Entrá a **github.com** e iniciá sesión (o creá una cuenta gratis).
2. Arriba a la derecha tocá **+** → **New repository**.
3. Nombre: `importabot`. Elegí **Private**. Tocá **Create repository**.
4. En la página nueva, tocá el enlace **uploading an existing file**.
5. En Finder, dentro de la carpeta importabot, presioná **Cmd + Shift + .** (punto) para ver los archivos ocultos.
6. Seleccioná y arrastrá a GitHub **todo menos** estas tres cosas:
   - `node_modules` (es muy pesada y se reinstala sola)
   - `.env` **tu clave: nunca la subas**
   - `registros`
7. Abajo tocá **Commit changes**.
8. Copiá la dirección de la página, que se ve así: `https://github.com/tu-usuario/importabot`.

## 8. Qué enviarme

1. El archivo `registros/resultados_pruebas.md`.
2. Las capturas 1 a 4.
3. La URL del repositorio de GitHub.
4. Opcional: el número de WhatsApp del asesor, para que el botón abra tu chat directo. También lo podés poner vos en `public/config.js`.

## Si algo falla

| Mensaje | Qué hacer |
|---|---|
| `command not found: node` o `npm` | Cerrá y abrí la Terminal; si sigue, reinstalá Node.js (paso 1) |
| `API key NO configurada` | Revisá que el archivo se llame `.env` (con punto) y que la clave esté pegada |
| `La API key no es válida` | Copiá la clave otra vez desde OpenAI o creá una nueva |
| `Se agotó el saldo o el límite` | Cargá saldo en **Billing** de OpenAI |
| `EADDRINUSE` | El asistente ya está encendido en otra ventana de Terminal: cerrala o presioná Ctrl + C allí |
