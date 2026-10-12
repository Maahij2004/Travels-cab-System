# Travels Cab – Separate Development Portals

The frontend now runs as four separate Vite development hosts while sharing the same React source and backend API.

| Portal | URL | Vite mode | Purpose |
|---|---|---|---|
| Portal selector | http://localhost:5173 | portal | Choose Customer / Driver / Admin |
| Customer | http://localhost:5175 | customer | Customer login, registration and booking |
| Driver | http://localhost:5177 | driver | Driver login and assigned-trip operations |
| Admin | http://localhost:5179 | admin | Admin/Super Admin control center |
| Backend | http://localhost:5000 | Express | Shared API |

## Start separately

From `client`:

```powershell
npm.cmd install
npm.cmd run dev:portal
npm.cmd run dev:customer
npm.cmd run dev:driver
npm.cmd run dev:admin
```

Run the four commands in four terminals.

## Start all four on Windows

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\start-all.ps1
```

## Portal rules

- `5173` is the role selector only.
- `5175` accepts customer accounts only.
- `5177` accepts driver accounts only.
- `5179` accepts admin and superadmin accounts only.
- A customer cannot use the driver/admin portal to reach a dashboard.
- Driver and Admin do not get customer self-registration.
- All portals use the same backend at `http://localhost:5000/api`.

## Production

These development ports can later become separate subdomains such as:

- `customer.yourdomain.com`
- `driver.yourdomain.com`
- `admin.yourdomain.com`

The role selector can then link to those production URLs through the Vite environment variables.
