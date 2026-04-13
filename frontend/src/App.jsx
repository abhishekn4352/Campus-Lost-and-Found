import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import ChatList from './pages/ChatList';
import ChatWindow from './pages/ChatWindow';
import OtpVerify from './pages/OtpVerify';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminItems from './pages/admin/AdminItems';
import AdminClaims from './pages/admin/AdminClaims';
import AdminUsers from './pages/admin/AdminUsers';

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
      <Route path="/messages"       element={<PrivateRoute><ChatList /></PrivateRoute>} />
      <Route path="/messages/:id"   element={<PrivateRoute><ChatWindow /></PrivateRoute>} />
      <Route path="/verify-otp/:claimId" element={<PrivateRoute><OtpVerify /></PrivateRoute>} />
      <Route path="/admin"          element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/items"    element={<AdminRoute><AdminItems /></AdminRoute>} />
      <Route path="/admin/claims"   element={<AdminRoute><AdminClaims /></AdminRoute>} />
      <Route path="/admin/users"    element={<AdminRoute><AdminUsers /></AdminRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
