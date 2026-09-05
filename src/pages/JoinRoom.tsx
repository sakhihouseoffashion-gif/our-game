import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export function JoinRoom() {
  const { roomCode } = useParams<{ roomCode?: string }>();
  const [code, setCode] = useState(roomCode || '');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleJoin = async () => {
    if (!code || !name) return;
    setError('');

    const { data: room } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_code', code.toUpperCase())
      .single();

    if (!room) {
      setError('Room not found.');
      return;
    }

    const { count } = await supabase
      .from('room_players')
      .select('*', { count: 'exact' })
      .eq('room_id', room.id);

    if (count && count >= 2) {
      // Check if we are already in it
      const { data: me } = await supabase.from('room_players').select('*').eq('room_id', room.id).eq('user_id', user?.id).single();
      if (!me) {
        setError('This game already has two players.');
        return;
      }
    }

    // Update profile
    if (user) {
      await supabase.from('profiles').update({ name }).eq('id', user.id);
    }
    
    navigate(`/lobby/${code.toUpperCase()}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
      <div className="max-w-md w-full bg-white/50 backdrop-blur-md rounded-[2rem] shadow-sm p-8 border border-softpink/30 flex flex-col items-center text-center">
        <h2 className="text-2xl font-serif text-dark mb-4">You've been invited!</h2>
        
        <div className="w-full h-48 bg-softpink rounded-2xl mb-6 flex items-center justify-center overflow-hidden relative">
          {/* Decorative image placeholder */}
          <img src="https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&q=80&w=400" alt="Couple" className="absolute inset-0 w-full h-full object-cover opacity-80 mix-blend-multiply" />
        </div>

        <p className="text-dark font-medium mb-6">
          Surprise memories are waiting for you <Heart className="inline text-primary" size={16} fill="currentColor" />
        </p>

        <div className="w-full flex flex-col gap-4">
          {!roomCode && (
            <input 
              type="text" 
              placeholder="Room Code" 
              value={code} 
              onChange={e => setCode(e.target.value.toUpperCase())}
              className="w-full px-6 py-4 rounded-xl border border-softpink bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 font-bold tracking-widest text-center"
            />
          )}
          <input 
            type="text" 
            placeholder="Enter Your Name" 
            value={name} 
            onChange={e => setName(e.target.value)}
            className="w-full px-6 py-4 rounded-xl border border-softpink bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button size="lg" onClick={handleJoin} className="w-full text-lg mt-2">
            Join Game
          </Button>
        </div>
      </div>
    </div>
  );
}
