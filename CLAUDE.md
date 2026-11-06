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

> **REGLA PRINCIPAL:** todos los servicios van en UNA sola ventana de Windows Terminal ("servicios"), una pestaña por servicio. Nunca abras ventanas nuevas ni pestañas repetidas. Antes de lanzar, revisa si el servicio ya funciona (puerto en escucha, `/ready` del túnel); si ya funciona, no lances otro. Si un intento falla, no reintentes a ciegas: diagnostica, cierra lo fallido y avisa. Al terminar deben quedar solo las pestañas que funcionan.
>
> La ventana "servicios" tiene exactamente **4 pestañas**, todas funcionando: "SOP servidor" (4174), "SOP túnel", "BurnTrack Laravel" (4173) y "BurnTrack Tunel". Si falta una, se relanza una sola vez; si sobra o falló, se cierra.
>
> La ventana "servicios" corre como Administrador. Una sesión de Claude sin elevar no puede unirse a ella ni cerrarle ventanas: si `wt -w servicios` no crea la pestaña dentro de esa ventana, detente al primer fallo y pide al usuario que la abra él (o que ejecute Claude como administrador).

- Consultas, lectura, build, tests, migraciones y comandos cortos: se ejecutan normal, en segundo plano si hace falta.
- Servicios y procesos de larga duración: NO en segundo plano ni de forma interna. Ábrelos en la ventana unificada de Windows Terminal "servicios", una pestaña por servicio, con PowerShell 7:
  `wt -w servicios new-tab --title "<nombre>" pwsh -NoExit -Command "<comando>"`
- Servicios de este proyecto:
  - Servidor local: `php artisan serve --host=localhost --port=4174` (título "SOP servidor").
  - Túnel: `.\abrir-tunel.ps1` (título "SOP túnel"). El ejecutable está en `%USERPROFILE%\Tools\cloudflared\`, no en el PATH.
- No abras una ventana nueva por servicio: siempre `-w servicios`.
- No uses `;` dentro del comando de `wt`: lo corta como otro subcomando y la pestaña queda vacía. Para entrar a la carpeta usa `-d "C:\Users\Jair Iván\Documents\SOP-Laravel"`.
- Antes de iniciar un servicio, indica en una línea qué vas a iniciar y en qué pestaña.
- El túnel de BurnTrack (puerto 4173) es de otro proyecto: no lo toques ni lo detengas.

