# Database Migrations

This directory contains all database migrations for the multi-tenant restaurant management system.

## Migration Files

### 20251124100110_create_initial_schema.sql
**Purpose:** Initial database schema creation

Creates the complete database structure including:
- **8 tables:** roles, partners, branches, users, orders, logs, access_rights, reports
- **Row Level Security (RLS)** enabled on all tables
- **RLS Policies** for secure data access
- **Foreign key constraints** for data integrity
- **Initial data:** Creates "founder" role and super admin user

Tables created:
1. `roles` - User roles (founder, partner_admin, etc.)
2. `partners` - Partner organizations with unique URL suffixes
3. `branches` - Physical branch locations for partners
4. `users` - System users (super admin and partner users)
5. `orders` - Order management (placeholder)
6. `logs` - System activity logs (placeholder)
7. `access_rights` - Role-based permissions (placeholder)
8. `reports` - Analytics and reporting data (placeholder)

### 20251124101236_add_performance_indexes.sql
**Purpose:** Add database indexes for query optimization

Creates indexes on frequently queried columns:
- Partners: url_suffix, status
- Users: login, partner_id, role_id, (login, partner_id)
- Branches: partner_id, status
- Orders: partner_id, user_id, status, created_at
- Logs: partner_id, user_id, created_at
- Access Rights: role_id
- Reports: partner_id, type

### 20251124101308_add_partner_roles.sql
**Purpose:** Add additional partner user roles

Creates three partner roles:
1. `partner_admin` - Full partner administration access
2. `partner_manager` - Order and report management
3. `partner_user` - Basic user with limited access

## Applying Migrations

Migrations are automatically applied when using the Supabase MCP tools.

To manually apply a migration:
```sql
-- Connect to your Supabase database and run the migration SQL
```

## Migration Best Practices

1. **Never modify existing migrations** - Create new migrations for changes
2. **Always use IF NOT EXISTS** - Prevents errors on re-running
3. **Include detailed comments** - Document what each migration does
4. **Test locally first** - Verify migrations before applying to production
5. **Keep migrations atomic** - One logical change per migration

## Database Connection

The application uses these environment variables:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

These are configured in the `.env` file (not committed to git).

## Security Notes

- All tables have RLS enabled
- Service role is used for data operations through Supabase client
- Super admin user (login: 1, password: 1) is created automatically
- Partner data is completely isolated using RLS policies
