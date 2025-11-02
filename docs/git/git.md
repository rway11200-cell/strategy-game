# 🧠 Guía Básica de Git y GitHub para Trabajar en Equipo

Esta guía está pensada para aprender a usar **Git** de forma práctica, con los comandos más usados para trabajar en proyectos colaborativos.

---

## 🧩 ¿Qué es Git?

Git es un sistema de control de versiones que te permite **guardar cambios**, **trabajar con otros** y **mantener un historial** de todo lo que haces en tu código o archivos.

**GitHub** es una plataforma en línea donde puedes **guardar tus proyectos Git** para trabajar desde cualquier lugar y colaborar con otras personas.

---

## ⚙️ Comandos esenciales

A continuación verás los comandos más comunes y su explicación.

---

### 🔍 1. Ver el estado de tu área de trabajo

```bash
git status
```

Este comando muestra qué archivos han sido modificados, cuáles están listos para subir y en qué rama estás trabajando.

---

### ➕ 2. Seleccionar archivos para subir

```bash
git add <ruta/del/archivo>
```

O si quieres agregar **todos los cambios:**

```bash
git add .
```

El **punto** (`.`) significa “todos los archivos modificados”.

---

### 💬 3. Crear un commit (guardar cambios con mensaje)

```bash
git commit -m "Descripción breve del cambio"
```

Ejemplo:

```bash
git commit -m "Corrige error en el formulario de registro"
```

Un _commit_ representa un “paquete de cambios” con una descripción.

---

### 🌍 4. Traer los últimos cambios del repositorio remoto

Antes de subir tus cambios, asegúrate de tener la última versión del proyecto:

```bash
git pull
```

Esto descarga los cambios del repositorio remoto (por ejemplo, de GitHub) a tu computadora.

---

### 🚀 5. Subir tus cambios a GitHub

```bash
git push
```

Si aparece un mensaje como este:

```
fatal: The current branch nombre-de-la-rama has no upstream branch.
To push the current branch and set the remote as upstream, use:
  git push --set-upstream origin nombre-de-la-rama
```

Ejecuta el comando sugerido, por ejemplo:

```bash
git push --set-upstream origin mi-rama
```

Esto configura tu rama local con su equivalente en GitHub.

---

## 🌿 Trabajo con ramas (branches)

Las ramas son versiones paralelas del proyecto. Sirven para trabajar en nuevas funciones sin afectar la rama principal (`main`).

---

### 🆕 Crear una nueva rama

```bash
git checkout -b nombre-de-la-rama
```

Ejemplo:

```bash
git checkout -b feature/pagina-contacto
```

Esto crea una rama nueva y te cambia a ella.

---

### 🔄 Cambiar de rama

```bash
git checkout main
```

O para moverte a otra rama:

```bash
git checkout nombre-de-la-rama
```

---

### 🔄 Cambiar de rama a una rama remota

```bash
git checkout -t origin/nombre-de-la-rama
```

---

### 🧹 Ver todas las ramas

```bash
git branch
```

El asterisco `*` indica la rama en la que estás trabajando.

---

## 🔁 6. Combinar ramas (merge)

Cuando terminas una tarea en tu rama, puedes **fusionarla** con la rama principal:

1. Cambia a la rama `main`:

   ```bash
   git checkout main
   ```

2. Trae los últimos cambios del remoto:

   ```bash
   git pull
   ```

3. Fusiona tu rama:

   ```bash
   git merge nombre-de-la-rama
   ```

4. Sube los cambios a GitHub:

   ```bash
   git push
   ```

---

## 🧽 7. Deshacer o corregir errores

Si agregaste algo por error antes del commit:

```bash
git restore --staged <archivo>
```

Si ya hiciste el commit pero no lo subiste aún:

```bash
git commit --amend
```

Para volver atrás a un punto anterior (con cuidado):

```bash
git reset --hard <id_del_commit>
```

Puedes ver los IDs de commit con:

```bash
git log
```

Guardar provisoriamente los cambioss en una pila interna

```bash
git stash
```

Recuperar lo guardado en `git stash`

```bash
git stash pop
```

---

## 📦 8. Clonar un repositorio

Cuando quieras trabajar con un proyecto de GitHub en tu equipo local:

```bash
git clone https://github.com/usuario/nombre-del-repo.git
```

Esto descarga el proyecto completo y crea una carpeta con el código.

---

## 🧭 Flujo de trabajo recomendado (día a día)

1. **Clona** el repositorio si es tu primera vez.
2. **Crea una nueva rama** para tu tarea:

   ```bash
   git checkout -b nombre-de-la-rama
   ```

3. **Haz tus cambios** en los archivos.
4. **Revisa el estado:**

   ```bash
   git status
   ```

5. **Agrega los archivos modificados:**

   ```bash
   git add .
   ```

6. **Crea un commit con descripción:**

   ```bash
   git commit -m "Descripción del cambio"
   ```

7. **Actualiza tu rama local con los últimos cambios:**

   ```bash
   git pull
   ```

8. **Sube tus cambios a GitHub:**

   ```bash
   git push
   ```

9. En GitHub, crea un **Pull Request (PR)** para que tus compañeros revisen y fusionen tus cambios con la rama principal.

---

## 💡 Consejos para trabajar en equipo

- 🕐 **Haz `git pull` antes de comenzar a trabajar** para evitar conflictos.
- 🌱 **Usa ramas separadas** para cada tarea o función nueva.
- ✍️ **Escribe mensajes de commit claros y breves.**
- 🚫 **No subas archivos innecesarios** (como `node_modules` o temporales).
- 🔎 **Revisa los cambios antes de subirlos:**

  ```bash
  git diff
  ```

- 📄 Crea un archivo `.gitignore` para definir qué archivos no deben subirse.

---

## ⚙️ Archivo `.gitignore` (ejemplo)

```bash
# Dependencias
node_modules/

# Archivos temporales
*.log
*.tmp

# Configuración del sistema
.DS_Store

# Archivos de entorno
.env
```

---

## 🔧 Comandos útiles adicionales

Ver historial de commits:

```bash
git log --oneline --graph --decorate --all
```

Ver diferencias entre commits:

```bash
git diff
```

Ver el repositorio remoto asociado:

```bash
git remote -v
```

Eliminar una rama local:

```bash
git branch -d nombre-de-la-rama
```

Eliminar una rama remota:

```bash
git push origin --delete nombre-de-la-rama
```

---

## 🧠 Glosario rápido

| Término                | Significado                             |
| ---------------------- | --------------------------------------- |
| **Repositorio (repo)** | Carpeta del proyecto controlada por Git |
| **Commit**             | Registro de cambios con descripción     |
| **Rama (branch)**      | Línea paralela de desarrollo            |
| **Merge**              | Combinar ramas                          |
| **Push**               | Subir cambios al repositorio remoto     |
| **Pull**               | Descargar cambios del remoto            |
| **Clone**              | Copiar un proyecto remoto a tu PC       |
| **Pull Request (PR)**  | Solicitud para fusionar ramas en GitHub |

---

## 📘 Recursos útiles

- [📖 Guía oficial de Git](https://git-scm.com/doc)
- [💻 Tutorial de GitHub](https://docs.github.com/es/get-started/quickstart)
- [🌿 Simulador interactivo de Git](https://learngitbranching.js.org/?locale=es_ES)
