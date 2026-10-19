import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, X } from 'lucide-react';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errorMessage';
import { todayInputValue } from '../utils/format';
import { CATEGORIES } from '../constants';
import useDocumentTitle from '../hooks/useDocumentTitle';
import Button from '../components/Button';
import PageHeader from '../components/PageHeader';
import { Alert } from '../components/States';

const LIMITS = { title: 100, description: 1000, location: 120 };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function validate(form) {
  const e = {};
  if (form.title.trim().length < 3) e.title = 'Give it a short title (at least 3 characters).';
  if (form.description.trim().length < 10) e.description = 'Add a few details — colour, brand, marks (at least 10 characters).';
  if (!form.category) e.category = 'Choose a category.';
  if (!form.lostFoundDate) e.lostFoundDate = 'Choose the date.';
  else if (form.lostFoundDate > todayInputValue()) e.lostFoundDate = 'The date can’t be in the future.';
  if (!form.location.trim()) e.location = 'Say where on campus.';
  return e;
}

function FieldError({ id, message }) {
  return message ? <span id={id} className="error-text">{message}</span> : null;
}

export default function PostItem() {
  useDocumentTitle('Report an item');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [form, setForm] = useState({ type: 'lost', title: '', description: '', category: '', location: '', lostFoundDate: todayInputValue() });
  const [errors, setErrors] = useState({});
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [imageError, setImageError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Release the object URL when the preview changes / unmounts.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const set = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
  };
  const onChange = (e) => set(e.target.name, e.target.value);

  const pickImage = (file) => {
    setImageError('');
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return setImageError('Use a JPG, PNG or WEBP image.');
    if (file.size > MAX_IMAGE_BYTES) return setImageError('That image is over 5 MB. Choose a smaller one.');
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };
  const removeImage = () => { setImage(null); setPreview(null); setImageError(''); };

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(`post-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setLoading(true);
    setSubmitError('');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, typeof v === 'string' ? v.trim() : v));
    if (image) fd.append('image', image);
    try {
      const { data } = await API.post('/items', fd);
      showToast(`Your ${form.type} item is on the board.`, 'success');
      navigate(`/items/${data._id}`);
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'We couldn’t post your item.'));
      setLoading(false);
    }
  };

  const isLost = form.type === 'lost';

  return (
    <div className="container container-form page">
      <PageHeader title="Report an item" subtitle="The more specific you are, the faster it gets matched." />

      <form className="panel" onSubmit={submit} noValidate>
        {submitError && <Alert type="error">{submitError}</Alert>}

        <div className="field">
          <span className="label" id="type-label">What happened?</span>
          <div className="seg" role="group" aria-labelledby="type-label">
            <button type="button" className="is-lost" aria-pressed={isLost} onClick={() => set('type', 'lost')}>I lost something</button>
            <button type="button" className="is-found" aria-pressed={!isLost} onClick={() => set('type', 'found')}>I found something</button>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="post-title">Title</label>
          <input id="post-title" name="title" className="input" value={form.title} onChange={onChange} maxLength={LIMITS.title}
            placeholder="e.g. Black wallet with a green sticker" aria-invalid={errors.title ? 'true' : undefined} aria-describedby="post-title-err" />
          <FieldError id="post-title-err" message={errors.title} />
        </div>

        <div className="field">
          <label className="label" htmlFor="post-description">Description</label>
          <textarea id="post-description" name="description" className="textarea" rows={4} value={form.description} onChange={onChange} maxLength={LIMITS.description}
            placeholder={isLost ? 'Brand, colour, what was inside, anything unusual about it.' : 'Describe it — but keep one detail back so the real owner can prove it’s theirs.'}
            aria-invalid={errors.description ? 'true' : undefined} aria-describedby="post-description-err" />
          <div className="field-meta">
            <FieldError id="post-description-err" message={errors.description} />
            <span className="hint" style={{ marginLeft: 'auto' }}>{form.description.length}/{LIMITS.description}</span>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="post-category">Category</label>
          <select id="post-category" name="category" className="select" value={form.category} onChange={onChange}
            aria-invalid={errors.category ? 'true' : undefined} aria-describedby="post-category-err">
            <option value="">Choose a category</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <FieldError id="post-category-err" message={errors.category} />
        </div>

        <div className="field">
          <label className="label" htmlFor="post-lostFoundDate">{isLost ? 'Date you lost it' : 'Date you found it'}</label>
          <input id="post-lostFoundDate" name="lostFoundDate" type="date" className="input" max={todayInputValue()} value={form.lostFoundDate} onChange={onChange}
            aria-invalid={errors.lostFoundDate ? 'true' : undefined} aria-describedby="post-lostFoundDate-err" />
          <FieldError id="post-lostFoundDate-err" message={errors.lostFoundDate} />
        </div>

        <div className="field">
          <label className="label" htmlFor="post-location">{isLost ? 'Where did you lose it?' : 'Where did you find it?'}</label>
          <input id="post-location" name="location" className="input" value={form.location} onChange={onChange} maxLength={LIMITS.location}
            placeholder="e.g. Central library, 2nd floor" aria-invalid={errors.location ? 'true' : undefined} aria-describedby="post-location-err" />
          <FieldError id="post-location-err" message={errors.location} />
        </div>

        <div className="field">
          <span className="label">Photo <span className="optional">(optional)</span></span>
          {preview ? (
            <div className="preview">
              <img src={preview} alt="Preview of the selected photo" />
              <button type="button" className="icon-btn" onClick={removeImage} aria-label="Remove photo"><X size={18} aria-hidden="true" /></button>
            </div>
          ) : (
            <div className={`dropzone ${dragOver ? 'is-over' : ''}`}
              onDragOver={() => setDragOver(true)} onDragLeave={() => setDragOver(false)} onDrop={() => setDragOver(false)}>
              <input id="post-image" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a photo" onChange={(e) => pickImage(e.target.files[0])} />
              <Camera size={28} aria-hidden="true" />
              <strong>Add a photo</strong>
              <span>Drag one here or tap to choose · JPG, PNG or WEBP · up to 5 MB</span>
            </div>
          )}
          {imageError && <span className="error-text" role="alert">{imageError}</span>}
          {!isLost && <span className="hint">Tip: avoid showing ID numbers or names clearly — keep something back to verify the owner.</span>}
        </div>

        <Button type="submit" variant="primary" size="lg" block loading={loading}>{isLost ? 'Post lost item' : 'Post found item'}</Button>
      </form>
    </div>
  );
}
