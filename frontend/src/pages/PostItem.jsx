import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';
import useDocumentTitle from '../hooks/useDocumentTitle';
import ItemForm from '../components/ItemForm';
import PageHeader from '../components/PageHeader';

export default function PostItem() {
  useDocumentTitle('Report an item');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const create = async (formData, form) => {
    const { data } = await API.post('/items', formData);
    showToast(`Your ${form.type} item is on the board.`, 'success');
    navigate(`/items/${data._id}`);
  };

  return (
    <div className="container container-form page">
      <PageHeader title="Report an item" subtitle="The more specific you are, the faster it gets matched." />
      <ItemForm mode="create" onSubmit={create} />
    </div>
  );
}
