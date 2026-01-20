# Multi-Tenant Restaurant Management System

A scalable multi-tenant web application where each partner has their own independent admin panel accessible via unique URLs.

## System Architecture

```
Super Admin → Partners → Branches → Users
```

## Database Schema

### Core Tables
- **roles** - User roles (founder, partner_admin, etc.)
- **partners** - Partner organizations with unique URL suffixes
- **branches** - Partner's physical locations
- **users** - System users (super admin and partner users)

### Additional Tables (placeholders)
- **orders** - Order management
- **logs** - System activity logs
- **access_rights** - Role-based permissions
- **reports** - Analytics and reporting data

## Access Structure

### Super Admin
- **Login:** `1` / **Password:** `1`
- **Role:** founder (cannot be deleted or modified)
- **Access:** All partners' admin panels
- **URL:** `/` (root)
- **Features:**
  - View all partners
  - Create/edit/delete partners
  - Pause/resume partners
  - Open any partner's admin panel

### Partner URLs
Each partner has a unique URL:
```
https://restopresto.org/{url_suffix}
```

Examples:
- `https://restopresto.org/pizza-city`
- `https://restopresto.org/sushi-bar`

### Partner Login
- Each partner has their own login page at `/{url_suffix}`
- Users can only log in to their assigned partner
- Super admin (1/1) can access any partner's admin panel
- If partner status is "paused", displays pause_message

## Key Features

### 1. Complete Data Isolation
- Each partner's data is completely separate
- Users from one partner cannot access another partner's data
- All queries are filtered by `partner_id`

### 2. Independent Admin Panels
Each partner gets their own admin panel with:
- Dashboard with key metrics
- Orders management
- History tracking
- Settings configuration
- System logs
- Access rights management
- Reports and analytics

### 3. Super Admin Controls
- Full visibility of all partners
- Ability to pause partners with custom messages
- Soft delete (status = "deleted")
- One-click access to any partner's admin panel

### 4. Security Features
- Row Level Security (RLS) enabled on all tables
- Password authentication (stored as plain text in demo - use proper hashing in production)
- User login is unique per partner (same login can exist for different partners)
- Super admin credentials cannot be changed through UI

## Environment Configuration

The system uses environment variables from `.env`:
```
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

## Routes

### Super Admin Routes
- `/` - Super admin login
- `/admin/partners` - Partners list
- `/admin/partners/create` - Create new partner
- `/admin/partners/edit/:id` - Edit partner

### Partner Routes
- `/:urlSuffix` - Partner login
- `/:urlSuffix/dashboard` - Partner dashboard (contains all menu items)

## Partner Status

- **active** - Normal operation
- **paused** - Shows pause_message, blocks access
- **deleted** - Soft deleted, not visible

## Development Notes

### Creating a New Partner
1. Go to `/admin/partners`
2. Click "Добавить партнёра"
3. Fill in:
   - Name (display name)
   - URL suffix (lowercase letters, numbers, hyphens only)
   - Logo URL (optional)
   - Status
   - Pause message (if paused)
4. System validates URL suffix uniqueness

### Accessing Partner Admin
1. Super admin clicks "Открыть админку" button
2. Opens `/{url_suffix}` in new tab
3. Login with either:
   - Super admin credentials (1/1)
   - Partner user credentials

### Scalability
- Database structure supports unlimited partners
- Each partner can have multiple branches
- Each branch can have multiple users
- All placeholder tables ready for expansion

## Future Extensions

The system is designed to be easily extended with:
- Real order management
- Detailed reporting and analytics
- Advanced user permissions
- Multi-branch operations
- Integration APIs
- Payment processing
- Customer management
