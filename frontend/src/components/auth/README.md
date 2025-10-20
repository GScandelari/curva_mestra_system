# Authentication System

This directory contains all authentication-related components for the Curva Mestra System frontend.

## Components

### LoginForm
- **File**: `LoginForm.jsx`
- **Purpose**: Handles user login with email and password
- **Features**:
  - Form validation with react-hook-form
  - Password visibility toggle
  - Automatic redirect after successful login
  - Error handling and display
  - Responsive design

### ForgotPasswordForm
- **File**: `ForgotPasswordForm.jsx`
- **Purpose**: Allows users to request password reset
- **Features**:
  - Email validation
  - Success confirmation screen
  - Link back to login

### ResetPasswordForm
- **File**: `ResetPasswordForm.jsx`
- **Purpose**: Handles password reset with token from email
- **Features**:
  - Strong password validation
  - Password confirmation
  - Visual password requirements indicator
  - Token validation
  - Success confirmation with auto-redirect

### ProtectedRoute
- **File**: `ProtectedRoute.jsx`
- **Purpose**: Protects routes based on authentication and permissions
- **Features**:
  - Authentication check
  - Role-based access control
  - Permission-based access control
  - Loading state handling
  - Automatic redirects

## Usage Examples

### Basic Protected Route
```jsx
<ProtectedRoute>
  <DashboardPage />
</ProtectedRoute>
```

### Role-based Protection
```jsx
<ProtectedRoute requiredRole="admin">
  <AdminPanel />
</ProtectedRoute>
```

### Permission-based Protection
```jsx
<ProtectedRoute requiredPermission="manage_products">
  <ProductManagement />
</ProtectedRoute>
```

### Higher-order Components
```jsx
const ProtectedAdminComponent = withRoleProtection(AdminComponent, 'admin')
const ProtectedProductComponent = withPermissionProtection(ProductComponent, 'manage_products')
```

## Authentication Context

The authentication system uses React Context to manage global auth state:

- **isAuthenticated**: Boolean indicating if user is logged in
- **user**: Current user object with role and permissions
- **loading**: Boolean indicating if auth operation is in progress
- **error**: Current error message if any
- **login()**: Function to authenticate user
- **logout()**: Function to log out user
- **forgotPassword()**: Function to request password reset
- **resetPassword()**: Function to reset password with token
- **hasPermission()**: Function to check user permissions

## Permissions System

The system implements role-based access control (RBAC) with the following roles:

- **admin**: Full system access
- **manager**: Product management, request approval, reports
- **doctor**: Product requests, patient management
- **receptionist**: Patient management, view requests

### Permission Mapping
- `view_products`: View product inventory
- `manage_products`: Create, edit, delete products
- `request_products`: Request products from inventory
- `approve_requests`: Approve/reject product requests
- `view_patients`: View patient information
- `manage_patients`: Create, edit patient records
- `view_reports`: Access system reports
- `manage_settings`: System configuration access

## Security Features

- JWT token-based authentication
- Automatic token refresh
- Secure password requirements
- HTTPS enforcement in production
- XSS protection through input sanitization
- CSRF protection through token validation