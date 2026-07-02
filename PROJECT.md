# Arch Attendance

Employee attendance management PWA with browser-based face recognition and offline-first architecture.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Flask 3.1.0 (Python) |
| Database | SQLite3 (`db.sqlite3`) |
| Frontend | Vanilla JS, Bootstrap 5.3.3, Font Awesome 6.5.2 |
| Face Recognition | face-api.js 0.22.2 (client-side, self-hosted models) |
| Offline | Service Worker + IndexedDB (`ArchDB`) |
| Charts | Chart.js 4.4.4 |
| Export | openpyxl (Excel), ReportLab (PDF) |
| Auth | Flask session-based (plaintext password comparison) |

## Quick Start

```bash
pip install -r requirements.txt
python app.py
# → http://localhost:5000
```

Default port `5000`, binds `0.0.0.0`. Debug mode enabled by default.

## Project Structure

```
Attendance/
├── app.py                    # Flask app factory, SW route, blueprint registration
├── config.py                 # SECRET_KEY, DATABASE path, UPLOAD_FOLDER, MAX_CONTENT_LENGTH
├── requirements.txt          # Flask, openpyxl, reportlab, Werkzeug
├── db.sqlite3                # SQLite database (migrated from Django, tables prefixed main_)
│
├── routes/
│   ├── __init__.py
│   ├── db_helper.py          # get_db(), query(), execute() — sqlite3.Row factory
│   ├── auth.py               # /login, /logout, /api/auth/me, @login_required decorator
│   ├── pages.py              # Page routes: /, /employees, /projects, /attendance, /settings
│   ├── employees.py          # /api/employees/ CRUD + /face-data endpoint
│   ├── projects.py           # /api/projects/ CRUD with incharge_list
│   ├── attendance.py         # /api/attendance/ list/mark/sync + /export/xlsx|pdf
│   └── settings.py           # /api/settings/ users, access control, app config
│
├── templates/
│   ├── base.html             # Layout: sidebar, topbar, offline indicator, JS/CSS includes
│   ├── login.html            # Standalone login page (no base.html)
│   ├── dashboard.html        # Stats cards, donut+bar charts, employee list
│   ├── employees.html        # Employee table, add/edit modal, face enrollment
│   ├── projects.html         # Project card grid, add/edit modal, GPS capture
│   ├── attendance.html       # Employee grid, camera modal (face scan), history, export
│   └── settings.html         # Users, access control, app settings tabs
│
├── static/
│   ├── css/style.css         # Full theme: white/orange (#FAA83A) palette, no glassmorphism
│   ├── js/
│   │   ├── app.js            # Toast, imgFallback, getInitials, offline action gating
│   │   ├── db.js             # ArchDB IIFE: IndexedDB wrapper (employees, projects, attendance)
│   │   ├── sync.js           # SyncModule: push pending records, refresh IDB cache on reconnect
│   │   └── attendance.js     # AttendanceModule: face-api.js camera loop, descriptor matching
│   ├── sw.js                 # Service worker: precache, navigation/API/static strategies
│   ├── manifest.json         # PWA manifest (standalone, app shortcuts)
│   ├── models/               # face-api.js model weights (tinyFaceDetector, landmark68, recognition)
│   ├── icons/                # icon-72 through icon-512 (PWA icons)
│   └── uploads/              # Employee photos (auto-created)
```

## Pages & Features

### Login (`/login`)
- Session-based auth against `main_myuser` table
- Password toggle visibility
- Redirects to dashboard on success

### Dashboard (`/`)
- **Stats cards**: Total employees, present today, absent today, active projects
- **Donut chart**: Present vs absent percentage (Chart.js)
- **Bar chart**: Daily attendance for current month
- **Employee list**: Scrollable with search, avatar with initials fallback
- Offline: stats from IDB, employee list from IDB cache

### Employees (`/employees`)
- **Table view**: Name, code, designation, mobile, status, actions
- **Add/Edit modal**: Photo upload or camera capture, face enrollment
- **Face enrollment**: Opens camera, detects face via face-api.js, stores 128-float descriptor as JSON in `FaceData` column
- **View modal**: Read-only employee details
- Search + status filter
- Offline: table loads from IDB; add/edit/delete buttons hidden

### Projects (`/projects`)
- **Card grid**: Title, status badge, location, incharge, time, GPS coordinates
- **Add/Edit modal**: GPS capture via browser geolocation, multi-select user assignment
- Search + status filter (Active/Completed/On Hold)
- Offline: grid loads from IDB; add/edit/delete buttons hidden

### Attendance (`/attendance`)
- **Employee grid**: All active employees as cards with status strip (absent/in/out)
- **Face scan**: FAB camera button opens modal, face-api.js matches against enrolled descriptors
  - `sessionScanned` Set — one scan per employee per camera session
  - Even scan count = Sign In, odd = Sign Out (toggle per camera open)
  - Records project (from dropdown), GPS coordinates, timestamp
- **Employee history**: Click card to see today's scans with time, type, project, GPS link
- **Export modal**: Period (today/date/month), project filter, Excel/PDF format
- Offline: scans saved to IDB `attendance` store, synced when reconnected

### Settings (`/settings`) — Admin only
- **Users tab**: CRUD for app users (UserId, password, name, active, admin flag)
- **Access Control tab**: Per-user page access checkboxes
- **App Settings tab**: Toggle switches for project-based attendance, manual attendance, export, offline mode

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/login` | Login page / authenticate |
| GET | `/logout` | Clear session, redirect to login |
| GET | `/api/auth/me` | Current user info |

### Employees (`/api/employees`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all (non-deleted) |
| GET | `/face-data` | Active employees with FaceData (for offline sync) |
| GET | `/<id>` | Single employee |
| POST | `/` | Create (EmployeeCode, FullName required) |
| PUT | `/<id>` | Update |
| DELETE | `/<id>` | Soft delete (Deleted=1) |

### Projects (`/api/projects`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all with incharge_list |
| GET | `/<id>` | Single project |
| POST | `/` | Create (Title required) |
| PUT | `/<id>` | Update |
| DELETE | `/<id>` | Soft delete |

### Attendance (`/api/attendance`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List by date, project, or month/year |
| GET | `/summary` | Dashboard stats (total, present, absent, monthly) |
| POST | `/` | Mark single attendance |
| POST | `/sync` | Bulk sync from offline IDB records |
| GET | `/export/xlsx` | Download Excel report |
| GET | `/export/pdf` | Download PDF report |

### Settings (`/api/settings`)
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/users` | List / create user |
| PUT/DELETE | `/users/<id>` | Update / soft-delete user |
| GET | `/pages` | List configured pages |
| GET/PUT | `/access/<userId>` | Get / set user page access |
| GET/PUT | `/app` | Get / update app settings |

## Database Schema (Key Tables)

```sql
main_employee (id, EmployeeCode, FullName, Mobile, Email, Active, Deleted,
               Picture, Designation, FaceData TEXT, EmployeeType, Manager)

main_myproject (id, Title, Location, Status, Deleted, Incharge,
                Latitude REAL, Longitude REAL, StartTime, EndTime)

main_attendance (id, EmployeeCode, AttendanceDateTime, Latitude REAL,
                 Longitude REAL, MarkedBy, Type, ProjectId)

main_myuser (id, UserId, Password, Name, Active, Deleted, IsAdmin)

main_projectincharge (id, ProjectId, UserId)
main_pageaccess (id, UserId, PageCode)
main_page (id, PageCode, PageTitle, Active, ForAdmin, Mobile, Desktop,
           PageURL, Description, SortOrder, PageIcon)
main_appsettings (id, haveProjects, manualAttendance, exportAttendance, offlineAttendance)
```

Note: Database was originally created by Django (django_migrations, auth_* tables exist but are unused). The Flask app uses only `main_*` tables.

## Offline Architecture

### Service Worker (`static/sw.js`)
- **CACHE_NAME**: Versioned (`arch-vN`) — must be bumped after any JS/CSS edit
- **Install**: Precaches app JS/CSS, icons, manifest
- **Activate**: Purges old caches by name
- **Strategies**:
  - API calls (`/api/*`, `/login`, `/logout`): Network-only; returns `{error:'Offline'}` with 503 on failure
  - Navigation (`mode: 'navigate'`): Network-first; falls back to cached page, then branded offline HTML
  - App JS/CSS (`/static/*.js|css`): Stale-while-revalidate (serve cache, update in background)
  - CDN/other static: Cache-first with network fallback
- Served from `/sw.js` via explicit Flask route (scope: `/`)

### IndexedDB (`static/js/db.js`)
- Database: `arch_attendance`, version 1
- **Stores**:
  - `employees` (keyPath: `id`) — full employee list + face descriptors
  - `projects` (keyPath: `id`) — project list
  - `attendance` (keyPath: `localId`, autoIncrement) — offline scan queue with `status: pending|synced`
- **Key functions**: `cacheEmployees`, `mergeFaceData`, `cacheProjects`, `getEmployees`, `getEmployeesWithFaceData`, `getProjects`, `saveAttendance`, `getPendingAttendance`, `getDashboardSummary`
- Guards: `Array.isArray` + length check before `s.clear()` to prevent wiping store with error data

### Sync (`static/js/sync.js`)
- **On `DOMContentLoaded` and `online` event**:
  - `syncPending()`: Pushes `status:'pending'` attendance records to `/api/attendance/sync`
  - `refreshCache()`: Merges face descriptors into employee store (without clearing), refreshes project cache
- Uses `navigator.onLine` gate (unreliable but safe — worst case skips a sync, retries on next event)

### Offline Data Flow
1. **Online load**: Fetch API → render → cache to IDB (best-effort)
2. **Offline load**: Read IDB → render → fetch fails (SW returns 503) → catch (IDB already shown)
3. **Attendance scan offline**: Save to IDB attendance store → synced when back online
4. **Write actions (CRUD)**: Hidden via `data-online-only` attribute + `requireOnline()` guard

### Critical Patterns
- **Always check `res.ok` before `res.json()`**: The SW returns a valid 503 JSON `{error:'Offline'}`. Without the check, `res.json()` succeeds, the catch/IDB path never runs, and the page shows empty data.
- **Bump `CACHE_NAME` after any JS/CSS edit**: Stale-while-revalidate serves cache first; the version bump triggers activate which purges old cache. Without it, old code runs indefinitely.
- **Render before cache**: Call `renderX(data)` before `await ArchDB.cacheX(data)` so IDB write failures never block the UI.

## Theme & Design

- **Brand color**: `#FAA83A` (amber/orange) with shades defined as CSS variables
- **Background**: `#f5f3ef` (warm off-white), cards are `#ffffff` with subtle shadow
- **No glassmorphism**: Clean white surfaces, no `backdrop-filter`
- **CSS variables**: `--brand`, `--brand-hover`, `--brand-dark`, `--brand-deeper`, `--brand-light`, `--brand-light-2`, `--brand-light-3`, `--brand-glow`
- **Typography**: Inter (Google Fonts)
- **Sidebar**: White with border, collapsible on mobile via overlay
- **Avatar fallback**: If image fails to load, `imgFallback()` replaces `<img>` with initials `<div>`

## Face Recognition Flow

1. Employee enrollment (Employees page):
   - Upload photo or capture from camera
   - face-api.js `detectSingleFace` → `withFaceLandmarks` → `withFaceDescriptor`
   - 128-float descriptor stored as JSON string in `main_employee.FaceData`

2. Attendance scanning (Attendance page):
   - Camera opens → `AttendanceModule.startCamera()`
   - Loads `tinyFaceDetector`, `faceLandmark68Tiny`, `faceRecognitionNet` models
   - Builds `LabeledFaceDescriptors` from IDB employees with FaceData
   - Detection loop every 1200ms, match threshold 0.5, cooldown 4000ms per face
   - On match: `onFaceMatched(emp)` → determines In/Out by scan count parity → POST to API
   - `sessionScanned` Set prevents duplicate scans within one camera session

## Export

- **Excel** (`/api/attendance/export/xlsx`): openpyxl with styled header row, auto-column-width
- **PDF** (`/api/attendance/export/pdf`): ReportLab landscape A4 with table styling
- Both support filters: date, month/year, project_id
- Includes: employee code, name, designation, date, time, type, project, GPS, marked-by

## Configuration

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | `arch-attendance-secret-2024` | Flask session secret |

### Files
| File | Purpose |
|------|---------|
| `config.py` | `SECRET_KEY`, `DATABASE` path, `UPLOAD_FOLDER`, `MAX_CONTENT_LENGTH` (5MB) |
| `static/manifest.json` | PWA manifest (app name, icons, shortcuts, display mode) |
| `static/sw.js` | Service worker config (`CACHE_NAME`, `PRECACHE` list) |

## Development Notes

- Database uses Django-era table names (`main_*`) — the app was migrated from Django to Flask but reuses the same SQLite file
- All deletes are soft-deletes (`Deleted=1`), never hard-deletes
- Passwords stored in plaintext in `main_myuser.Password` (no hashing)
- `@login_required` returns 401 JSON for API calls, redirects to `/login` for page requests
- Employee photos saved to `static/uploads/` as `{EmployeeCode}_{uuid}.jpg|png`
- face-api.js models are self-hosted in `static/models/` (no CDN dependency for offline)
- CDN dependencies (Bootstrap, Font Awesome, Chart.js, Google Fonts) are cached by the SW on first visit but not precached — first offline load after install requires at least one prior online page visit
