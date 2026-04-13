import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

export default function PrivateRoute({ children }) {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return <Spinner text="Authenticating..." />;
  return isLoggedIn() ? children : <Navigate to="/login" />;
}
