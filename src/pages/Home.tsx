import React, { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { motion } from 'framer-motion';
import { Heart, BookHeart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) {
      setChecking(false);
      return;
    }
    
    const checkActiveRoom = async () => {
      const { data, error } = await supabase
        .from('room_players')
        .select('room_id, rooms!inner(room_code, status)')
        .eq('user_id', user.id)
        .in('rooms.status', ['waiting', 'playing'])
        .limit(1)
        .maybeSingle();

      if (data && data.rooms) {
        // Supabase returns the joined record as an object for foreign key relations
        const roomData = Array.isArray(data.rooms) ? data.rooms[0] : data.rooms;
        if (roomData.status === 'playing') {
          navigate(`/game/${roomData.room_code}`);
        } else {
          navigate(`/lobby/${roomData.room_code}`);
        }
      } else {
        setChecking(false);
      }
    };
    
    checkActiveRoom();
  }, [user, navigate]);

  const handleCreateRoom = async () => {
    // Generate a random human readable room code e.g. LOVE-7K9P
    const code = `LOVE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data, error } = await supabase
        .from('rooms')
        .insert([{ room_code: code, host_player_id: user.id }])
        .select()
        .single();
        
      if (!error && data) {
        navigate(`/lobby/${data.room_code}`);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      {checking && user ? (
        <div className="z-10 flex flex-col items-center justify-center">
          <Heart className="text-primary animate-pulse mb-4" size={48} fill="currentColor" />
          <p className="text-dark font-medium animate-pulse">Finding your room...</p>
        </div>
      ) : (
        <>
      
      {/* Decorative background elements */}
      <motion.div 
        animate={{ y: [0, -20, 0], opacity: [0.5, 0.8, 0.5] }} 
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute top-20 left-10 text-softpink opacity-50"
      >
        <Heart size={48} fill="currentColor" />
      </motion.div>
      <motion.div 
        animate={{ y: [0, 20, 0], opacity: [0.3, 0.6, 0.3] }} 
        transition={{ duration: 5, repeat: Infinity, delay: 1 }}
        className="absolute bottom-40 right-10 text-softpink opacity-30"
      >
        <Heart size={32} fill="currentColor" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="z-10 max-w-md w-full"
      >
        <div className="mb-8 flex justify-center">
          <Heart className="text-primary animate-pulse" size={40} fill="currentColor" />
        </div>
        
        <h1 className="text-5xl md:text-6xl font-serif text-dark mb-4 tracking-tight">
          OUR MEMORY
          <br />
          GAME
        </h1>
        
        <p className="text-lg text-muted mb-12 max-w-[280px] mx-auto leading-relaxed">
          A little game made from the moments that are ours.
        </p>

        <div className="flex flex-col gap-4 w-full px-4">
          <Button size="lg" onClick={handleCreateRoom} className="w-full text-lg shadow-primary/20">
            Create Private Game
          </Button>
          
          <Button size="lg" variant="secondary" onClick={() => navigate('/join')} className="w-full text-lg">
            Join Game
          </Button>
        </div>

        <div className="mt-16 pt-8 border-t border-softpink/50">
          <Button variant="ghost" onClick={() => navigate('/memory-book')} className="gap-2">
            <BookHeart size={20} />
            Memory Book
          </Button>
        </div>
      </motion.div>
      </>
      )}
    </div>
  );
}
