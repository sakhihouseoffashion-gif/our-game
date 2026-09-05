import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { useAuth } from './hooks/useAuth';
import { Heart } from 'lucide-react';

import { JoinRoom } from './pages/JoinRoom';
import { Lobby } from './pages/Lobby';
import { MemoryCollection } from './pages/MemoryCollection';
import { GameSetup } from './pages/GameSetup';
import { Game } from './pages/Game';
import { Result } from './pages/Result';
import { MemoryBook } from './pages/MemoryBook';

function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Heart className="text-primary animate-pulse" size={48} fill="currentColor" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join" element={<JoinRoom />} />
        <Route path="/join/:roomCode" element={<JoinRoom />} />
        <Route path="/lobby/:roomCode" element={<Lobby />} />
        <Route path="/lobby/:roomCode/setup" element={<GameSetup />} />
        <Route path="/lobby/:roomCode/memories" element={<MemoryCollection />} />
        <Route path="/game/:roomCode" element={<Game />} />
        <Route path="/result/:roomCode" element={<Result />} />
        <Route path="/memory-book" element={<MemoryBook />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
