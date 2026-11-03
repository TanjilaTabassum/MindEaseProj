import React, { useState, useEffect } from 'react';
import axios from 'axios';

const emptyForm = {
  title: '',
  type: 'article',
  category: '',
  description: '',
  url: '',
  phone: '',
  content: ''
};

const authConfig = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

const ManageResources = () => {
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories();
    fetchResources();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await axios.get('/api/resources/categories/all');
      setCategories(res.data?.categories || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load categories.');
    }
  };

  const fetchResources = async () => {
    try {
      const res = await axios.get('/api/resources', authConfig());
      setResources(res.data?.resources || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load resources.');
    }
  };

  const categoryName = (id) => {
    const found = categories.find((c) => c._id === id);
    return found ? found.name : '-';
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddCategory = async () => {
    setMessage('');
    setError('');
    if (!newCategory.trim()) {
      setError('Type a category name first.');
      return;
    }
    try {
      const res = await axios.post(
        '/api/resources/categories',
        { name: newCategory.trim() },
        authConfig()
      );
      setNewCategory('');
      setMessage('Category added.');
      await fetchCategories();
      if (res.data?.category?._id) {
        setFormData((f) => ({ ...f, category: res.data.category._id }));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add the category.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!formData.category) {
      setError('Please choose a category (or add one first).');
      return;
    }

    const payload = {
      title: formData.title,
      type: formData.type,
      category: formData.category,
      description: formData.description
    };
    if (formData.type === 'helpline') {
      payload.phone = formData.phone;
      if (formData.url) payload.url = formData.url;
    } else {
      if (formData.url) payload.url = formData.url;
      if (formData.content) payload.content = formData.content;
    }

    try {
      if (editingId) {
        await axios.put(`/api/resources/${editingId}`, payload, authConfig());
        setMessage('Resource updated.');
        setEditingId(null);
      } else {
        await axios.post('/api/resources', payload, authConfig());
        setMessage('Resource added.');
      }
      setFormData({ ...emptyForm, category: formData.category });
      await fetchResources();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the resource.');
    }
  };

  const handleEdit = (item) => {
    setMessage('');
    setError('');
    setEditingId(item._id);
    setFormData({
      title: item.title || '',
      type: item.type || 'article',
      category: item.category || '',
      description: item.description || '',
      url: item.url || '',
      phone: item.phone || '',
      content: item.content || ''
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this resource?')) return;
    setMessage('');
    setError('');
    try {
      await axios.delete(`/api/resources/${id}`, authConfig());
      setMessage('Resource deleted.');
      await fetchResources();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete the resource.');
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <h2>Admin Resource Management</h2>

      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {/* Add category */}
      <div style={{ ...formStyle, marginBottom: '20px' }}>
        <h3>Categories</h3>
        <p style={{ margin: '0 0 10px' }}>
          {categories.length === 0
            ? 'No categories yet. Add one first.'
            : categories.map((c) => c.name).join(', ')}
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="New category name"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="button" onClick={handleAddCategory} style={btnStyle}>
            Add Category
          </button>
        </div>
      </div>

      {/* Create/Edit Resource Form */}
      <form onSubmit={handleSubmit} style={formStyle}>
        <h3>{editingId ? 'Edit Resource' : 'Add New Resource'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <input
            type="text"
            name="title"
            placeholder="Title"
            value={formData.title}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <select name="type" value={formData.type} onChange={handleChange} style={inputStyle}>
            <option value="article">Article (link or text)</option>
            <option value="helpline">Helpline (phone number)</option>
          </select>
          <select name="category" value={formData.category} onChange={handleChange} style={inputStyle}>
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>

          {formData.type === 'helpline' ? (
            <input
              type="text"
              name="phone"
              placeholder="Phone number (required)"
              value={formData.phone}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          ) : (
            <input
              type="url"
              name="url"
              placeholder="Link / URL (or write text below)"
              value={formData.url}
              onChange={handleChange}
              style={inputStyle}
            />
          )}
        </div>

        {formData.type === 'helpline' && (
          <input
            type="url"
            name="url"
            placeholder="Website (optional)"
            value={formData.url}
            onChange={handleChange}
            style={{ ...inputStyle, width: '100%', marginBottom: '10px' }}
          />
        )}

        <textarea
          name="description"
          placeholder="Short description..."
          value={formData.description}
          onChange={handleChange}
          required
          style={{ ...inputStyle, width: '100%', height: '60px', marginBottom: '10px' }}
        />

        {formData.type === 'article' && (
          <textarea
            name="content"
            placeholder="Article text (only needed if there is no link)"
            value={formData.content}
            onChange={handleChange}
            style={{ ...inputStyle, width: '100%', height: '80px', marginBottom: '10px' }}
          />
        )}

        <button type="submit" style={btnStyle}>
          {editingId ? 'Update Resource' : 'Add Resource'}
        </button>
      </form>

      {/* Management Table */}
      <h3>Existing Resources</h3>
      <table style={tableStyle}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={thTdStyle}>Title</th>
            <th style={thTdStyle}>Category</th>
            <th style={thTdStyle}>Type</th>
            <th style={thTdStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {resources.length === 0 ? (
            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '15px' }}>No resources available.</td></tr>
          ) : (
            resources.map((item) => (
              <tr key={item._id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={thTdStyle}>{item.title}</td>
                <td style={thTdStyle}>{categoryName(item.category)}</td>
                <td style={thTdStyle}>{item.type}</td>
                <td style={thTdStyle}>
                  <button onClick={() => handleEdit(item)} style={{ ...actionBtnStyle, background: '#f59e0b' }}>Edit</button>
                  <button onClick={() => handleDelete(item._id)} style={{ ...actionBtnStyle, background: '#ef4444' }}>Delete</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

const formStyle = { background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '30px' };
const inputStyle = { padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' };
const btnStyle = { background: '#10b981', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', marginTop: '10px' };
const thTdStyle = { padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' };
const actionBtnStyle = { color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' };

export default ManageResources;