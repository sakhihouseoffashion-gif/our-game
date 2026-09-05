import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Heart, Trophy, Gift, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { motion } from 'framer-motion';

export function Result() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState<any>(null);
  const [memory, setMemory] = useState<any>(null);
  const [completedMemory, setCompletedMemory] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    if (!roomCode) return;
    const fetchData = async () => {
      const { data: roomData } = await supabase.from('rooms').select('*').eq('room_code', roomCode).single();
      if (!roomData) return;

      const { data: sessionData, error: sessionError } = await supabase.from('game_sessions').select('*').eq('room_id', roomData.id).order('started_at', { ascending: false }).limit(1).single();
      if (sessionError) console.error('Error fetching session:', sessionError);
      
      if (sessionData) {
        setSession(sessionData);
        
        const { data: memData, error: memError } = await supabase.from('memories').select('*').eq('id', sessionData.selected_memory_id).single();
        if (memError) console.error('Error fetching memory:', memError);
        if (memData) setMemory(memData);

        const { data: cmData, error: cmError } = await supabase.from('completed_memories').select('*').eq('game_session_id', sessionData.id).single();
        if (cmError) console.error('Error fetching completed memory:', cmError);
        if (cmData) setCompletedMemory(cmData);
      }

      const { data: pData } = await supabase.from('room_players').select('*, profiles(name, avatar_url)').eq('room_id', roomData.id);
      if (pData) setPlayers(pData);
    };
    
    fetchData();
  }, [roomCode]);

  const handleNext = () => {
    navigate(`/lobby/${roomCode}`);
  };

  if (!session || !completedMemory || !memory) {
    console.log('Result.tsx loading state:', { session: !!session, completedMemory: !!completedMemory, memory: !!memory });
    return <div className="min-h-screen flex items-center justify-center"><Heart className="animate-pulse text-primary" size={40} /></div>;
  }

  const winner = players.find(p => p.user_id === completedMemory.winner_id);
  const p1 = players.find(p => p.user_id === user?.id);
  const p2 = players.find(p => p.user_id !== user?.id);

  const isWinner = winner?.user_id === user?.id;
  const isTie = !winner;
  const isLoser = !isWinner && !isTie;

  const p1Score = p1?.user_id === completedMemory.winner_id ? Math.max(completedMemory.player_1_score, completedMemory.player_2_score) : Math.min(completedMemory.player_1_score, completedMemory.player_2_score);
  const p2Score = p2?.user_id === completedMemory.winner_id ? Math.max(completedMemory.player_1_score, completedMemory.player_2_score) : Math.min(completedMemory.player_1_score, completedMemory.player_2_score);

  return (
    <div className="min-h-screen bg-background text-dark p-6 pt-12 flex flex-col items-center justify-center text-center relative overflow-hidden">
      
      {/* Background heart particles */}
      {Array.from({ length: 15 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ y: '100vh', x: Math.random() * 400 - 200, opacity: 0 }}
          animate={{ y: '-20vh', opacity: [0, 1, 0] }}
          transition={{ duration: 4 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 2 }}
          className="absolute text-primary"
        >
          <Heart size={16 + Math.random() * 20} fill="currentColor" />
        </motion.div>
      ))}

      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8 }} className="z-10 w-full max-w-md flex flex-col items-center">
        
        <h1 className="text-4xl font-serif mb-2">
          {isWinner && 'YOU WIN! ❤️'}
          {isLoser && 'SO SORRY, YOU LOSE 💔'}
          {isTie && "IT'S A TIE! 🤝"}
        </h1>
        <p className="text-muted mb-8 font-medium">
          {isWinner && 'Enjoy Your Reward'}
          {isLoser && `${winner?.profiles?.name} gets the reward`}
          {isTie && 'Nobody gets the reward this time...'}
        </p>

        <motion.div 
          initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.5 }}
          className="w-full bg-white/50 backdrop-blur-md rounded-[2rem] p-8 border border-softpink mb-8 shadow-sm"
        >
          <div className="flex justify-center mb-6">
            <div className="bg-primary/20 p-4 rounded-full">
              <Gift size={48} className="text-primary" />
            </div>
          </div>
          
          <h2 className="text-xl font-bold mb-2">
            {isWinner ? 'YOUR REWARD' : isLoser ? 'THEIR REWARD' : 'THE REWARD'}
          </h2>
          <p className="text-dark/90 text-lg italic font-serif">"{completedMemory.reward_text}"</p>
        </motion.div>

        <div className="flex justify-between items-center w-full mb-12 bg-white/60 backdrop-blur-md rounded-3xl p-6 shadow-sm border border-softpink/30 relative">
          {/* Player 1 */}
          <div className={`flex flex-col items-center flex-1 ${winner?.user_id === p1?.user_id ? 'scale-110 transform transition-transform z-10' : 'opacity-70'}`}>
            <div className="relative mb-2">
              {winner?.user_id === p1?.user_id && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-3 -right-3 bg-yellow-400 text-white rounded-full p-1 shadow-lg z-20">
                  <Trophy size={14} />
                </motion.div>
              )}
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-md border-4 ${winner?.user_id === p1?.user_id ? 'bg-primary border-primary/20 text-white' : 'bg-softpink border-white text-dark'}`}>
                {p1?.profiles?.name?.charAt(0) || '👤'}
              </div>
            </div>
            <span className="font-bold text-sm text-dark truncate max-w-[80px]">{p1?.profiles?.name}</span>
            <span className={`text-4xl font-black mt-1 ${winner?.user_id === p1?.user_id ? 'text-primary' : 'text-dark'}`}>
              {p1Score || completedMemory.player_1_score}
            </span>
          </div>

          {/* VS / Trophy Center */}
          <div className="flex flex-col items-center justify-center px-2">
            <div className="bg-gradient-to-br from-primary/10 to-softpink/30 w-12 h-12 rounded-full flex items-center justify-center mb-2 shadow-inner border border-white">
              <Trophy className="text-primary w-5 h-5" />
            </div>
            <span className="text-[10px] text-primary uppercase font-bold tracking-widest bg-primary/10 px-3 py-1 rounded-full whitespace-nowrap">
              {winner?.profiles?.name ? `${winner.profiles.name} Won` : 'Tie!'}
            </span>
          </div>

          {/* Player 2 */}
          <div className={`flex flex-col items-center flex-1 ${winner?.user_id === p2?.user_id ? 'scale-110 transform transition-transform z-10' : 'opacity-70'}`}>
            <div className="relative mb-2">
              {winner?.user_id === p2?.user_id && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-3 -right-3 bg-yellow-400 text-white rounded-full p-1 shadow-lg z-20">
                  <Trophy size={14} />
                </motion.div>
              )}
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-md border-4 ${winner?.user_id === p2?.user_id ? 'bg-primary border-primary/20 text-white' : 'bg-softpink border-white text-dark'}`}>
                {p2?.profiles?.name?.charAt(0) || '👤'}
              </div>
            </div>
            <span className="font-bold text-sm text-dark truncate max-w-[80px]">{p2?.profiles?.name}</span>
            <span className={`text-4xl font-black mt-1 ${winner?.user_id === p2?.user_id ? 'text-primary' : 'text-dark'}`}>
              {p2Score || completedMemory.player_2_score}
            </span>
          </div>
        </div>

        <div className="w-full max-w-[320px] flex flex-col items-center">
          <Button 
            className="w-full text-lg gap-2 rounded-full py-4 bg-[#DF5B76] hover:bg-[#c94b63] text-dark font-semibold border-none shadow-none" 
            style={{ marginBottom: '16px' }}
            onClick={handleNext}
          >
            Save & Next Memory <ArrowRight size={20} />
          </Button>
          <Button 
            className="w-full text-lg rounded-full py-4 bg-transparent border-2 border-[#DF5B76] text-[#DF5B76] font-semibold hover:bg-[#DF5B76]/10 shadow-none" 
            onClick={() => navigate('/memory-book')}
          >
            View Memory Book
          </Button>
        </div>

      </motion.div>
    </div>
  );
}
