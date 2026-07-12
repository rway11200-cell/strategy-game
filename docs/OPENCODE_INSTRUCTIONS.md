# OpenCode Coding Guidelines

Sigue estas reglas en CADA tarea que realices. Son obligatorias.

## Claridad > Cleverness

- El código debe ser **entendible por un humano primero**. Optimizar después si es necesario.
- Nombres descriptivos siempre: `enemyCount` no `ec`, `calculateDamage` no `calcDmg`, `spawnWave` no `sw`
- Funciones cortas (máximo ~30 líneas). Si una función hace varias cosas, divídela.
- No uses abreviaturas crípticas ni one-liners complejos.

## Comentarios

- Comenta el **"por qué"**, no el **"qué"**. El código debe explicar el qué por sí mismo.
- Usa JSDoc/docstring en funciones públicas o no obvias.
- Nada de comentarios obvios como `// incrementa el contador`.

## Funciones complejas

- Si una lógica es compleja, **enciérrala en una función con nombre descriptivo**.
- Extra: `if (esAtaqueCritico())` en vez de `if (damage > baseDamage * 2 && random() < 0.3)`.
- Las condiciones complejas merecen una función nombrada.

## Tests

- Si modificas comportamiento existente, asegúrate de que los tests existentes pasen.
- Si agregas funcionalidad nueva, crea tests.
- Si el proyecto no tiene tests para el área que tocas, al menos verifica que build/lint pasen.

## Documentación

- Si creas un módulo nuevo o una función pública significativa, agrega JSDoc.
- Si ves que falta documentación en algo que tocaste, agrégala.
- No crees documentos separados a menos que la tarea lo pida explícitamente.

## Antes de empezar

- Verifica que no haya cambios sin commit en el repo. Si los hay, DETENTE y reporta.
- No modifiques dependencias, configs de build, ni CI a menos que la tarea lo indique.
