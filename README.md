### Dependencias
- https://primeng.org/carousel
- https://tailwindcss.com/


#### pendientes
- revisar visual de los siguientes componentes creados (definir flujo ideal, ajustes color fuente, estructura,)
    - Formulario de creacion de usuarios /auth/register (error como se muestran, diseño visual)
    - MarketPlacet del customer
        - Carrito
        - Checkout
        - buscador 
    - MarketPlacet admin
        - crear producto normal y con variantes
        - ver productos
        - ver ordenes creadas
        - historial ordenes
        - crear tags y categorias

analizar que esta pendiente, todas las vistar anterior mente se puden ver desde el menu desplegable

nota el formulario de creacion de productos no esta completo faltan algunos items por agregar

### Tarea para mañana 08 de junio del 2026
- Crear panel para el usuraio
    - Panel de informacion del usuario con posibilidad de editar sus datos
    - Panel de ordenes del usuario
    - Panel de productos favoritos del usuario
- Refactor codigo para crear un service para mejor control de los query al carrito y productos
    - Crear service para productos db
        - obtener productos para el buscado del marketplace por nombre, sku, categoria, tag, y ordenarlo de manera asc o desc (por fecha de creacion, precion alfabeticamente, o popularidad)
        - obtener todo los productos validar rol
        - remover productos
        - actualizar producto
        - si un producto tiene variantes obtener las variantes