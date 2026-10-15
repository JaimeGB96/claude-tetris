---
name: clima-local
description: Obtiene el clima actual y el pronóstico de los próximos días para la ubicación local del usuario (detectada por IP) o para una ciudad indicada. Úsala cuando pida el clima, la temperatura, si va a llover o el pronóstico.
argument-hint: "[ciudad opcional]"
allowed-tools: Bash(curl *)
---

# Clima local

Consulta el clima con [wttr.in](https://wttr.in) (gratuito, sin API key).

## Pasos

1. Determina la ubicación:
   - Si el usuario pasó una ciudad en `$ARGUMENTS`, úsala (reemplaza espacios por `+`, p. ej. `Buenos+Aires`).
   - Si no, déjala vacía: wttr.in detecta la ubicación por IP.

2. Ejecuta la consulta (idioma español, JSON, unidades métricas):

   ```bash
   curl -s "https://wttr.in/<CIUDAD>?format=j1&lang=es"
   ```

   Con ubicación vacía queda `https://wttr.in/?format=j1&lang=es`.

3. Del JSON usa:
   - `nearest_area[0]`: `areaName[0].value`, `country[0].value` (ubicación detectada; confírmala al usuario, la geolocalización por IP puede ser imprecisa).
   - `current_condition[0]`: `temp_C`, `FeelsLikeC`, `humidity`, `windspeedKmph`, `winddir16Point`, `precipMM`, `lang_es[0].value` (descripción).
   - `weather[0..2]`: `date`, `mintempC`, `maxtempC`, y en `hourly[*].chanceofrain` la probabilidad máxima de lluvia del día.

4. Responde en español, breve, con este formato:

   ```
   📍 <Ciudad, País>
   Ahora: <descripción>, <temp>°C (sensación <feels>°C), humedad <h>%, viento <v> km/h <dir>
   Hoy / Mañana / Pasado: min–max °C, lluvia <p>%
   ```

   Añade una recomendación corta si aplica (paraguas, abrigo, etc.).

## Manejo de errores

- Si `curl` falla o no devuelve JSON válido, informa que no se pudo obtener el clima (posible falta de conexión) y sugiere indicar la ciudad manualmente.
- No inventes datos: si falta un campo, omítelo.
