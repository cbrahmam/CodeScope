/**
 * A deliberately messy React component for testing code review detection.
 * Contains: prop drilling, memory leaks, no memoization, bad patterns.
 */

import React, { useState, useEffect } from 'react';

// No error boundary anywhere in this component tree

function UserDashboard({ user, theme, notifications, onLogout, onUpdateProfile, onDeleteAccount, onChangeTheme, apiUrl, authToken }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [searchResults, setSearchResults] = useState([]);
  const [ws, setWs] = useState(null);

  // Memory leak: setInterval without cleanup
  useEffect(() => {
    setInterval(() => {
      setCount(prev => prev + 1);
      fetch(apiUrl + '/api/heartbeat');
    }, 1000);
  });

  // Missing dependency array causes infinite re-renders
  useEffect(() => {
    setLoading(true);
    fetch(apiUrl + '/api/dashboard', {
      headers: { Authorization: authToken }
    })
      .then(res => res.json())
      .then(result => {
        setData(result);
        setLoading(false);
      });
  });

  // WebSocket connection without cleanup
  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8080');
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      setData(prev => ({ ...prev, messages: [...(prev?.messages || []), msg] }));
    };
    setWs(socket);
    // Missing: return () => socket.close();
  }, []);

  // Expensive computation without useMemo
  const processedData = data ? data.items.filter(item => {
    return item.values.reduce((sum, v) => sum + v, 0) > 100;
  }).map(item => ({
    ...item,
    total: item.values.reduce((sum, v) => sum + v, 0),
    average: item.values.reduce((sum, v) => sum + v, 0) / item.values.length,
    normalized: item.values.map(v => v / Math.max(...item.values)),
  })).sort((a, b) => b.total - a.total) : [];

  // Direct DOM manipulation in React
  const handleSearch = (query) => {
    document.getElementById('search-results').innerHTML = '<p>Loading...</p>';
    fetch(apiUrl + '/api/search?q=' + query)
      .then(res => res.json())
      .then(results => {
        setSearchResults(results);
        document.getElementById('search-results').style.display = 'block';
        document.getElementById('search-count').textContent = results.length + ' results';
      });
  };

  // Callback without useCallback, causes child re-renders
  const handleItemClick = (item) => {
    console.log('clicked', item);
    setData(prev => ({
      ...prev,
      selected: item,
      history: [...(prev?.history || []), item],
    }));
  };

  // State mutation instead of immutable update
  const handleSort = (field) => {
    if (data) {
      data.items.sort((a, b) => a[field] > b[field] ? 1 : -1);
      setData(data);
    }
  };

  // Inline styles everywhere
  return (
    <div style={{ padding: '20px', backgroundColor: theme === 'dark' ? '#1a1a1a' : '#ffffff', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ color: theme === 'dark' ? '#fff' : '#000', fontSize: '24px' }}>
          Dashboard - {user.name}
        </h1>
        <div>
          <span style={{ marginRight: '10px', color: '#888' }}>Heartbeat: {count}</span>
          <button onClick={onLogout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      {/* Prop drilling: passing everything down */}
      <UserProfile
        user={user}
        theme={theme}
        onUpdateProfile={onUpdateProfile}
        onDeleteAccount={onDeleteAccount}
        apiUrl={apiUrl}
        authToken={authToken}
      />

      <NotificationList
        notifications={notifications}
        theme={theme}
        user={user}
        onChangeTheme={onChangeTheme}
        apiUrl={apiUrl}
        authToken={authToken}
      />

      <div>
        <input
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search..."
          style={{ padding: '8px', width: '300px' }}
        />
        <span id="search-count"></span>
        <div id="search-results">
          {/* Using index as key with dynamic list */}
          {searchResults.map((result, index) => (
            <div key={index} onClick={() => handleItemClick(result)} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
              <strong>{result.title}</strong>
              <p>{result.description}</p>
            </div>
          ))}
        </div>
      </div>

      {loading && <p>Loading...</p>}

      <div>
        <button onClick={() => handleSort('name')}>Sort by Name</button>
        <button onClick={() => handleSort('date')}>Sort by Date</button>
      </div>

      {processedData.map((item, index) => (
        <ItemCard
          key={index}
          item={item}
          theme={theme}
          user={user}
          onClick={handleItemClick}
          apiUrl={apiUrl}
          authToken={authToken}
        />
      ))}
    </div>
  );
}

// More prop drilling
function UserProfile({ user, theme, onUpdateProfile, onDeleteAccount, apiUrl, authToken }) {
  return (
    <div style={{ padding: '15px', marginBottom: '20px', backgroundColor: theme === 'dark' ? '#2a2a2a' : '#f5f5f5', borderRadius: '8px' }}>
      <h2 style={{ color: theme === 'dark' ? '#ddd' : '#333' }}>{user.name}</h2>
      <p style={{ color: theme === 'dark' ? '#aaa' : '#666' }}>{user.email}</p>
      <button onClick={() => onUpdateProfile(user)} style={{ marginRight: '10px' }}>Edit Profile</button>
      <button onClick={() => onDeleteAccount(user.id)} style={{ color: 'red' }}>Delete Account</button>
    </div>
  );
}

function NotificationList({ notifications, theme, user, onChangeTheme, apiUrl, authToken }) {
  // Another memory leak
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(apiUrl + '/api/notifications/' + user.id, {
        headers: { Authorization: authToken }
      }).then(res => res.json()).then(data => {
        // Directly modifying props (anti-pattern)
        notifications.push(...data.new);
      });
    }, 5000);
    // Missing cleanup: return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ marginBottom: '20px' }}>
      <h3>Notifications ({notifications.length})</h3>
      {notifications.map((n, i) => (
        <div key={i} style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
          <span dangerouslySetInnerHTML={{ __html: n.message }} />
          <small style={{ color: '#888', marginLeft: '10px' }}>{n.time}</small>
        </div>
      ))}
    </div>
  );
}

function ItemCard({ item, theme, user, onClick, apiUrl, authToken }) {
  return (
    <div
      onClick={() => onClick(item)}
      style={{
        padding: '15px',
        marginBottom: '10px',
        backgroundColor: theme === 'dark' ? '#2a2a2a' : '#fff',
        borderRadius: '8px',
        border: '1px solid ' + (theme === 'dark' ? '#444' : '#ddd'),
        cursor: 'pointer',
      }}
    >
      <h3 style={{ color: theme === 'dark' ? '#fff' : '#000' }}>{item.name}</h3>
      <p style={{ color: theme === 'dark' ? '#aaa' : '#666' }}>Total: {item.total}</p>
      <p style={{ color: theme === 'dark' ? '#aaa' : '#666' }}>Average: {item.average.toFixed(2)}</p>
    </div>
  );
}

export default UserDashboard;
