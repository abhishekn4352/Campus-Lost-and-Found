import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock, PackageSearch } from 'lucide-react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errorMessage';
import { toInputDate } from '../utils/format';
import useDocumentTitle from '../hooks/useDocumentTitle';
import ItemForm from '../components/ItemForm';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import { EmptyState, ErrorState, PageLoader } from '../components/States';

export default function EditItem() {
  useDocumentTitle('Edit post');
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(''); setNotFound(false);
    try {
      const { data } = await API.get(`/items/${id}`);
      setItem(data);
    } catch (err) {
      if (err.response?.status === 404) setNotFound(true);
      else setError(getErrorMessage(err, 'We couldn’t load this post.'));
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const save = async (formData) => {
    await API.put(`/items/${id}`, formData);
    showToast('Post updated.', 'success');
    navigate(`/items/${id}`);
  };

  if (loading) return <div className="container page"><PageLoader text="Loading post…" /></div>;
  if (notFound) return <div className="container container-narrow page"><EmptyState icon={PackageSearch} title="This post isn’t here any more" action={<Button to="/my-posts" variant="primary">My posts</Button>} /></div>;
  if (error) return <div className="container container-narrow page"><ErrorState message={error} onRetry={load} /></div>;

  const isOwner = String(user?._id) === String(item.postedBy?._id);
  if (!isOwner || item.status === 'Closed') {
    return (
      <div className="container container-narrow page">
        <EmptyState icon={Lock} title={isOwner ? 'Closed posts can’t be edited' : 'You can only edit your own posts'}
          action={<Button to={`/items/${id}`} variant="primary">Back to the post</Button>} />
      </div>
    );
  }

  return (
    <div className="container container-form page">
      <PageHeader title="Edit post" subtitle="Fix a detail, add a photo, or correct where it was." />
      <ItemForm
        mode="edit"
        submitLabel="Save changes"
        existingImageUrl={item.imageUrl}
        initial={{ type: item.type, title: item.title, description: item.description, category: item.category, location: item.location, lostFoundDate: toInputDate(item.lostFoundDate) }}
        onSubmit={save}
      />
    </div>
  );
}
