# Fase 3b — 10 compras simultáneas del mismo producto por gramos

**Fecha:** 16 de octubre de 2026 · **Entorno:** Supabase local (Docker), nunca producción.
**Script:** `supabase/pruebas/concurrencia-compras.mjs` · **Datos crudos:** `resultados-antes.json`, `resultados-despues.json`.

## Qué se probó

Mismo camino que un pedido real: carrito guardado en la base → Edge Function `create-order` →
`procesar_checkout` con la sesión de cada comprador. Los 10 compradores confirman **al mismo tiempo**.

**Producto por gramos** ("PRUEBA material seleccionado"), 130 g en total:

| Presentación | Precio | Stock |
|---|---|---|
| 5 g | $20.000 | 4 |
| 10 g | $38.000 | 3 |
| 20 g | $70.000 | 2 |
| 40 g | $130.000 | 1 |

Más un producto por unidades ($10.000, stock 10) para mezclar carritos.

**Carritos (la demanda supera el stock a propósito):**

| Comprador | Carrito |
|---|---|
| 1, 2, 4, 5 | 1 × 5 g |
| 3 | 1 × 5 g + 1 unidad (en ese orden) |
| 6, 8 | 1 × 10 g |
| 7 | 1 unidad + 1 × 10 g (orden **inverso** al del comprador 3) |
| 9 | 2 × 20 g |
| 10 | 1 × 20 g + 1 × 40 g |

Resultado esperado en cada ronda: **8 pedidos y 2 rechazados**. Uno de los cinco del 5 g se queda sin stock, y el 9 y el 10 compiten por el 20 g: solo uno puede ganar.

**Invariantes verificadas en cada ronda:**
- nunca hay stock negativo;
- el stock vendido por presentación cuadra exacto con lo descontado;
- el `stock_total` en gramos cuadra;
- las unidades cuadran;
- un pedido por cada éxito;
- precios y totales correctos;
- nunca se vende de más;
- los rechazos traen un mensaje claro;
- quien compra queda con el carrito vacío y quien no, lo conserva.

## Resultados (10 rondas cada uno)

| | Versión **anterior** de `procesar_checkout` | Versión **Fase 3** (en producción) |
|---|---|---|
| Pedidos confirmados | 66 de 80 posibles | **80 de 80** |
| Rechazados | 34 | 20 (solo por falta real de stock) |
| **Bloqueos mutuos (deadlock)** | **24** | **0** |
| Tiempo, mediana por ronda | 1.153 ms | **207 ms** |
| Tiempo máximo | 1.837 ms | 581 ms |
| Invariantes de stock y totales | ✅ siempre | ✅ siempre |

## Conclusiones

1. **El stock nunca se corrompió, en ninguna de las dos versiones.** El bloqueo por producto (`FOR UPDATE`) ya evitaba vender de más y dejar stock negativo.
2. **La versión anterior rechazaba compras que sí tenían stock.** Dos pedidos con productos en distinto orden se bloqueaban entre sí; PostgreSQL cancelaba uno y la persona veía "deadlock detected". En la peor ronda solo pasaron 4 de 10 pedidos.
3. **El cambio de la Fase 3 lo resolvió.** Bloquear los productos siempre en el mismo orden eliminó los bloqueos mutuos: 0 en 10 rondas, todos los pedidos posibles confirmados y tiempos unas 5 veces menores.
4. **Los rechazos legítimos explican la causa**, por ejemplo: "Stock insuficiente. Quedan 0 paquetes de 5g de PRUEBA material seleccionado."

## Límites de la prueba

- Es **local**: valida la lógica (que es lo importante en concurrencia), no la velocidad en línea, donde influyen la red, el plan de Supabase y los arranques en frío de la Edge Function. Para medir tiempos reales se puede repetir el mismo script en un proyecto de pruebas de Supabase; solo cambia hacia dónde apunta.
- 10 compradores simultáneos es poca carga. Con más compradores sobre el **mismo** producto los pedidos se ponen en fila (por el bloqueo) y el tiempo crece de forma lineal, sin errores.
