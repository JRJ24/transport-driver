# Backlog de issues - App Mobile Conductor

Estas issues corresponden solo al repositorio `JRJ24/transport-driver`.

No incluye Backend/API porque ya esta colocado. No incluye App Mobile Cliente ni App Portal TMS.

## Issues a crear

| RF | Titulo | Alcance Mobile Conductor |
| --- | --- | --- |
| RF-002 | Inicio de sesion | Si |
| RF-003 | Recuperacion de contrasena | Si |
| RF-004 | Cambio de contrasena | Si |
| RF-005 | Cierre de sesion | Si |
| RF-006 | Actualizacion de perfil | Si |
| RF-012 | Consulta de vehiculos | Consulta limitada |
| RF-014 | Cambio de estado conductor | Si |
| RF-015 | Consulta historial conductor | Consulta limitada |
| RF-023 | Recordatorios | Si |
| RF-040 | Asignacion automatica | Recibe asignacion |
| RF-041 | Asignacion manual | Recibe asignacion |
| RF-042 | Reasignacion | Recibe cambio |
| RF-043 | Compartir GPS | Si |
| RF-044 | Actualizacion de posicion | Si |
| RF-045 | Visualizacion en mapa | Si |
| RF-046 | Tiempo estimado | Si |
| RF-047 | Historial del recorrido | Consulta limitada |
| RF-048 | Captura fotografica | Si |
| RF-049 | Captura de firma | Si |
| RF-050 | Registro de coordenadas | Si |
| RF-051 | Registro de fecha y hora | Si |
| RF-052 | Validacion de evidencias | Si |
| RF-053 | Registrar incidencia | Si |
| RF-054 | Adjuntar fotografias | Si |
| RF-055 | Clasificacion | Limitado |
| RF-056 | Seguimiento | Consulta |
| RF-057 | Notificaciones push | Si |
| RF-058 | Correos electronicos | Recibe |
| RF-059 | Cambios de estado | Si |
| RF-060 | Alertas operativas | Limitado |

## Plantilla de cuerpo

Usar este cuerpo para cada issue:

```md
## Requerimiento

Implementar el requisito funcional indicado para App Mobile Conductor.

## Alcance

- Repositorio: JRJ24/transport-driver
- Plataforma: App Mobile Conductor
- RF: <RF>
- Funcionalidad: <Titulo>
- Nivel requerido: <Alcance Mobile Conductor>

## Criterios de aceptacion

- La funcionalidad queda disponible segun el alcance definido para Mobile Conductor.
- Se integra con los endpoints de Backend/API existentes cuando aplique.
- Se validan estados de carga, error y exito en la app.
- Se respetan restricciones de conductor y alcance limitado cuando aplique.
```
