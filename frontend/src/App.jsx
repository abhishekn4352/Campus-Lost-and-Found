import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { ConfirmProvider } from './context/ConfirmContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import { PageLoader } from './components/States';
import Home from './pages/Home';

// Every screen except the landing page is code-split, so a first visit only
// downloads what it actually shows.
const ItemList = lazy(() => import('./pages/ItemList'));
const ItemDetail = lazy(() => import('./pages/ItemDetail'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PostItem = lazy(() => import('./pages/PostItem'));
const MyPosts = lazy(() => import('./pages/MyPosts'));
const Claims = lazy(() => import('./pages/Claims'));
const Profile = lazy(() => import('./pages/Profile'));
const ChatList = lazy(() => import('./pages/ChatList'));
const ChatWindow = lazy(() => import('./pages/ChatWindow'));
const NotFound = lazy(() => import('./pages/NotFound'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminItems = lazy(() => import('./pages/admin/AdminItems'));
const AdminClaims = lazy(() => import('./pages/admin/AdminClaims'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));

function PrivateRoute({ children }) {
  const { isLoggedIn, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader text="Checking your session…" />;
  // Remember where they were going so login can send them back.
  return isLoggedIn() ? children : <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
}

function AdminRoute({ children }) {
  const { isAdmin, isLoggedIn, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader text="Checking permissions…" />;
  if (!isLoggedIn()) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return isAdmin() ? children : <Navigate to="/" replace />;
}

// Signed-in people have no reason to see the login/register forms.
function GuestRoute({ children }) {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return <PageLoader text="Loading…" />;
  return isLoggedIn() ? <Navigate to="/dashboard" replace /> : children;
}

const priv = (el) => <PrivateRoute>{el}</PrivateRoute>;
const admin = (el) => <AdminRoute>{el}</AdminRoute>;

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/items" element={<ItemList />} />
        <Route path="/items/:id" element={<ItemDetail />} />
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

        <Route path="/dashboard" element={priv(<Dashboard />)} />
        <Route path="/post-item" element={priv(<PostItem />)} />
        <Route path="/my-posts" element={priv(<MyPosts />)} />
        <Route path="/claims" element={priv(<Claims />)} />
        <Route path="/my-claims" element={<Navigate to="/claims" replace />} />
        <Route path="/profile" element={priv(<Profile />)} />
        <Route path="/messages" element={priv(<ChatList />)} />
        <Route path="/messages/:id" element={priv(<ChatWindow />)} />

        <Route path="/admin" element={admin(<AdminDashboard />)} />
        <Route path="/admin/items" element={admin(<AdminItems />)} />
        <Route path="/admin/claims" element={admin(<AdminClaims />)} />
        <Route path="/admin/users" element={admin(<AdminUsers />)} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <NotificationsProvider>
            <ConfirmProvider>
              <BrowserRouter
                basename={import.meta.env.BASE_URL}
                future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
              >
                <Navbar />
                <main id="main" tabIndex={-1}>
                  <AppRoutes />
                </main>
                <Footer />
              </BrowserRouter>
            </ConfirmProvider>
          </NotificationsProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
