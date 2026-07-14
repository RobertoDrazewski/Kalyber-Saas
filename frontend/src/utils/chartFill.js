// ============================================================
// [NUEVO 14/07/2026] FIX del gráfico "con saltos, no se ve completo"
// del Plan Avanzado (VL502).
//
// Causa real: el VL502 manda posición (0x0200) MUCHO más seguido que
// datos de motor (0x0900, ~1 de cada 5 paquetes según los logs
// reales) — son mensajes separados. Eso significa que en la serie que
// llega del backend, la mayoría de las filas tienen engine_rpm=null
// (y lo mismo para coolant_temp/battery_voltage/etc.). El gráfico
// (recharts) se armaba con connectNulls={false}, que corta la línea
// en cada null — con 4 de cada 5 puntos en null, el resultado visual
// es una línea partida en segmentos cortitos / puntos sueltos, que es
// justo el "no se ve completo, hay saltos" que reportó el cliente.
//
// La solución NO es simplemente poner connectNulls={true}: eso dibuja
// una interpolación lineal recta entre el último dato real y el
// próximo, lo cual puede mostrar una rampa de RPM que nunca pasó en
// la realidad. En cambio, "sostenemos" (forward-fill) el último valor
// real conocido hasta que llegue uno nuevo — es la forma correcta de
// graficar una señal que se reporta a intervalos irregulares: el
// motor no vuelve a 0 RPM entre paquete y paquete, simplemente no nos
// llegó un dato nuevo todavía.
// ============================================================
export function forwardFillSeries(series, fields) {
  const filled = [];
  const last = {};
  for (const row of series) {
    const next = { ...row };
    for (const field of fields) {
      if (next[field] === null || next[field] === undefined) {
        if (last[field] !== undefined) next[field] = last[field];
      } else {
        last[field] = next[field];
      }
    }
    filled.push(next);
  }
  return filled;
}
