$ErrorActionPreference = "Stop"

$repo = "JRJ24/transport-driver"
$platform = "App Mobile Conductor"

$issues = @(
  @{ rf = "RF-002"; title = "Inicio de sesion"; scope = "Si" },
  @{ rf = "RF-003"; title = "Recuperacion de contrasena"; scope = "Si" },
  @{ rf = "RF-004"; title = "Cambio de contrasena"; scope = "Si" },
  @{ rf = "RF-005"; title = "Cierre de sesion"; scope = "Si" },
  @{ rf = "RF-006"; title = "Actualizacion de perfil"; scope = "Si" },
  @{ rf = "RF-012"; title = "Consulta de vehiculos"; scope = "Consulta limitada" },
  @{ rf = "RF-014"; title = "Cambio de estado conductor"; scope = "Si" },
  @{ rf = "RF-015"; title = "Consulta historial conductor"; scope = "Consulta limitada" },
  @{ rf = "RF-023"; title = "Recordatorios"; scope = "Si" },
  @{ rf = "RF-040"; title = "Asignacion automatica"; scope = "Recibe asignacion" },
  @{ rf = "RF-041"; title = "Asignacion manual"; scope = "Recibe asignacion" },
  @{ rf = "RF-042"; title = "Reasignacion"; scope = "Recibe cambio" },
  @{ rf = "RF-043"; title = "Compartir GPS"; scope = "Si" },
  @{ rf = "RF-044"; title = "Actualizacion de posicion"; scope = "Si" },
  @{ rf = "RF-045"; title = "Visualizacion en mapa"; scope = "Si" },
  @{ rf = "RF-046"; title = "Tiempo estimado"; scope = "Si" },
  @{ rf = "RF-047"; title = "Historial del recorrido"; scope = "Consulta limitada" },
  @{ rf = "RF-048"; title = "Captura fotografica"; scope = "Si" },
  @{ rf = "RF-049"; title = "Captura de firma"; scope = "Si" },
  @{ rf = "RF-050"; title = "Registro de coordenadas"; scope = "Si" },
  @{ rf = "RF-051"; title = "Registro de fecha y hora"; scope = "Si" },
  @{ rf = "RF-052"; title = "Validacion de evidencias"; scope = "Si" },
  @{ rf = "RF-053"; title = "Registrar incidencia"; scope = "Si" },
  @{ rf = "RF-054"; title = "Adjuntar fotografias"; scope = "Si" },
  @{ rf = "RF-055"; title = "Clasificacion"; scope = "Limitado" },
  @{ rf = "RF-056"; title = "Seguimiento"; scope = "Consulta" },
  @{ rf = "RF-057"; title = "Notificaciones push"; scope = "Si" },
  @{ rf = "RF-058"; title = "Correos electronicos"; scope = "Recibe" },
  @{ rf = "RF-059"; title = "Cambios de estado"; scope = "Si" },
  @{ rf = "RF-060"; title = "Alertas operativas"; scope = "Limitado" }
)

foreach ($issue in $issues) {
  $body = @"
## Requerimiento

Implementar el requisito funcional indicado para $platform.

## Alcance

- Repositorio: $repo
- Plataforma: $platform
- RF: $($issue.rf)
- Funcionalidad: $($issue.title)
- Nivel requerido: $($issue.scope)

## Criterios de aceptacion

- La funcionalidad queda disponible segun el alcance definido para Mobile Conductor.
- Se integra con los endpoints de Backend/API existentes cuando aplique.
- Se validan estados de carga, error y exito en la app.
- Se respetan restricciones de conductor y alcance limitado cuando aplique.
"@

  gh issue create --repo $repo --title "$($issue.rf) - $($issue.title)" --body $body
}
