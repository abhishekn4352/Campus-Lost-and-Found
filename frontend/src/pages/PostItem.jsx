import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';

const CATEGORIES = ['Electronics', 'Books', 'ID Card', 'Keys', 'Wallet', 'Clothing', 'Sports', 'Other'];

export default function PostItem() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    type: 'lost', title: '', description: '',
    category: '', location: '', lostFoundDate: ''
  });
  const [image, setImage]           = useState(null);
  const [imagePreview, setPreview]  = useState(null);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleImageChange = e => {
    const file = e.target.files[0];
    setImage(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const fd = new FormData();
    Object.keys(form).forEach(k => fd.append(k, form[k]));
    if (image) fd.append('image', image);
    try {
      await API.post('/items', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      navigate('/my-posts');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrap">
      <div className="row justify-content-center">
        <div className="col-lg-7 col-xl-6">
          <div className="pg-header" style={{ textAlign: 'center' }}>
            <div className="pg-kicker">New Report</div>
            <h1 className="pg-title">Post an Item</h1>
            <p className="pg-sub">Help someone find their belongings, or report what you've lost</p>
          </div>

          <div className="card-panel anim-up" style={{ padding: '32px 28px' }}>
            {error && (
              <div className="alert-box alert-err">⚠️ {error}</div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Type Toggle */}
              <div style={{ marginBottom: 20 }}>
                <label className="field-label">I want to report…</label>
                <div className="type-toggle">
                  <button
                    type="button"
                    className={`type-btn ${form.type === 'lost' ? 'lost-active' : ''}`}
                    onClick={() => setForm({ ...form, type: 'lost' })}
                  >
                    🔴 I Lost Something
                  </button>
                  <button
                    type="button"
                    className={`type-btn ${form.type === 'found' ? 'found-active' : ''}`}
                    onClick={() => setForm({ ...form, type: 'found' })}
                  >
                    🟢 I Found Something
                  </button>
                </div>
              </div>

              <div className="field">
                <label className="field-label">Item Title</label>
                <input
                  className="inp"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="e.g. Black Samsung Galaxy Buds"
                  required
                />
              </div>

              <div className="field">
                <label className="field-label">Description</label>
                <textarea
                  className="inp"
                  name="description"
                  rows={3}
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Describe the item — color, brand, distinguishing features…"
                  required
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <div className="field">
                    <label className="field-label">Category</label>
                    <select
                      className="inp inp-select"
                      name="category"
                      value={form.category}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select category</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="field">
                    <label className="field-label">Date Lost / Found</label>
                    <input
                      type="date"
                      className="inp"
                      name="lostFoundDate"
                      value={form.lostFoundDate}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="field">
                <label className="field-label">Location on Campus</label>
                <input
                  className="inp"
                  name="location"
                  placeholder="e.g. Library Block A, Cafeteria, Auditorium"
                  value={form.location}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Image Upload */}
              <div className="field">
                <label className="field-label">Photo <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span></label>
                <div className="upload-zone">
                  <input type="file" accept="image/*" onChange={handleImageChange} />
                  {!imagePreview && (
                    <>
                      <div style={{ fontSize: '1.8rem', marginBottom: 6, opacity: 0.4 }}>📷</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>
                        Click or drag image here
                      </div>
                    </>
                  )}
                </div>
                {imagePreview && (
                  <div className="img-preview-box">
                    <img src={imagePreview} alt="Preview" />
                    <button
                      type="button"
                      className="img-remove-btn"
                      onClick={() => { setImage(null); setPreview(null); }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className={`btn btn-full btn-lg ${form.type === 'lost' ? 'btn-danger-soft' : 'btn-success-soft'}`}
                disabled={loading}
                style={{ marginTop: 8 }}
              >
                {loading
                  ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Posting…</>
                  : `🚀 Post ${form.type === 'lost' ? 'Lost' : 'Found'} Item`}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
