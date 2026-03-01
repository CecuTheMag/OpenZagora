# Admin Server Setup

## Environment Variables

All admin credentials are now stored in environment variables for security.

### Required Variables

```bash
# Default Admin Credentials
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_EMAIL=admin@openzagora.local
DEFAULT_ADMIN_PASSWORD=admin123
```

## Initial Setup

### 1. Configure Environment

Copy `.env.example` to `.env` and update credentials:

```bash
cp .env.example .env
nano .env  # Edit DEFAULT_ADMIN_* variables
```

### 2. Create Admin User

Run the setup script to create the admin user from environment variables:

```bash
# In Docker
docker exec open-zagora-admin-server-dev node /app/scripts/create-admin.js

# Or locally
node scripts/create-admin.js
```

### 3. Login

Use the credentials from your `.env` file:
- URL: http://localhost:5174
- Username: (from `DEFAULT_ADMIN_USERNAME`)
- Password: (from `DEFAULT_ADMIN_PASSWORD`)

## Security Notes

⚠️ **IMPORTANT**: Change default credentials in production!

1. Update `.env` with strong credentials
2. Run `create-admin.js` to update the user
3. Never commit `.env` to version control
4. Use environment-specific `.env` files

## Utility Scripts

### Reset Admin Password

```bash
docker exec open-zagora-admin-server-dev node /app/scripts/reset-admin-password.js
```

### Check Admin Status

```bash
docker exec open-zagora-admin-server-dev node /app/scripts/check-admin.js
```

### Unlock Admin Account

```bash
docker exec open-zagora-admin-server-dev node /app/scripts/unlock-admin.js
```

## Default Credentials (Development Only)

- **Username**: admin
- **Password**: admin123
- **Email**: admin@openzagora.local

⚠️ These are for development only. Change immediately in production!
