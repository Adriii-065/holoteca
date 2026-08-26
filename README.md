# Holoteca

Escaparate personal de cartas Pokémon: tú subes las cartas y pones el precio,
cualquiera puede visitar la web, añadir cartas al carrito y comprarlas con
**Bizum** o **PayPal**. Solo tú puedes gestionar el catálogo, a través de un
panel de administrador con usuario y contraseña.

---

## 1. Antes de empezar

Necesitas tener instalado **Node.js versión 18 o superior** (incluye `npm`).
Si no lo tienes:

1. Ve a https://nodejs.org y descarga la versión "LTS".
2. Instálalo (siguiente, siguiente, siguiente).
3. Abre una terminal y comprueba que funciona:
   ```
   node --version
   npm --version
   ```

## 2. Abrir el proyecto en VS Code

1. Descomprime la carpeta `holoteca` donde quieras tenerla.
2. Abre VS Code → `Archivo` → `Abrir carpeta...` → selecciona `holoteca`.
3. Abre una terminal integrada: menú `Terminal` → `Nueva terminal`.

## 3. Instalar dependencias

En la terminal de VS Code (dentro de la carpeta del proyecto):

```
npm install
```

Esto descarga las 4 librerías que usa el proyecto (Express, sesiones, subida
de imágenes y variables de entorno — el hash de contraseñas usa una función
que ya trae Node de serie, sin librerías extra). Solo hace falta hacerlo una
vez (o cada vez que borres la carpeta `node_modules`).

## 4. Tu acceso de administrador

El archivo `.env` ya viene configurado con lo que pediste:

- **Usuario:** `Puntero45`
- **Contraseña:** `12345`

No hace falta que hagas nada para esto: en cuanto arranques la web con
`npm start`, ya puedes entrar en `/admin` con esos datos. Este es el
**único usuario que existe** — la tienda pública se ve exactamente igual
para cualquier visitante, sin registro ni cuentas de comprador. Solo tú,
con este usuario, puedes subir, editar o borrar cartas.

Dos notas:
- `12345` es una contraseña muy fácil de adivinar. Está bien para probar la
  web en tu ordenador, pero si algún día la subes a internet te recomiendo
  cambiarla por una más segura.
- Para cambiarla cuando quieras: edita `ADMIN_USERNAME` en `.env` si quieres
  otro usuario, y genera una contraseña nueva con
  ```
  npm run hash-password -- "tu-contraseña-nueva"
  ```
  y pega la línea `ADMIN_PASSWORD_HASH=...` que te imprime dentro de tu `.env`.

El archivo `.env` nunca se sube a ningún sitio ni se comparte: ahí vive tu
contraseña (guardada cifrada, no en texto plano). Ya está excluido en
`.gitignore` por si algún día usas git.

## 5. Arrancar la web

```
npm start
```

Verás en la terminal:

```
Tienda:  http://localhost:3000
Admin:   http://localhost:3000/admin
```

Abre esos enlaces en el navegador. Dejar la terminal abierta mientras
uses la web; si la cierras, el servidor se para.

---

## 6. Configurar Bizum y PayPal (desde el panel, no desde archivos)

Entra en `/admin` → pestaña **"Ajustes de cobro"**. Ahí rellenas y guardas:

- **Bizum:** tu número de teléfono y el nombre que quieres que vea el
  comprador. También puedes cambiar los minutos que se reserva una carta
  mientras espera el pago (60 por defecto).
- **PayPal:** el modo (pruebas/real), el Client ID y el Secret.

Guardar solo lleva un clic, y puedes volver a cambiar estos datos cuando
quieras sin tocar ningún archivo ni reiniciar el servidor.

### Cómo funciona cada método

**PayPal — 100% automático.** En cuanto el comprador paga, la web lo
confirma sola con PayPal y marca la carta como vendida al momento. Tú no
haces nada.

Para conseguir tu Client ID y Secret:
1. Entra en https://developer.paypal.com/dashboard/applications con tu
   cuenta de PayPal (o crea una si no tienes).
2. Crea una "App" nueva. Por defecto sale en modo **Sandbox** (pagos de
   prueba, sin dinero real) — es donde te recomiendo empezar.
3. Copia el **Client ID** y el **Secret** que te da y pégalos en el panel.
4. Cuando quieras cobrar de verdad, crea otra app en modo **Live** en el
   mismo sitio, cambia el modo a "Real" en el panel y pega esas otras
   credenciales.

Si dejas estos campos vacíos, el botón de PayPal simplemente avisará al
comprador de que "no está configurado" en vez de fallar.

**Bizum — importante leer esto.** Bizum **no ofrece una API pública** para
que una persona particular reciba pagos y los confirme automáticamente sin
darse de alta como negocio con un banco (Bizum para comercios, gestionado
normalmente por pasarelas como Redsys o MONEI, con contrato y comisiones).
Eso no encaja con "solo subir cartas", así que monté la alternativa más
simple posible en vez de prometer algo que en realidad no se puede
automatizar sin ser autónomo:

1. El comprador elige Bizum al pagar → sus cartas se **reservan** al momento
   (nadie más puede comprarlas mientras tanto) y ve tu número de Bizum y un
   código de referencia para el concepto.
2. Cuando veas el ingreso en tu propio banco, entras en `/admin` → pestaña
   **Pedidos** → pulsas **"Marcar pagado"**. Ahí sí se descuenta el stock
   solo y el pedido queda registrado.
3. Si nadie paga a tiempo, la reserva expira sola (por defecto en 60
   minutos, configurable en Ajustes de cobro) y la carta vuelve a estar
   disponible sin que tengas que hacer nada.

Es decir: subir cartas, cero esfuerzo. Cobros por PayPal, cero esfuerzo.
Cobros por Bizum, un único clic de confirmación por venta.

---

## 7. Usar el panel de administrador

Entra en `http://localhost:3000/admin` con el usuario y contraseña que
configuraste.

- **Pestaña Cartas**: formulario para subir una carta nueva (nombre, set,
  número, estado de conservación, precio, fotos y descripción) y una tabla
  con todas tus cartas para editarlas o borrarlas.
- **Pestaña Pedidos**: todos los pedidos, con botones para confirmar o
  cancelar los pagos por Bizum pendientes.
- **Pestaña Ajustes de cobro**: tu número de Bizum y tus credenciales de
  PayPal (ver punto 6).
- Arriba verás cuántas cartas tienes en venta, cuántas has vendido y tus
  ingresos totales.
- El botón redondo con el sol/la luna (arriba a la derecha) cambia entre
  tema claro y oscuro, tanto en la tienda como en este panel. Se acuerda de
  tu elección la próxima vez que entres.

## 8. Solo en tu ordenador, por ahora

Mientras el servidor esté arrancado en tu ordenador, la web solo es visible
para ti (en `localhost`). Cuando quieras que cualquiera pueda comprarte
desde internet, sigue el punto 10 para subirla a GitHub y desplegarla en
Render.com.

## 9. Estructura del proyecto

```
holoteca/
├── server.js              punto de entrada del servidor
├── routes/                endpoints de la API (cartas, pedidos, ajustes, login, PayPal)
├── db/store.js            almacén de datos en db/data.json (se crea solo)
├── utils/                 hash de contraseñas y ajustes de cobro por defecto
├── middleware/             protección de rutas de administrador
├── scripts/hash-password.js  genera el hash de tu contraseña
└── public/                lo que ve el navegador
    ├── index.html          tienda
    ├── admin.html          panel de administrador
    ├── css/                 estilos (tema claro/oscuro)
    ├── js/                  lógica de tienda, panel y cambio de tema
    └── uploads/             fotos de las cartas que subas
```

**Dónde se guardan tus datos:**
- **En tu ordenador** (sin tocar nada): cartas, pedidos y ajustes en
  `db/data.json`, fotos en `public/uploads/`. Haz una copia de esos de vez
  en cuando si quieres una copia de seguridad.
- **Si configuras `MONGODB_URI`** (paso necesario para desplegar gratis en
  Render, ver punto 10): los datos se guardan en tu base de datos de
  MongoDB Atlas en su lugar.
- **Si configuras Cloudinary** desde el panel (Ajustes de cobro): las
  fotos se guardan ahí en vez de en `public/uploads/`.

Puedes mezclarlos sin problema (por ejemplo Mongo activado pero sin
Cloudinary): cada pieza es independiente.

## 10. Subir a GitHub y desplegar gratis en Render.com

Vas a alojar la web gratis, y para que nada se te borre necesitas dos
servicios externos gratuitos además de Render:

- **MongoDB Atlas** (gratis): guarda tus cartas, pedidos y ajustes.
- **Cloudinary** (gratis): guarda las fotos de las cartas.

Esto hace falta porque el plan gratis de Render **borra todo lo que la web
guarda en su propio disco** cada vez que el servicio se reinicia o se
"duerme" por inactividad (algo normal en el plan gratis). Guardando los
datos y las fotos fuera de ese disco, en estos dos servicios gratuitos, no
se pierde nada aunque Render reinicie el servicio todas las veces que
quiera. El proyecto ya está preparado para esto — solo hay que rellenar
unas credenciales, nada de tocar código.

### Paso 1 — Crear tu base de datos gratis en MongoDB Atlas

1. Ve a https://www.mongodb.com/cloud/atlas/register y crea una cuenta
   gratuita.
2. Cuando te pida crear un cluster, elige el plan **M0 (Free)**. Puedes
   dejar el resto de opciones por defecto y darle a **Create**.
3. Te pedirá crear un usuario de base de datos: pon un nombre de usuario y
   una contraseña (guárdalos, los necesitas ahora mismo) → **Create User**.
4. En **Network Access**, añade `0.0.0.0/0` ("Allow access from anywhere")
   para que Render pueda conectarse. Es lo habitual para este tipo de
   proyecto pequeño.
5. Ve a tu cluster → **Connect** → **Drivers** → copia la cadena de
   conexión, que tiene esta pinta:
   ```
   mongodb+srv://tu-usuario:tu-contraseña@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Sustituye `tu-usuario` y `tu-contraseña` por los datos del paso 3.
   Guarda esta línea completa, es tu `MONGODB_URI` — la necesitas en el paso 3 de más abajo.

### Paso 2 — Crear tu cuenta gratis en Cloudinary

1. Ve a https://cloudinary.com/users/register_free y crea una cuenta
   gratuita.
2. En tu **Dashboard** verás tres datos: **Cloud name**, **API Key** y
   **API Secret**. Guárdalos — no los pegues en ningún archivo, van
   directos en el panel de admin de tu web una vez esté desplegada (punto
   4 de más abajo).

### Paso 3 — Subir el proyecto a GitHub

1. Crea una cuenta gratuita en https://github.com si no tienes.
2. Ahí, botón **"New repository"** → nómbralo `holoteca` → puedes dejarlo
   en **Private** → no marques "Add a README" (ya tienes archivos) →
   **Create repository**.
3. En la terminal de VS Code, dentro de la carpeta del proyecto:
   ```
   git init
   git add .
   git commit -m "Primera version de Holoteca"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/holoteca.git
   git push -u origin main
   ```
   (cambia `TU-USUARIO` por tu usuario de GitHub; si no tienes `git`
   instalado, bájalo de https://git-scm.com primero). Si te pide iniciar
   sesión, sigue lo que te proponga VS Code (normalmente abre el navegador
   para que confirmes el acceso).

   El `.gitignore` ya se encarga de que `.env`, `db/data.json`,
   `node_modules` y las fotos subidas **no** se suban a GitHub — ahí vive
   tu contraseña y tus datos, no tienen que estar en un repositorio.

### Paso 4 — Desplegar en Render.com

1. Crea una cuenta gratuita en https://render.com (puedes entrar
   directamente con tu cuenta de GitHub).
2. Panel de Render → **"New +"** → **"Web Service"** → conecta tu repo
   `holoteca`.
3. Rellena:
   - **Name:** `holoteca` (formará parte de tu dirección: `holoteca.onrender.com`)
   - **Region:** Frankfurt (la más cercana a España)
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** **Free**
4. Antes de crear el servicio, en **"Environment Variables"** añade estas
   (copia los valores desde tu `.env` local, ábrelo en VS Code):
   - `SESSION_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD_HASH`
   - `MONGODB_URI` → pega aquí la cadena de conexión completa del Paso 1

   No hace falta que añadas `PORT`: Render pone el suyo automáticamente y
   el servidor ya está preparado para usarlo.
5. **Create Web Service.** Render construye y despliega solo; al terminar
   te da una URL pública tipo `https://holoteca.onrender.com`. Cada vez que
   hagas `git push` a `main`, Render vuelve a desplegar solo.

### Paso 5 — Pegar tus credenciales de Cloudinary en el panel

1. Entra en `https://holoteca.onrender.com/admin` (con tu usuario y
   contraseña de siempre) → pestaña **Ajustes de cobro** → sección
   **Imágenes (Cloudinary)**.
2. Pega el Cloud name, API Key y API Secret del Paso 2 → **Guardar
   ajustes**.

A partir de ahí, cada foto que subas a una carta se guarda en Cloudinary en
vez de en el disco de Render, así que sobrevive a cualquier reinicio.

### Cosas a tener en cuenta con el plan gratis de Render

- **Se duerme:** si nadie visita la web durante 15 minutos, Render la
  "duerme" para ahorrar recursos. La siguiente visita tarda unos 30-50
  segundos en cargar mientras se despierta — es normal, no es que esté
  rota.
- **Datos a salvo:** con MongoDB Atlas y Cloudinary configurados como
  arriba, tus cartas, pedidos, ajustes y fotos **no se pierden** aunque el
  servicio se duerma o se reinicie. Solo tarda un poco en despertar.
- Si en algún momento crece mucho el uso y quieres que no se duerma nunca,
  eso ya es un plan de pago de Render — pero para un catálogo personal el
  plan gratis con esta configuración es más que suficiente.
## 11. Precios automáticos (Cardmarket)

Puedes hacer que el precio de una carta se actualice solo, siguiendo el
precio de mercado de Cardmarket (a través de la API pública y gratuita de
pokemontcg.io). Es opcional, carta por carta.

**Cómo activarlo en una carta:**
1. Al crear o editar una carta, marca la casilla **"Sincronizar precio
   automáticamente con Cardmarket"**.
2. Busca la carta por nombre y haz clic en el resultado correcto de la
   lista (esto la vincula a su ficha real — importante para que el precio
   sea el de la carta correcta y no el de otra parecida).
3. Pon tu **margen %** sobre el precio de mercado si quieres ganar algo por
   encima (por ejemplo, 15 = precio de mercado + 15%). Puedes dejarlo en 0
   para usar el precio de mercado tal cual.
4. Guarda la carta.

**Cómo funciona la sincronización:**
- Se revisa **una vez al día** sola, sin que tengas que hacer nada. También
  puedes forzarla cuando quieras desde `/admin` → pestaña **Precios** →
  botón **"Sincronizar precios ahora"**.
- El precio nuevo siempre se **redondea hacia arriba al euro entero** (por
  ejemplo, 11,20€ se convierte en 12€).
- Si el cambio respecto al precio actual es **pequeño** (por debajo del
  umbral que configures en Ajustes, 15% por defecto), se aplica solo, sin
  avisarte.
- Si el cambio es **grande** (una subida o bajada rara), **no se aplica
  solo** — se queda como "pendiente de revisar" en la pestaña **Precios**,
  donde ves el precio actual, el propuesto, y decides si lo aplicas o lo
  descartas.
- Las cartas que **no** tengan la casilla marcada nunca se tocan — sigues
  controlando su precio tú a mano, como siempre.

**Configuración (opcional)**, en `/admin` → **Ajustes** → sección
"Sincronización de precios":
- **API Key de pokemontcg.io**: no hace falta para que funcione, pero si
  vinculas muchas cartas y empiezas a quedarte sin peticiones, puedes
  pedir una gratis en pokemontcg.io/dashboard y pegarla ahí.
- **Umbral de cambio automático (%)**: a partir de qué porcentaje de cambio
  se considera "grande" y se queda pendiente de tu revisión en vez de
  aplicarse solo.


## 12. Seguridad

Se ha hecho una revisión de seguridad completa del proyecto. Esto es lo que
se ha reforzado (no tienes que hacer nada para que funcione, ya viene
aplicado en el código):

- **Cabeceras de seguridad** (con la librería `helmet`): protegen contra
  varios ataques comunes del navegador (clickjacking, sniffing de tipos de
  archivo, etc.).
- **Límite de intentos de login**: como mucho 10 intentos cada 15 minutos
  por dirección, para dificultar que alguien intente adivinar tu
  contraseña de admin a base de probar miles de veces.
- **Límite de compras seguidas**: para que nadie pueda "reservar" todo tu
  catálogo de golpe sin llegar a pagar nunca y bloquear tu tienda.
- **Sesión más segura**: la cookie de admin ahora viaja marcada para
  enviarse solo por HTTPS en producción, y con protección adicional contra
  ataques cruzados entre webs (CSRF).
- **Sin secreto de sesión conocido**: antes, si se te olvidaba poner tu
  propio `SESSION_SECRET`, la web usaba uno de repuesto que cualquiera
  podía ver en el código. Ahora, si no lo has puesto, se genera uno
  aleatorio en cada arranque (mejor avisarte con un aviso en la terminal
  que dejar una puerta conocida abierta).
- **Sesiones que sobreviven a reinicios**: si tienes `MONGODB_URI`
  configurado, las sesiones de admin se guardan ahí en vez de en la
  memoria del servidor, así no tienes que volver a iniciar sesión cada vez
  que Render reinicia la web.
- **Comprobación de que el usuario existe no se nota por la velocidad de
  respuesta** del login (un detalle técnico que evita una vía sutil de
  adivinar el usuario correcto).
- **Límites de tamaño** en los campos de texto y en las peticiones, para
  evitar abusos de almacenamiento.

### Lo que tienes que revisar tú (una sola vez)

1. **En Render**, añade esta variable de entorno nueva junto a las que ya
   tenías:
   - `NODE_ENV` = `production`
2. Confirma que tu repositorio de GitHub está en **Private** (no público),
   en la configuración del repositorio en github.com.
3. De vez en cuando (cada pocos meses), en la terminal de VS Code dentro de
   tu proyecto, ejecuta:
   ```
   npm audit
   ```
   Esto avisa si alguna de las librerías que usa el proyecto ha recibido un
   aviso de seguridad desde que la instalaste. Si te sale algo, pégamelo
   aquí y lo revisamos.

Como siempre: tus cartas, pedidos y fotos no se ven afectados por nada de
esto — solo se ha reforzado cómo se protege el acceso y el propio
servidor.
