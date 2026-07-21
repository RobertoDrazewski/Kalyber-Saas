# Cómo compilar cada versión (método simple, sin flags)

Hay DOS archivos de configuración listos. Elegís la caja que vas a
fabricar copiando UNO de ellos:

## Para fabricar una DESKTOP (scanner/simulador completo)
1. Copiá `config_variant_DESKTOP.h` a `src/config_variant.h`
   (reemplazando el que haya)
2. Compilá y flasheá como siempre (botón Upload de PlatformIO)

## Para fabricar una TALLER_MINI (solo scanner)
1. Copiá `config_variant_TALLER_MINI.h` a `src/config_variant.h`
2. Compilá y flasheá como siempre

Eso es todo — el archivo que copiaste decide qué entra al firmware.
No hay que editar código ni tocar nada más.

⚠️ Cuidado: si flasheás una caja mini con el archivo de desktop, va a
intentar leer el DPDT/OLED que no están cableados. Antes de flashear,
verificá qué archivo copiaste (la primera línea del archivo lo dice
en un recuadro grande).

---

# Grabar el ID del código de barras en el equipo (OBLIGATORIO)

Imprimir el barcode en la caja NO alcanza: el equipo también tiene
que saber su propio código, porque con él se identifica ante el
backend cada vez que sube un diagnóstico. Sin esto, las lecturas no
se pueden asociar al taller que pareó la caja.

Se hace UNA vez por equipo, en fábrica, y queda grabado en la memoria
flash (sobrevive reinicios y re-flasheos):

1. Generá el código en el panel: **Equipos Scanner → Generar nuevo
   scanner** → te da p.ej. `KAL-SCAN-0007` y el barcode para imprimir.
2. Conectá el equipo por USB y abrí el monitor serie (115200 baud).
3. Escribí:  `SETUID:KAL-SCAN-0007`  y Enter.
4. El equipo contesta `✅ UID guardado`. Verificá con `GETUID`.
5. Pegá la etiqueta con el barcode del MISMO código en esa caja.

El paso clave es que **el código grabado y el de la etiqueta sean el
mismo** — por eso conviene hacer los pasos 2-5 de una caja por vez,
sin apilar etiquetas sueltas.

Si el equipo arranca sin UID grabado, lo avisa por serial:
`⚠️ SIN UID GRABADO` — ese aviso es tu control de calidad antes de
despachar.
