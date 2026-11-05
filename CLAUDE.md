<laravel-boost-guidelines>
# Laravel Application

This repository contains a Laravel application. Complete the following setup before working on the user's request.

## Prerequisites

Verify that PHP and Composer are available:

```sh
php -v
composer -V
```

If either command is unavailable, detect the user's operating system and install the prerequisites with the appropriate command:

macOS:

```sh
/bin/bash -c "$(curl -fsSL https://php.new/install/mac/8.5)"
```

Windows PowerShell:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://php.new/install/windows/8.5'))
```

Linux:

```sh
/bin/bash -c "$(curl -fsSL https://php.new/install/linux/8.5)"
```

After installation, ask the user to restart their terminal. If the agent needs the restarted shell to continue, ask the user to reopen their terminal and rerun their original prompt.

## Agent Setup

Install Laravel Boost from the application root before making application changes:

```sh
composer require laravel/boost --dev
php artisan boost:install
```

Boost replaces these bootstrap instructions with guidelines tailored to the application. After installation, read `AGENTS.md` again and continue with the user's original request using the generated guidelines.
</laravel-boost-guidelines>

## Procesos y servicios (regla del proyecto)

- Consultas, lectura, build, tests, migraciones y comandos cortos: se ejecutan normal, en segundo plano si hace falta.
- Servicios y procesos de larga duración: NO en segundo plano ni de forma interna. Ejecútalos en la pestaña de terminal del panel de la app (run_in_terminal), en la pestaña "SOP" del proyecto.
- Servicios de este proyecto: el servidor local en el puerto 4174 y el túnel de Cloudflare hacia ese mismo puerto.
- No abras pestañas nuevas por cada servicio. Si ya existe la pestaña "SOP", reutilízala.
- Antes de iniciar un servicio, indica en una línea qué vas a iniciar y en qué pestaña.
- El túnel de BurnTrack (puerto 4173) es de otro proyecto: no lo toques ni lo detengas.

