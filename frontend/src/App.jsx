import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import Spinner from './components/Spinner';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import ItemList from './pages/ItemList';
import ItemDetail from './pages/ItemDetail';
import PostItem from './pages/PostItem';
import MyPosts from './pages/MyPosts';
import MyClaims from './pages/MyClaims';
import Profile from './pages/Profile';
import ChatList from './pages/ChatList';
import ChatWindow from './pages/ChatWindow';
import OtpVerify from './pages/OtpVerify';

// Code-split: the four Admin pages are only ever needed by admin
// accounts, a small minority of users. Previously every student
// downloaded this code on every single page load despite never using
// it. Lazy-loading means it's only fetched the first time someone
// actually navigates into /admin — at the cost of a brief loading state
// on that first admin navigation, which is a good trade for a page only
// admins ever reach.
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminItems     = lazy(() => import('./pages/admin/AdminItems'));
const AdminClaims    = lazy(() => import('./pages/admin/AdminClaims'));
const AdminUsers     = lazy(() => import('./pages/admin/AdminUsers'));

function PrivateRoute({ children }) {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return <Spinner text="Authenticating..." />;
  return isLoggedIn() ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <Spinner text="Checking permissions..." />;
  return isAdmin() ? children : <Navigate to="/" />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"               element={<Home />} />
      <Route path="/dashboard"      element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/login"          element={<Login />} />
      <Route path="/register"       element={<Register />} />
      <Route path="/items"          element={<ItemList />} />
      <Route path="/items/:id"      element={<ItemDetail />} />
      <Route path="/post-item"      element={<PrivateRoute><PostItem /></PrivateRoute>} />
      <Route path="/my-posts"       element={<PrivateRoute><MyPosts /></PrivateRoute>} />
      <Route path="/my-claims"      element={<PrivateRoute><MyClaims /></PrivateRoute>} />
      <Route path="/profile"        element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="/messages"       element={<PrivateRoute><ChatList /></PrivateRoute>} />
      <Route path="/messages/:id"   element={<PrivateRoute><ChatWindow /></PrivateRoute>} />
      <Route path="/verify-otp/:claimId" element={<PrivateRoute><OtpVerify /></PrivateRoute>} />
      <Route path="/admin" element={
        <AdminRoute>
          <Suspense fallback={<Spinner text="Loading admin panel..." />}><AdminDashboard /></Suspense>
        </AdminRoute>
      } />
      <Route path="/admin/items" element={
        <AdminRoute>
          <Suspense fallback={<Spinner text="Loading admin panel..." />}><AdminItems /></Suspense>
        </AdminRoute>
      } />
      <Route path="/admin/claims" element={
        <AdminRoute>
          <Suspense fallback={<Spinner text="Loading admin panel..." />}><AdminClaims /></Suspense>
        </AdminRoute>
      } />
      <Route path="/admin/users" element={
        <AdminRoute>
          <Suspense fallback={<Spinner text="Loading admin panel..." />}><AdminUsers /></Suspense>
        </AdminRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Navbar />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
