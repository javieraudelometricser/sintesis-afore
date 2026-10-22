# Síntesis Informativa — Afore XXI Banorte

Reemplazo del escenario de Make "AforeXXI síntesis informativa" con Google Apps Script.

## Flujo
1. Grok crea cada noche (~21:00) el Sheet "Síntesis feed AAAA-MM-DD" en `Proyectos / SÍNTESIS AFORE`.
2. Apps Script lee la columna B de la primera pestaña, parsea y clasifica las notas
   (Marca, Afores, Competencia), quita duplicados y toma máximo 8 por bloque.
3. Llena `plantilla.html`, genera el PDF y envía a Telegram el PDF (con fecha y link de Drive) y el HTML.

## Configuración (Propiedades del script)
- `TELEGRAM_TOKEN`: token del bot (no se guarda en el código)
- `TELEGRAM_CHAT_ID`: ID del grupo de Telegram
- Zona horaria del proyecto: America/Mexico_City

## Pendiente
- Buscar automáticamente el Sheet del día (requiere acceso a la carpeta)
- Ajustar el prompt de Grok (nombre de pestaña fijo, búsquedas de Competencia)
- Validaciones, reintentos y aviso de error
- Trigger L-V 8:00 y prueba en paralelo con Make
