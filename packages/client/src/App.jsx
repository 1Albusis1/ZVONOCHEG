import React, { useState } from 'react';
import './app.css';

export default function App() {
  const [status, setStatus] = useState('');

  async function checkApi() {
    setStatus('Проверяем соединение…');
    try {
      const response = await fetch('/api/health', { signal: AbortSignal.timeout(5000) });
      const health = response.ok && await response.json();
      setStatus(health?.status === 'ok' ? 'API доступен' : 'API недоступен');
    } catch {
      setStatus('API недоступен');
    }
  }

  return (
    <main className="workspace">
      <aside className="sidebar" aria-label="Разделы пространства">
        <strong>Zvonocheg</strong>
        <ul>
          <li>Общие чаты</li>
          <li>Голосовые комнаты</li>
          <li>Личные сообщения</li>
        </ul>
      </aside>
      <section className="content">
        <h1>Локальное пространство</h1>
        <button type="button" onClick={checkApi}>Проверить подключение к API</button>
        <p role="status">{status}</p>
      </section>
    </main>
  );
}
