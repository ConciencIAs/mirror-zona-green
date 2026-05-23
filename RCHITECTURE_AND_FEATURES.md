
# 🌿 Zona Green - Documento de Arquitectura y Funcionalidades Frontend (Angular)

[cite_start]Este documento define la estructura técnica, lógica de negocio y flujos de interfaz que el equipo de desarrollo o el asistente de IA deben seguir para implementar el frontend de la plataforma **Zona Green** (www.zonagreen.co) [cite: 53] utilizando **Angular**.

---

## 📅 1. Hitos de Desarrollo y Alcance (Fase 1 - Mayo 28)

[cite_start]De acuerdo con el cronograma de entregables, las siguientes funcionalidades deben estar operativas y desplegadas en la fecha establecida[cite: 16, 21]:

1.  [cite_start]**Front Público:** Landing corta orientada a la conversión de registro[cite: 20, 55].
2.  [cite_start]**Registro y BD Usuarios:** Sistema completo de onboarding y manejo de perfiles[cite: 24].
3.  [cite_start]**Front Privado:** Portal exclusivo para usuarios autenticados y validados[cite: 27, 138].
4.  [cite_start]**Módulo de Inventario:** Panel de administración de existencias y material[cite: 31, 180].
5.  [cite_start]**Módulo de Ecommerce:** Flujo completo de carrito de compras y Checkout hacia WhatsApp[cite: 34, 37, 284].

---

## 🛠️ 2. Directivas Técnicas Especiales y UI/UX

* [cite_start]**Enfoque Mobile-First Obligatorio:** El diseño y desarrollo de todos los componentes, pantallas y layouts públicos/privados deben optimizarse prioritariamente para dispositivos móviles.
* **Modo Claro / Oscuro Dinámico:** Implementar soporte nativo con Tailwind CSS (`class` strategy). [cite_start]El modo oscuro debe cumplir estrictamente con: fondo negro, títulos verdes, texto blanco y detalles/diseños en azul[cite: 73, 153].
* [cite_start]**Persistencia del Estado:** El estado del carrito de compras y la sesión del usuario deben ser persistentes [cite: 254, 275] utilizando `localStorage` en combinación con Angular Signals.
* [cite_start]**Píxeles y Analítica:** Es un requerimiento crítico inyectar los píxeles de conversión de registro, clicks de interés y eventos transaccionales del carrito en todas las ventanas del portal[cite: 23, 30, 56, 136].

---

## 🗺️ 3. Lógica de Enrutamiento y Roles (Guards)

[cite_start]El enrutamiento de Angular administrará la discriminación de los tres roles del ecosistema: `usuario (customer)`, `administrador` y `médico` (este último mapeado para activación en Fase 2)[cite: 1, 120].

### Reglas de los Guards:
* `AgeGuard`: Intercepta la navegación inicial. Si el usuario selecciona "NO" en el filtro de mayoría de edad[cite: 59], se le restringe el acceso de forma permanente.
* `AuthGuard`: Valida la existencia de una sesión activa (JWT válido)[cite: 376, 382]. Si no está autenticado, redirige forzosamente a `/registro`[cite: 2].
* `AdminGuard`: Valida que el rol decodificado en el token coincida estrictamente con `admin`. Si el usuario tiene rol `customer`, es redirigido a la sección privada.

---

## 📦 4. Desglose de Módulos y Funcionalidades por Pantalla

### 4.1 Front Público (`src/app/features/public`)
* **Estructura Corta de Conversión:** Diseñado en un máximo de 3 secciones dinámicas enfocadas exclusivamente en capturar el registro del usuario[cite: 55].
* **Diapositiva de Inicio:** Un banner principal compuesto por 2 columnas editables desde el panel de administración[cite: 72, 148].
* **Filtro Obligatorio:** Pop-up o sección restrictiva de "Mayor de edad: SÍ / NO" para garantizar un acceso informado y seguro[cite: 22, 58, 60].
* **Footer Público:** Debe incluir la información de contacto base [cite: 135], teléfono institucional [cite: 131] y los enlaces legales obligatorios: *Política de tratamiento de datos, Términos y condiciones, y Legislación*[cite: 132, 133, 134].

### 4.2 Módulo de Registro y Autenticación (`src/app/features/auth`)
* **Campos del Formulario:** Nombre de usuario, Correo, Celular, Fecha de Nacimiento, Documento de identidad (Cédula/ID), Ciudad, Contraseña y Código de invitación (Referidos)[cite: 89, 90, 91].
* **Estrategia de Acceso:** Soporte e integración técnica para autenticación fluida mediante **Magic Link**[cite: 85].
* **Lógica de Bloqueos de Validación:** Los inputs deben contar con feedback visual inmediato[cite: 253]. El botón de envío se mantendrá deshabilitado y lanzará alertas informativas si el usuario intenta avanzar sin marcar los siguientes elementos obligatorios[cite: 85]:
    * Checkbox de Autorización de Tratamiento de Datos Personales (Normativa Colombiana)[cite: 99].
    * Checkbox de Aceptación de Términos y Condiciones de Uso[cite: 104].
* **Seguridad Integrada:** Integración en formularios con CAPTCHA para protección anti-bots [cite: 125, 126], control de límites de peticiones (*rate limit*) [cite: 124] y lógica de bloqueo temporal tras intentos fallidos consecutivos[cite: 127].

### 4.3 Front Privado (`src/app/features/private`)
Exclusivo para la comunidad registrada. Mantiene de forma estática la barra promocional permanente ("Ecosistema para la Reducción de Riesgos y Daños") y el menú de navegación[cite: 139, 149].

#### A. Perfil de Usuario
* **Actualización de Datos:** Formulario para modificar información personal de la base de datos de registro y reestablecer contraseñas[cite: 29, 176].
* **Gestión de Direcciones:** Componente dinámico que permite almacenar y seleccionar un máximo de 3 direcciones de envío independientes[cite: 178].
* **Autogestión de Cuenta:** Acciones explícitas para bloquear temporalmente o eliminar definitivamente la cuenta del afiliado[cite: 177].

#### B. Selección Informada (Marketplace)
* **Presentación de Productos:** Catálogo minimalista basado en tarjetas limpias [cite: 235], compuesto por: foto, nombre, descripción, presentación, disponibilidad, aporte económico y sistema de calificación de 1 a 5 estrellas[cite: 237, 238, 239, 240, 241, 242, 243].
* **Regla de Tres y Conversión de Gramajes (Categoría: *Material Seleccionado*):**
    * Cuando un producto pertenezca a esta categoría [cite: 194], el frontend debe transformar el peso total ingresado en el backend y desplegar de forma interactiva una selección de empaques predefinidos: **5g, 10g, 20g, 40g o Libre**[cite: 201, 206, 207, 208, 209, 210, 211].
    * Al cambiar la variante de gramaje mediante los selectores de incremento `(+)` y decremento `(-)` [cite: 260], la UI debe aplicar automáticamente la lógica matemática para recalcular y renderizar el precio final correspondiente[cite: 258, 259].
* **Optimización de Conversión:** El proceso está optimizado para requerir un máximo de 3 clics para añadir cualquier producto al carrito persistente[cite: 252, 254].
* **Buscador Integrado:** Input superior estático provisto de filtros de búsqueda simples basados en los *tags* inyectados al producto[cite: 154, 158, 198].
* **Sección de Contenidos Informativos:** Rutas con renderizado de contenido textual estático e institucional:
    * `/cannabismedicinalencolombia`: Despliega las subsecciones de *Legislación* y *Trazabilidad y Tecnología*[cite: 317, 321, 323].
    * `/medicoscannabiscolombia`: Texto explicativo médico con un botón de llamada a la acción (CTA) configurado con el aviso "Próximamente" (Fase 2)[cite: 329, 331, 332].
    * `/rrd`: Sección de Reducción de Riesgos y Daños[cite: 341].
    * *Preguntas Frecuentes:* Insertado automáticamente al hacer scroll al final del catálogo de productos[cite: 345].

## 🛒 5. Lógica del Sistema de Transacciones (E-Commerce)

### 5.1 Gestión del Carrito
Permite agrupar múltiples ítems [cite: 272], actualizar unidades, calcular de forma reactiva los totales económicos de la orden [cite: 276], eliminar elementos y gestionar la persistencia en caso de recarga de la aplicación[cite: 274, 275].

### 5.2 Flujo de Checkout 1 (Enlace a WhatsApp) e Interfaz de Gestión Interna

  1.  **Invocación y Captura Logística:** Al presionar "Confirmar selección", el frontend despliega un formulario intermedio para definir si el pedido "necesita envío" o se va a "recoger en punto", junto con la dirección y observaciones del cliente.
  2.  **Procesamiento Atómico (Edge Function):** La aplicación consume la Supabase Edge Function enviando estos datos. La función valida el stock, calcula los precios reales, registra la orden de forma inmutable en la base de datos y **retorna el `order_id` generado automáticamente**.
  3.  **Construcción del Mensaje Automatizado:** El servicio de Angular recibe el `order_id` y compila las variables para construir el texto codificado que se enviará al número oficial de Zona Green (`3134312139`). Este mensaje incluirá un enlace directo para que el staff gestione el pedido con un solo clic:

      ```typescript
      // Estructura del mensaje enviado a WhatsApp:
      const mensajeWzp = `🌿 *Zona Green - Solicitud de Orden #${orderId}* 🌿\n\n` +
                         `👤 *Cliente:* ${user.name}\n` +
                         `📱 *Celular:* ${user.phone}\n\n` +
                         `📦 *Detalle del Pedido:* \n${listaProductos}\n` +
                         `💰 *Total Aporte:* $${totalOrden}\n\n` +
                         `📍 *Modo de Entrega:* ${tipoEntrega}\n` +
                         `🏠 *Dirección:* ${direccion || 'N/A'}\n` +
                         `💬 *Notas del Cliente:* ${observaciones || 'Sin observaciones'}\n\n` +
                         `🔗 *Link de Gestión (Uso Exclusivo Staff):* \nhttps://www.zonagreen.co/administrador/ordenes/${orderId}`;
      ```

  4.  **Pantalla de Control de Orden (`/administrador/ordenes/:id`):**
      * **Seguridad por Roles (Guards):** El acceso a esta ruta está completamente restringido. El Guard del sistema validará el JWT y **solo permitirá el ingreso si el usuario autenticado tiene el rol de `admin` o `agente`**. Si un cliente (`customer`) intenta acceder al enlace, será redirigido de inmediato a la sección privada general.
      * **Lógica de Operación del Staff:** Desde esta interfaz, el administrador o agente interactúa con la orden basándose en la concertación final realizada por el chat de WhatsApp, permitiendo modificar únicamente:
          * **Estado de la Orden (`status`):** Selector dinámico para transicionar el pedido (ej: de `pendiente` a `pagado`, `en_proceso`, `enviado` o `cancelado`).
          * **Tipo de Entrega:** Permite cambiar el flag entre "Envío" o "Recoger en Punto" si el usuario cambió de opinión durante la charla.
          * **Comentarios del Agente:** Un área de texto (`textarea`) exclusiva para que el staff deje notas internas de seguimiento (ej: *"Comprobante de pago verificado por Nequi"*, *"Se envía por Interrapidísimo con la guía XYZ"*).
      * **Bloqueo de Modificación de Precios:** Por seguridad y auditoría, la lista de productos comprados, las cantidades y el precio total totalizado por la Edge Function se renderizan en modo de "solo lectura" (deshabilitados), garantizando la inmutabilidad de la transacción financiera original.
  5.  El sistema redirige de forma automática abriendo una nueva pestaña con la URL hacia el número de WhatsApp oficial registrado de Zona Green (`3134312139`)[cite: 284, 302, 353].

### 5.3 Flujo de Checkout 2 (Impresión de Guía Físicas)
* Exclusivo para el operador de Zona Green en la interfaz administrativa[cite: 307].
* Una vez que el equipo de soporte valida la transacción e ingreso de aportes económicos vía WhatsApp [cite: 305], digita el monto final recibido y confirma el despacho en la plataforma[cite: 305, 306].
* Esto dispara un evento de impresión nativa del navegador (`window.print()`) cargando una hoja de estilos CSS `@media print` optimizada.
* La guía genera en papel el resumen físico: Nombre del destinatario, Celular y Dirección de destino (o indicación de Recoger en Punto)[cite: 308, 309, 310]. *Por regla de negocio, esta vista de impresión es efímera y no persiste registros locales adicionales ya que el histórico se consolidó en el Checkout 1*[cite: 311].

---

## 👑 6. Panel de Administración (`src/app/features/admin`)

Interfaz minimalista, diseñada sobre fondo oscuro con fuentes legibles en contraste de colores vivos y opción de alternar a paleta clara[cite: 165, 166]. Controla las siguientes secciones independientes:

### 6.1 Gestión de Usuarios
Visualización en cuadrícula de la base de datos de afiliados[cite: 168]. Permite la edición de perfiles, aplicación de bloqueos de seguridad temporales/permanentes y auditoría del historial transaccional de compras individuales[cite: 168].

### 6.2 Administración de Inventarios y Catálogo
Módulo para el control estricto del ciclo de vida de los productos[cite: 182, 190]. El formulario de creación y modificación exige obligatoriamente[cite: 183, 184, 191]:
* SKU autogenerado por el sistema, Fecha de llegada, Categoría, Nombre, Descripción, Costo, Precio de lista en marketplace y Tags asociados[cite: 192, 193, 194, 195, 196, 198, 199, 200].
* Controlador de estado binario para activar o desactivar la visibilidad en la tienda[cite: 185, 197].
* Gestor de carga de imágenes al Storage con compresión y optimización automática de tamaño de archivos en el cliente[cite: 186, 400, 401].
* **Sección de Trazabilidad de Movimientos:** Registro histórico de auditoría por cada alteración física de inventario. Guarda de forma obligatoria: tipo de movimiento, ID del administrador responsable, cantidad anterior, cantidad nueva, motivo y timestamp preciso[cite: 224, 225, 226, 227, 228, 229, 230, 231].

### 6.3 Editor de Contenidos Dinámicos
Habilita la reconfiguración y actualización directa en base de datos de los elementos visuales del frontend sin necesidad de desplegar nuevo código[cite: 11, 48, 171]:
* Modificación del copy de la franja promocional superior del portal privado[cite: 148, 171].
* Gestor de la diapositiva del Front Público, permitiendo alternar textos, modificar imágenes de fondo y añadir diapositivas extras (con un tope estricto de máximo 3 ítems en rotación)[cite: 148, 172].

### 6.4 Alertas y Analítica
* **Alertas de Inventario:** El sistema debe disparar notificaciones visuales reactivas e inmediatas en el Dashboard cuando un producto se encuentre próximo a terminarse o esté completamente agotado[cite: 213, 223].
* **Bloqueo de Sobreventa:** Validaciones lógicas en tiempo real que inhabilitan la edición del contador `(+)` en el marketplace si la cantidad seleccionada por el cliente iguala la disponibilidad física del stock centralizado[cite: 221, 222, 244].
* **Módulo de Análisis de Datos:** Panel estadístico que grafica el cruce transaccional de métricas: qué usuarios están comprando, qué productos específicos, valor de las interacciones por sección y frecuencias de recompra de la comunidad[cite: 113, 114, 115, 116, 170, 245].

---

## 🚀 7. Estrategia de Implementación y Performance

Para garantizar los requerimientos de SEO y Performance exigidos[cite: 410, 411], la estructura Angular aplicará las siguientes configuraciones en el archivo `angular.json` y a nivel de componentes:

1.  **Detección de Cambios Optimizada:** Configurar `changeDetection: ChangeDetectionStrategy.OnPush` en todos los componentes del catálogo y del administrador para mitigar reprocesamientos innecesarios del DOM.
2.  **Lazy Loading de Imágenes:** Utilizar la directiva nativa `NgOptimizedImage` para las fotos del marketplace, asegurando que las imágenes inferiores de la cuadrícula móvil solo se descarguen cuando entren en el viewport del dispositivo[cite: 417].
3.  **Manejo de Bucles Eficientes:** Implementar la directiva moderna `@for` acompañada obligatoriamente de la instrucción `track` apuntando al identificador único (`item.id` o `producto.sku`) para acelerar la reordenación de listas y búsquedas[cite: 192].