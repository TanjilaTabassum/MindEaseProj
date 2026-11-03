import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ResourceLibrary = () => {
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [resRes, catRes] = await Promise.all([
        axios.get('/api/resources'),
        axios.get('/api/resources/categories/all')
      ]);
      setResources(resRes.data?.resources || []);
      setCategories(catRes.data?.categories || []);
    } catch (err) {
      setError('Could not load resources right now. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const categoryName = (id) => {
    const found = categories.find((c) => c._id === id);
    return found ? found.name : '';
  };

  const filteredResources = resources.filter((item) => {
    const matchesSearch =
      (item.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h2>MindEase Resource Library</h2>
        <p>Explore verified articles and helplines for mental well-being.</p>
      </header>

      {/* Filter & Search Bar */}
      <div style={filterContainerStyle}>
        <input
          type="text"
          placeholder="Search resources..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={inputStyle}
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={selectStyle}
        >
          <option value="All">All</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
      </div>

      {error && <p style={{ textAlign: 'center', color: 'crimson' }}>{error}</p>}

      {loading ? (
        <p style={{ textAlign: 'center' }}>Loading resources...</p>
      ) : (
        <>
          {!error && filteredResources.length === 0 && (
            <p style={{ textAlign: 'center' }}>No resources found.</p>
          )}
          <div style={gridStyle}>
            {filteredResources.map((resource) => (
              <div key={resource._id} style={cardStyle}>
                <div>
                  <div style={badgeStyle}>{categoryName(resource.category) || 'General'}</div>
                  <h3 style={{ marginTop: '10px' }}>{resource.title}</h3>
                  <p style={{ color: '#555', fontSize: '0.9rem' }}>{resource.description}</p>

                  {resource.type === 'helpline' && resource.phone && (
                    <p style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>Call: {resource.phone}</p>
                  )}

                  {resource.type === 'article' && !resource.url && resource.content && (
                    <details style={{ marginTop: '8px' }}>
                      <summary style={{ cursor: 'pointer', color: '#4f46e5' }}>Read article</summary>
                      <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{resource.content}</p>
                    </details>
                  )}
                </div>
                <div style={cardFooterStyle}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#007bff' }}>
                    [{resource.type}]
                  </span>
                  {resource.url && (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={linkBtnStyle}
                    >
                      {resource.type === 'helpline' ? 'Visit Website' : 'Access Resource'}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// Inline Styles
const containerStyle = { maxWidth: '1000px', margin: '0 auto', padding: '20px' };
const headerStyle = { textAlign: 'center', marginBottom: '30px' };
const filterContainerStyle = { display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' };
const inputStyle = { flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' };
const selectStyle = { padding: '10px', borderRadius: '6px', border: '1px solid #ccc' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' };
const cardStyle = { background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' };
const badgeStyle = { display: 'inline-block', background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' };
const cardFooterStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' };
const linkBtnStyle = { background: '#4f46e5', color: '#fff', padding: '6px 12px', borderRadius: '4px', textDecoration: 'none', fontSize: '0.85rem' };

export default ResourceLibrary;