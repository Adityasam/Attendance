<p align="center">
  <img src="static/icons/archlogo144.png" alt="Arch Logo" width="80">
</p>

<h1 align="center">Arch Attendance</h1>

<p align="center">
  Employee attendance management PWA with browser-based face recognition and offline-first architecture.
</p>

---

## Features

- **Face Recognition** — Client-side face detection and matching using face-api.js. No server processing required.
- **Manual Attendance** — Optional mode for environments where face scanning isn't feasible. Sign in/out per project with one tap.
- **Offline-First** — Service Worker + IndexedDB. Mark attendance offline, auto-sync when back online.
- **PWA** — Installable on mobile and desktop. Works like a native app.
- **GPS Tracking** — Capture location coordinates with each attendance scan. Configurable as mandatory.
- **Project-Based** — Assign employees to projects, track attendance per project, auto sign-out on project switch.
- **Export** — Download attendance reports as Excel (.xlsx) or PDF. Daily, date-specific, or monthly.
- **Role-Based Access** — Admin and user roles with per-page access control.
- **Real-Time Dashboard** — Present/absent counts, monthly trends, donut and bar charts.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Flask (Python) |
| Database | SQLite3 |
| Frontend | Vanilla JS, Bootstrap 5, Font Awesome 6 |
| Face Recognition | face-api.js (client-side, self-hosted models) |
| Offline | Service Worker + IndexedDB |
| Charts | Chart.js |
| Maps | MapLibre GL JS + OpenFreeMap |
| Export | openpyxl (Excel), ReportLab (PDF) |

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
python app.py
```

Open [http://localhost:5000](http://localhost:5000)

## Project Structure

```
Attendance/
├── app.py                     # Flask app, blueprint registration, SW route
├── config.py                  # SECRET_KEY, DATABASE path, UPLOAD_FOLDER
├── requirements.txt           # Python dependencies
├── db.sqlite3                 # SQLite database
│
├── routes/
│   ├── auth.py                # Login, logout, session management
│   ├── employees.py           # Employee CRUD + face data API
│   ├── projects.py            # Project CRUD with incharge assignment
│   ├── attendance.py          # Attendance marking, sync, export
│   ├── settings.py            # Users, access control, app settings
│   ├── pages.py               # Page routing
│   └── db_helper.py           # SQLite query/execute helpers
│
├── templates/
│   ├── base.html              # Layout: sidebar, topbar, permission modals
│   ├── login.html             # Login page
│   ├── dashboard.html         # Stats cards, charts, employee list
│   ├── employees.html         # Employee table, face enrollment
│   ├── projects.html          # Project card grid, GPS capture
│   ├── attendance.html        # Employee grid, face scan, manual mode
│   └── settings.html          # Users, access, app config
│
├── static/
│   ├── css/style.css          # Theme and responsive styles
│   ├── js/
│   │   ├── app.js             # Shared utils: toast, permissions, distance calc
│   │   ├── db.js              # IndexedDB wrapper (ArchDB)
│   │   ├── sync.js            # Offline sync module
│   │   └── attendance.js      # Face recognition camera module
│   ├── sw.js                  # Service worker
│   ├── manifest.json          # PWA manifest
│   ├── models/                # face-api.js model weights
│   ├── icons/                 # App icons
│   └── uploads/               # Employee photos
```

## Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/` | Stats cards, attendance charts, employee list |
| Employees | `/employees` | CRUD, photo upload, face enrollment via camera |
| Projects | `/projects` | CRUD, GPS location capture, incharge assignment |
| Attendance | `/attendance` | Face scan or manual mode, history, export |
| Settings | `/settings` | User management, access control, app config |

## Attendance Modes

### Face Scan Mode
1. Open camera via FAB button
2. Select project in camera dialog
3. Camera detects and matches faces against enrolled descriptors
4. Sign In/Out determined automatically by scan count parity
5. Front/back camera toggle available

### Manual Mode
Enable via Settings > App Settings > Manual Attendance.
1. Click employee card to open history
2. Select project from dropdown in modal footer
3. Click Sign In / Sign Out button
4. Cross-project sign-in blocked — must sign out from current project first

## Offline Architecture

- **Service Worker** caches app shell and static assets with versioned cache (`arch-vN`)
- **IndexedDB** stores employees, projects, attendance records, face models, and app settings
- **Data flow**: Cache first for instant load, then network fetch to update cache
- **Attendance offline**: Saved to IndexedDB, bulk-synced to server on reconnect
- **Write actions**: Gated behind `data-online-only` attribute when offline

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/login` | Authenticate |
| GET | `/logout` | Clear session |
| GET | `/api/auth/me` | Current user info |

### Employees — `/api/employees`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all active employees |
| GET | `/face-data` | Employees with face descriptors |
| POST | `/` | Create employee |
| PUT | `/<id>` | Update employee |
| DELETE | `/<id>` | Soft delete |

### Projects — `/api/projects`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all projects |
| POST | `/` | Create project |
| PUT | `/<id>` | Update project |
| DELETE | `/<id>` | Soft delete |

### Attendance — `/api/attendance`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List by date/project/month |
| GET | `/summary` | Dashboard stats |
| POST | `/` | Mark attendance |
| POST | `/sync` | Bulk sync offline records |
| GET | `/export/xlsx` | Excel report |
| GET | `/export/pdf` | PDF report |

### Settings — `/api/settings`
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/users` | List / create users |
| PUT/DELETE | `/users/<id>` | Update / delete user |
| GET/PUT | `/access/<userId>` | Page access control |
| GET/PUT | `/app` | App settings |

## App Settings

| Setting | Description |
|---------|-------------|
| `haveProjects` | Enable project-based attendance |
| `manualAttendance` | Enable manual sign in/out (hides camera) |
| `exportAttendance` | Enable attendance export |
| `offlineAttendance` | Enable offline attendance mode |
| `locationMandatory` | Require GPS for attendance (shows permission prompts) |

## Configuration

| File | Key Settings |
|------|-------------|
| `config.py` | `SECRET_KEY`, `DATABASE` path, `UPLOAD_FOLDER`, `MAX_CONTENT_LENGTH` (5MB) |
| `static/sw.js` | `CACHE_NAME` — bump after any JS/CSS change |
| `static/manifest.json` | PWA name, icons, display mode, shortcuts |

## License

Proprietary. All rights reserved.
