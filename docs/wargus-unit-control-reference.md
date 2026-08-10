# Wargus (Stratagus Engine) — Unit Control & Behavior Reference

> Source: https://github.com/Wargus/wargus + https://github.com/Wargus/stratagus
> Engine: C++ (core) + Lua (game scripts)

---

## 1. Architecture: Two-Layer Design

| Layer | Location | Language | Purpose |
|-------|----------|----------|---------|
| **Stratagus Engine** | `stratagus/src/` | C++ | Pathfinding, actions, commands, targeting, rendering |
| **Wargus Scripts** | `wargus/scripts/` | Lua | Unit definitions, AI helpers, keyboard shortcuts, spells |

Wargus defines *what* a unit is; Stratagus defines *how* it behaves.

---

## 2. Command → Order → Action Pipeline

```
Player Input / AI
       ↓
  command.cpp        CommandMove, CommandAttack, CommandStop...
       ↓
  actions.cpp        CclParseOrder() → creates COrder subclass
       ↓
  CUnit::Orders[]    FIFO queue (up to 127 orders)
       ↓
  HandleUnitAction() Called every game cycle on Orders[0]
       ↓
  COrder::Execute()  State machine in each action_*.cpp
       ↓
  Finished = true    → pop queue, execute next order
```

Key types from `unit.h`:
```cpp
std::vector<std::unique_ptr<COrder>> Orders;   // FIFO order queue
std::unique_ptr<COrder> SavedOrder;            // restore after current
std::unique_ptr<COrder> NewOrder;              // for newly trained units
std::unique_ptr<COrder> CriticalOrder;         // immediate (e.g. transform)
```

---

## 3. Order Types (COrder Subclasses)

| Order | File | Core Behavior |
|-------|------|---------------|
| `Still` | `action_still.cpp` | Idle; auto-attacks enemies in react range |
| `StandGround` | (Still variant) | Hold position; attacks only in attack range |
| `Move` | `action_move.cpp` | Pathfind + sub-tile pixel movement to target |
| `Attack` | `action_attack.cpp` | Attack unit/position with auto-targeting state machine |
| `AttackGround` | `action_attack.cpp` | Attack ground tile (siege weapons) |
| `Patrol` | `action_patrol.cpp` | Cycle between two points |
| `Follow` | `action_follow.cpp` | Follow another unit |
| `Defend` | `action_defend.cpp` | Follow + protect a unit |
| `Build` | `action_build.cpp` | Construct building |
| `Repair` | `action_repair.cpp` | Repair allied unit/building |
| `Resource` | `action_resource.cpp` | Harvest resources |
| `Board/Unload` | `action_board/unload.cpp` | Enter/exit transport |
| `Train/Research/UpgradeTo` | respective `.cpp` | Production queue |
| `SpellCast` | `action_spellcast.cpp` | Cast a spell |
| `Die` | `action_die.cpp` | Death animation + cleanup |

---

## 4. Movement System (`action_move.cpp`)

### Core Loop: `DoActionMove(CUnit &unit)`

1. **Get next path step**: `NextPathElement(unit)` from the A\* pathfinder
2. **Pathfinder return codes**:
   - `PF_UNREACHABLE` (-2): can't reach → notify AI (`AiCanNotMove`)
   - `PF_REACHED` (-1): reached destination → order finished
   - `PF_WAIT` (0): no path yet → wait 10 cycles
   - `>0`: valid step → proceed with movement

3. **Sub-tile pixel displacement**: `unit.IX`, `unit.IY` (signed char, -32..32 range)
   - Movement is tile-aligned in the path but pixel-smooth visually
   - `unit.IX += posd.x * move` advances toward the next tile

4. **Per-frame**: animate (`UnitShowAnimationScaled`), update heading, update map position via `MoveToXY()`

5. **Blocker detection**: if `PF_WAIT` and a unit occupies the destination tile, and it's an enemy or stationary → order finishes instead of waiting forever

### Pathfinder Integration

Each order overrides `UpdatePathFinderData(PathFinderInput &input)`:
- `SetGoal(pos, tileSize)` — where to go
- `SetMaxRange(distance)` — max path distance
- `SetMinRange(minDist)` — minimum approach distance (for ranged units)
- Obstacle checking via `CheckObstaclesBetweenTiles()` (forest, rocks)

---

## 5. Pathfinding (`src/pathfinder/`)

- **`astar.cpp`**: Standard A\* on a tile grid
- **`pathfinder.cpp`**: Wraps A\*, manages per-unit `PathFinderData` (input/output)
- **Movement masks**: `MapFieldLandUnit | MapFieldAirUnit | MapFieldSeaUnit`

---

## 6. Attack System (`action_attack.cpp`)

### State Machine

```
FIRST_ENTRY
    ↓
AUTO_TARGETING ←──────────┐ (search for enemies)
    ↓                      │
MOVE_TO_TARGET ────────────┤ (move into range)
    ↓                      │
ATTACK_TARGET ─────────────┘ (attack animation + fire missile)
    ↓ (target too close, has MinAttackRange)
MOVE_TO_ATTACKPOS (retreat to minimum range)
```

### Auto-Targeting (`AutoSelectTarget`)

- **Mobile units**: search enemies in **react range** (`AttackUnitsInReactRange`)
- **Immobile units** (buildings, stand-ground): search only in **attack range** (`AttackUnitsInRange`)
- **Target switching**: controlled by `ThreatCalculate()` or `TargetPriorityCalculate()`
- **`Threshold`** (counter): prevents rapid target switching
- **`UnderAttack`** (counter): while >0, ignores non-aggressive targets

### Best Target Selection (`unit_find.cpp` — `BestTargetFinder`)

Cost formula for selecting the best target:
1. **Priority** (unit type stat, 0-255) — higher = preferred target
2. **Remaining HP** (0-65535) — lower HP = preferred
3. **Distance** to target (in range bonus, out-of-range penalty)
4. **AI Priority flags** (per BoolFlag, e.g. "prefer buildings", "avoid air")
5. **Counter-attack threat** (can the target fight back?)

### Splash / Friendly Fire (`BestRangeTargetFinder`)

For siege weapons (catapults, etc.) with `Missile.Range > 1`:
- Builds a "good" map (allies that would take damage) and "bad" map (enemies)
- Splash factor from `Missile.SplashFactor`
- `NOFRIENDLYFIRE_INDEX` flag: avoid targets near allies entirely

### Skirmish Behavior

`SKIRMISHER_INDEX` flag: unit maintains `MinAttackRange` distance from target.
If target gets too close → `MoveToBetterPos()` retreats to a random position at min range.

---

## 7. Command API (`command.cpp`)

All commands take `(CUnit &unit, ..., EFlushMode flush)`:
- `EFlushMode::On` — clear order queue, new order becomes immediate
- `EFlushMode::Off` — append to existing queue

| Command | Signature pattern |
|---------|-------------------|
| `CommandMove` | unit + tilePos |
| `CommandAttack` | unit + tilePos + optional targetUnit |
| `CommandAttackGround` | unit + tilePos |
| `CommandStopUnit` | unit only (flush + Still) |
| `CommandStandGround` | unit + flush |
| `CommandPatrolUnit` | unit + tilePos |
| `CommandFollow` / `CommandDefend` | unit + targetUnit |
| `CommandBuildBuilding` | unit + tilePos + unitType |
| `CommandRepair` | unit + tilePos + optional targetUnit |
| `CommandResource` / `CommandResourceLoc` | unit + targetUnit or tilePos |
| `CommandBoard` / `CommandUnload` | unit + transporter or tilePos |
| `CommandSpellCast` | unit + tilePos + optional targetUnit + spellType |
| `CommandTrainUnit` / `CommandResearch` | unit + unitType or upgrade |
| `CommandExplore` | unit only |
| `CommandDismiss` | unit (cancel build or suicide) |

---

## 8. Autonomous Unit Behavior (Small AI)

### Still/StandGround Orders

- `COrder_Still::Execute()`: auto-attacks via `AttackUnitsInReactRange()`
- **Auto-cast spells**: checks `AutoCastSpell[]` array (per-spell toggle)
- **Auto-repair**: `AutoRepair` flag, repairs damaged allies nearby
- **`COrder_Defend`**: follows and attacks threats to the guarded unit

### State Counters

| Variable | Purpose |
|----------|---------|
| `Wait` | Generic action delay counter (decremented each cycle) |
| `Threshold` | Prevents target switching (<30 cycles between changes) |
| `UnderAttack` | Set when hit; temporarily ignores non-aggressive targets |
| `Blink` | Visual blink on selection box |
| `TTL` | Time-to-live (summoned units die when this expires) |

---

## 9. Unit Lifecycle

```
MakeUnit(type, player)
  → Init()         default values
  → Place(pos)     assign tile, update map/vision
  → AssignToPlayer register in player's unit list
  → Orders[0] = COrder_Still

... game ticks: HandleUnitAction() every cycle ...

LetUnitDie(unit, suicide?)
  → Orders.clear()
  → Orders[0] = COrder_Die
  → play death animation
  → Remove()          unmark sight, remove from map, groups, selection
  → Release()         recycle after Refs == 0
```

### Important Unit Flags

| Flag | Meaning |
|------|---------|
| `Removed` | Not on map (in transport, dead, never placed) |
| `Destroyed` | Pending release, should not be interacted with |
| `Moving` | 0=idle, 1=moving, 2-3=unbreakable animation states |
| `Selected` | Currently in player's selection set |
| `Constructed` | Building is still being built |
| `Boarded` | Inside a transporter |
| `Active` | Enabled for AI management |
| `Unbreakable` | Current animation must finish before next action |

---

## 10. Key Data Structures

### CUnit (`unit.h`)
```cpp
Vec2i tilePos;              // grid tile position
signed char IX, IY;         // sub-tile pixel offset (-32..32)
unsigned char Direction;    // heading (0-255, 8 directions)
int Wait;                   // generic delay counter
int Threshold;              // target-switch cooldown
int UnderAttack;            // "under attack" counter
unsigned Moving : 2;        // movement state
unsigned Removed : 1;       // not on map
unsigned Destroyed : 1;     // pending release
unsigned Selected : 1;      // in player selection
std::vector<CVariable> Variable;  // HP, mana, buffs, etc.
```

### Variable Indices (buffs and stats)
`HP_INDEX`, `BLOODLUST_INDEX`, `HASTE_INDEX`, `SLOW_INDEX`, `INVISIBLE_INDEX`, `UNHOLYARMOR_INDEX`, `POISON_INDEX`

### UnitType BoolFlags (behavior modifiers)
- `CANATTACK_INDEX` — can attack
- `COWARD_INDEX` — won't auto-attack
- `HARVESTER_INDEX` — worker/gatherer
- `CANHARVEST_INDEX` — resource node
- `SKIRMISHER_INDEX` — maintains minimum range from target
- `NOFRIENDLYFIRE_INDEX` — won't attack near allies
- `INDESTRUCTIBLE_INDEX` — cannot be damaged
- `SURROUND_ATTACK_INDEX` — can attack without turning
- `ATTACKFROMTRANSPORTER_INDEX` — can fire from inside transport
- `VISIBLEUNDERFOG_INDEX` — visible even under fog of war

---

## 11. Game Loop Integration

```
UnitActions()                // actions.cpp
  if (isSecondCycle)
    UnitActionsEachSecond()   // decay buffs, burn/poison, TTL
  UnitActionsEachCycle()
    for each unit:
      HandleBuffsEachCycle()  // spell cooldowns, buff timers
      HandleUnitAction()      // execute current order
      SyncHash ^= (action_type << 18) | (refs << 3)  // network sync
```

---

## 12. Lua AI Interface (`ai.lua` in Wargus)

- `AiCityCenter(race)`, `AiSoldier(race)`, etc. → resolve unit type IDs by race
- `AiForce(num, units)` → define attack wave composition
- `AiSleep(cycles)` → delay AI processing
- `AiLoop(funcs[], indexes[])` → state-based AI loop per player
- `AiSpeed(build, train, upgrade, research)` → difficulty-based speed multiplier
- `AiCheat(gold, wood, oil)` → resource injection for harder difficulties

---

## 13. Design Patterns Worth Borrowing

1. **Command → Order queue with FIFO + flush modes**: clean separation of player intent from execution state
2. **Per-order `UpdatePathFinderData()` override**: each action tells the pathfinder its own goal/maxRange/minRange
3. **Sub-tile pixel displacement** (`IX`/`IY`): tile-aligned pathfinding but smooth pixel movement
4. **Attack state machine** (auto-targeting → move → attack → retreat): handles ranged kiting, target switching, min-range skirmishing
5. **Cost-based target selection**: priority (unit stat), HP, distance, threat, AI flags — all in one weighted function
6. **Unbreakable animation flag**: prevents action interruption during critical animation frames
7. **Threshold + UnderAttack counters**: prevents AI oscillation without complex hysteresis logic
8. **Auto-cast spell array per unit**: simple per-spell boolean toggles for autonomous spellcasting
