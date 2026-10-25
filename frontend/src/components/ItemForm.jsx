import { useEffect, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { CATEGORIES } from '../constants';
import { assetUrl } from '../utils/assets';
import { getErrorMessage } from '../utils/errorMessage';
import { todayInputValue } from '../utils/format';
import Button from './Button';
import { Alert } from './States';
import { TypeBadge } from './Badge';

const LIMITS = { title: 100, description: 1000, location: 120 };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const EMPTY_ITEM = { type: 'lost', title: '', description: '', category: '', location: '', lostFoundDate: '' };

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

// Shared by "Report an item" and "Edit post". In edit mode the item type is
// fixed (claims depend on it) and the current photo can be kept, replaced
// or removed.
export default function ItemForm({ mode = 'create', initial, existingImageUrl = '', submitLabel, onSubmit }) {
  const editing = mode === 'edit';
  const [form, setForm] = useState({ ...EMPTY_ITEM, lostFoundDate: todayInputValue(), ...initial });
  const [errors, setErrors] = useState({});
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [imageError, setImageError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

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
  const clearNewImage = () => { setImage(null); setPreview(null); setImageError(''); };

  const currentPhoto = preview || (!removeExisting && existingImageUrl ? assetUrl(existingImageUrl) : null);

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
    Object.entries(form).forEach(([k, v]) => {
      if (editing && k === 'type') return; // the type never changes after posting
      fd.append(k, typeof v === 'string' ? v.trim() : v);
    });
    if (image) fd.append('image', image);
    else if (editing && removeExisting) fd.append('removeImage', 'true');
    try {
      await onSubmit(fd, form);
    } catch (err) {
      setSubmitError(getErrorMessage(err, editing ? 'We couldn’t save your changes.' : 'We couldn’t post your item.'));
      setLoading(false);
    }
  };

  const isLost = form.type === 'lost';

  return (
    <form className="panel" onSubmit={submit} noValidate>
      {submitError && <Alert type="error">{submitError}</Alert>}

      <div className="field">
        <span className="label" id="type-label">{editing ? 'Type' : 'What happened?'}</span>
        {editing ? (
          <div><TypeBadge type={form.type} /> <span className="hint" style={{ marginLeft: 8 }}>The type can’t be changed after posting.</span></div>
        ) : (
          <div className="seg" role="group" aria-labelledby="type-label">
            <button type="button" className="is-lost" aria-pressed={isLost} onClick={() => set('type', 'lost')}>I lost something</button>
            <button type="button" className="is-found" aria-pressed={!isLost} onClick={() => set('type', 'found')}>I found something</button>
          </div>
        )}
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
        {currentPhoto ? (
          <div className="preview">
            <img src={currentPhoto} alt="Selected photo" />
            <button type="button" className="icon-btn" aria-label="Remove photo"
              onClick={() => { if (preview) clearNewImage(); else setRemoveExisting(true); }}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className={`dropzone ${dragOver ? 'is-over' : ''}`}
            onDragOver={() => setDragOver(true)} onDragLeave={() => setDragOver(false)} onDrop={() => setDragOver(false)}>
            <input id="post-image" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a photo" onChange={(e) => pickImage(e.target.files[0])} />
            <Camera size={28} aria-hidden="true" />
            <strong>{editing && existingImageUrl ? 'Add a new photo' : 'Add a photo'}</strong>
            <span>Drag one here or tap to choose · JPG, PNG or WEBP · up to 5 MB</span>
          </div>
        )}
        {editing && removeExisting && !preview && existingImageUrl && (
          <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setRemoveExisting(false)}>Keep the current photo</button>
        )}
        {imageError && <span className="error-text" role="alert">{imageError}</span>}
        {!isLost && !editing && <span className="hint">Tip: avoid showing ID numbers or names clearly — keep something back to verify the owner.</span>}
      </div>

      <Button type="submit" variant="primary" size="lg" block loading={loading}>
        {submitLabel || (isLost ? 'Post lost item' : 'Post found item')}
      </Button>
    </form>
  );
}
