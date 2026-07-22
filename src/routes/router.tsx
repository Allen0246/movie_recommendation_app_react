import { createBrowserRouter } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { AdminRoute } from '../components/AdminRoute'
import { ErrorPage } from '../pages/ErrorPage'
import { LandingPage } from '../pages/LandingPage'
import { LoginPage } from '../pages/LoginPage'
import { RegisterPage } from '../pages/RegisterPage'
import { HomePage } from '../pages/HomePage'
import { MoviesPage } from '../pages/MoviesPage'
import { MyMoviesPage } from '../pages/MyMoviesPage'
import { RecommendationPage } from '../pages/RecommendationPage'
import { AdminUsersPage } from '../pages/admin/AdminUsersPage'
import { AdminUserFormPage } from '../pages/admin/AdminUserFormPage'
import { AdminAuditLogPage } from '../pages/admin/AdminAuditLogPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      {
        path: 'home',
        element: (
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'movies',
        element: (
          <ProtectedRoute>
            <MoviesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'my-movies',
        element: (
          <ProtectedRoute>
            <MyMoviesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'recommendation',
        element: (
          <ProtectedRoute>
            <RecommendationPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/users',
        element: (
          <AdminRoute>
            <AdminUsersPage />
          </AdminRoute>
        ),
      },
      {
        path: 'admin/users/new',
        element: (
          <AdminRoute>
            <AdminUserFormPage />
          </AdminRoute>
        ),
      },
      {
        path: 'admin/users/:id/edit',
        element: (
          <AdminRoute>
            <AdminUserFormPage />
          </AdminRoute>
        ),
      },
      {
        path: 'admin/logs',
        element: (
          <AdminRoute>
            <AdminAuditLogPage />
          </AdminRoute>
        ),
      },
    ],
  },
])
