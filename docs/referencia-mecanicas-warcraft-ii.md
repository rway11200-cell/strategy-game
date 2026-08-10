# Warcraft II — Mecánicas de Tropas de Referencia

Extraído del código fuente de [DevCrumbs/Warcraft-II](https://github.com/DevCrumbs/Warcraft-II) (remake SDL/C++).

---

## Arquitectura de Comportamiento (GOAP Jerárquico)

Cada unidad (`DynamicEntity`) tiene un `brain` (`Goal_Think`) que orquesta una jerarquía de sub-objetivos.

### Jerarquía de Goals

```
Goal_Think (Composite)
├── Goal_AttackTarget (Composite)
│   ├── Goal_MoveToPosition (Atomic) — acercarse hasta que isAttackSatisfied
│   └── Goal_HitTarget (Atomic)      — animación de ataque + aplicar daño
├── Goal_Patrol (Composite)
│   ├── Goal_LookAround (Atomic)     — opcional
│   └── Goal_MoveToPosition (Atomic) — alterna origin ↔ destination en bucle
├── Goal_Wander (Composite)
│   ├── Goal_LookAround (Atomic)
│   └── Goal_MoveToPosition (Atomic) — destino aleatorio dentro de maxDistance
├── Goal_GatherGold (Composite)
│   ├── Goal_MoveToPosition (Atomic) — moverse a tile adyacente de la mina
│   └── Goal_PickNugget (Atomic)     — oro progresivo, peón invisible
├── Goal_HealRunestone (Composite)
│   ├── Goal_MoveToPosition (Atomic)
│   └── Goal_HealArea (Atomic)       — cura en área, partículas
└── Goal_RescuePrisoner (Composite)
    ├── Goal_MoveToPosition (Atomic)
    └── Goal_FreePrisoner (Atomic)
```

### Ciclo de vida de un Goal

```
Inactive → Activate() → Active → Process(dt) cada frame → Completed / Failed → Terminate()
```

`ProcessSubgoals()` limpia goals completados/fallados del frente de la lista y procesa el siguiente. Si la lista queda vacía retorna `Completed`.

---

## Detección de Enemigos por Colisión

- Dos radios concéntricos en forma de **rombo** (BFS desde el tile actual, solo tiles walkable):
  - `sightRadius` — detección de presencia (`DistanceManhattan`)
  - `attackRadius` — rango de ataque efectivo (`DistanceTo`)
- **OnEnter**: crea/actualiza `TargetInfo { isSightSatisfied, isAttackSatisfied }`
- **OnExit**: marca `isRemoveNeeded`, los goals activos terminan limpiamente antes de eliminar
- Los colliders se actualizan solo cuando cambia el tile (`lastColliderUpdateTile`)

### Priorización de Targets

```
1. Menor DistanceManhattan(pos, targetPos)
2. Menor cantidad de unidades atacando ese target (para distribuir daño)
```

Filtros disponibles: `EntityCategory`, `EntityType`, `isCrittersCheck`, `isOnlyCritters`.

---

## Sistema de Daño (Counters)

Cada unidad define 4 tipos de daño en `UnitInfo`:

| Tipo de daño | Efectivo contra | Unidades que lo infligen |
|---|---|---|
| `heavyDamage` | Footman, Grunt | Unidades melee |
| `lightDamage` | ElvenArcher, TrollAxethrower | Unidades ranged |
| `airDamage` | GryphonRider, Dragon | Anti-aéreas |
| `towerDamage` | Edificios (`StaticEntity`) | Unidades de asedio |

### Daño contra Critters

- Sheep: `maxLife / 3` por golpe
- Boar: `maxLife / 4` por golpe

Al matar un critter, la unidad recupera vida (`restoredHealth`).

---

## Flujo de Combate

### Ataque Melee (Footman, Grunt)

1. `Goal_AttackTarget` se activa → `Goal_MoveToPosition` hacia el target
2. Cuando `DistanceManhattan(currTile, targetTile) <= 1` → `isAttackSatisfied = true`
3. `Goal_HitTarget` toma el control: orienta la unidad hacia el target
4. Reproduce animación de ataque
5. Al terminar la animación (`animation->Finished()`):
   - **Si target es edificio en construcción** → ignora el daño
   - **Si target es edificio completo** → `target->ApplyDamage(owner->GetDamage(target))`
   - **Si target es unidad** → `target->ApplyDamage(owner->GetDamage(target))`
6. Reinicia la animación (`animation->Reset()`) → loop de ataque

### Ataque a Distancia (Archer, Axethrower, GryphonRider, Dragon)

Igual que melee excepto en el paso 5: en vez de daño directo, dispara un **proyectil** (particle) con velocidad, daño y dirección. 8 direcciones de disparo mapeadas individualmente.

### Ataque a Edificios

1. Busca un tile libre en el perímetro del edificio (8 tiles alrededor)
2. Si todos están ocupados → `FindClosestValidTile` desde el tile más cercano del edificio
3. Se orienta hacia el `attackingTile` más cercano del edificio

### Persecución

Las unidades enemigas persiguen al jugador por **6 segundos** (`chaseTime`).

---

## State Machine

| Estado | Comportamiento |
|---|---|
| `Idle` | Sin goals → `LookAround` (cambia dirección c/1-3s). Auto-ataca cualquier `DYNAMIC_ENTITY` en `targets` |
| `Walk` | Defensa: si `unitsAttacking > 0` y no está huyendo → contraataca al atacante |
| `Patrol` | Igual que Idle + movimiento en bucle entre 2 tiles |
| `AttackTarget` | Si `currTarget` muere → automáticamente busca el siguiente en `targets` |
| `Die` | Reproduce animación de muerte → cadáver 3s → `isRemove` |

### Auto-ataque en Idle/Patrol

La unidad ataca automáticamente unidades enemigas (`DYNAMIC_ENTITY`) que entran en su `sightRadius`, siempre que estén en la misma room.

---

## IA Enemiga (Grunt) — Toma de Decisiones

Cuando una unidad enemiga no tiene goals activos, evalúa en orden:

### 1. Supervivencia (vida ≤ 20%)

- Busca critters (Sheep/Boar) en `targets` para matarlos y curarse
- Si no encuentra critters → wander rápido (0-1s entre cambios) para huir

### 2. Defensa (contraataque)

Si `unitsAttacking > 0`:
- **Fase 1**: `GetBestTargetInfo(DYNAMIC_ENTITY)` — si el mejor target es un atacante, lo ataca
- **Fase 2**: Escanea toda la lista `targets` buscando explícitamente un atacante
- **Fase 3** (solo fuera de base): añade un atacante como target aunque no esté en sight radius, para iniciar búsqueda

### 3. Caza

Busca `GetBestTargetInfo(DYNAMIC_ENTITY)` — cualquier unidad enemiga en `targets`.

### 4. Asedio (solo en base)

Si está en la base y no hay unidades dinámicas, ataca `STATIC_ENTITY` (edificios).

### Sin nada que hacer

- **En base**: ataca el `TownHall` del jugador
- **Fuera de base**: inicia `Wander` de 6 tiles de radio desde el spawn

### Restricción de Movimiento

Los enemigos solo calculan pathfinding dentro de su misma `Room`. Si el destino está en otra room, el goal falla.

---

## Comandos del Jugador

| Comando | Efecto |
|---|---|
| `Stop` | Limpia todos los goals → `Idle` |
| `MoveToPosition` | Si `isGoalChanged` + `IsFittingTile()` → `Goal_MoveToPosition`. Si estaba atacando, se desengancha del target |
| `AttackTarget` | `Goal_AttackTarget` hacia `newTarget` |
| `Patrol` | `Goal_Patrol` con bucle infinito entre `currTile` ↔ `goal` |
| `GatherGold` | `Goal_GatherGold` hacia GoldMine (peón invisible mientras recolecta) |
| `HealRunestone` | `Goal_HealRunestone` (cura en área) |
| `RescuePrisoner` | `Goal_RescuePrisoner` (libera Alleria/Turalyon) |

---

## Sistema de Animaciones

Cada unidad tiene **8 direcciones × 3 tipos = 24 animaciones**:

| Dirección | Walk | Attack | Death |
|---|---|---|---|
| Up | ✓ | ✓ | ✓ |
| Down | ✓ | ✓ | ✓ |
| Left | ✓ | ✓ | — |
| Right | ✓ | ✓ | — |
| UpLeft | ✓ | ✓ | — |
| UpRight | ✓ | ✓ | — |
| DownLeft | ✓ | ✓ | — |
| DownRight | ✓ | ✓ | — |

- **Walk**: loop infinito si `isStill = false`. Si `isStill = true` → `Reset()`, speed = 0, loop = false
- **Attack**: se orienta hacia el target antes de cada ciclo. Reproduce una vez, luego `Reset()`
- **Death**: solo 2 variantes (Up/Down). Las direcciones laterales usan Up

Orientación: `(targetPos - pos) / magnitude` recalculada cada frame de ataque.

---

## Muerte y Despawn

```
currLife <= 0 + IsFittingTile() + !isDead
  → Invalida: movimiento, colliders, pathfinding, selección
  → Reproduce animación de muerte
  → deadTimer inicia
  → Cadáver se dibuja en capa FloorColliders (debajo de vivas)
  → A los 3s: isRemove = true → el factory lo elimina
```

### Recompensas por Eliminación

- **Grunt**: dropea `droppedGold`, contador `enemiesKill++`
- **Room completa**: si room queda sin enemigos → reward (300g chica, 800g grande)
- **Wave derrotada**: si es la base y no quedan enemigos → 500g

---

## Recolección de Recursos

### GoldMine

- Gold: 1400-2500 aleatorio (varía por dificultad)
- Tiempo: 10-20s
- El gold se entrega progresivamente cada 100ms
- El peón se oculta (`SetBlitState(false)`) y su lifebar desaparece
- La mina cambia sprites periódicamente (animación de recolección)
- Solo una unidad puede recolectar de una mina a la vez

### Runestone (Curación)

- Similar a GoldMine pero cura en área
- Partículas verdes para jugador, rojas para enemigo
- Solo una unidad puede interactuar a la vez

---

## Constantes Clave

| Constante | Valor |
|---|---|
| `TIME_REMOVE_CORPSE` | 3.0s |
| `chaseTime` (persecución enemiga) | 6.0s |
| `timeForEachGoldUpdate` (entrega oro) | 100ms |
| Wander `maxDistance` | 6 tiles |
| LookAround `minSecondsToChange` | 1s |
| LookAround `maxSecondsToChange` | 3s |
| Recompensa room pequeña | 300 gold |
| Recompensa room grande | 800 gold |
| Recompensa wave derrotada | 500 gold |
| Prioridad base de unidad | 1 |

---

## Patrones de Diseño Reutilizables

1. **GOAP ligero**: jerarquía de goals composite/atomic con `Activate → Process → Terminate`
2. **Detección por colisión**: radios tipo rombo con BFS tile-based en vez de checks por distancia cada frame
3. **Sistema de daño con counters**: 4 tipos de daño con efectividad por tipo de unidad
4. **Priorización de targets**: distancia + distribución de atacantes (evita overkill)
5. **State machine con auto-ataque**: Idle/Patrol atacan automáticamente sin input del jugador
6. **IA enemiga con prioridades en cascada**: sobrevivir > defender > cazar > asediar
7. **Proyectiles como partículas**: ranged attacks disparan particles con daño, melee es directo
8. **Ocupación de tiles**: solo una unidad por tile, `IsFittingTile()` antes de transiciones
9. **Restricción por rooms**: pathfinding limitado a la room actual para enemigos
10. **Muerte asíncrona**: animación + timer de cadáver antes de liberar el tile
