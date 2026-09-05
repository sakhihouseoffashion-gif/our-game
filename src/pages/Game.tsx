import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Heart, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { PuzzleBoard } from '../components/game/PuzzleBoard';

export function Game() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [session, setSession] = useState<any>(null);
  const [memory, setMemory] = useState<any>(null);
  const [pieces, setPieces] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [gameState, setGameState] = useState<'selecting' | 'playing' | 'completed'>('selecting');

  // Skip cinematic sequence directly to playing
  useEffect(() => {
    if (gameState as any === 'starting_sequence' || gameState as any === 'reveal') {
      setGameState('playing');
    }
  }, [gameState]);

  useEffect(() => {
    if (!roomCode || !user) return;
    fetchGameState();

    const channel = supabase.channel(`game:${roomCode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions' }, payload => {
        fetchGameState();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'puzzle_pieces' }, payload => {
        fetchPieces((payload.new as any).game_session_id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, payload => {
        fetchScores((payload.new as any).game_session_id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomCode, user]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchGameState();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [roomCode, user]);

  const fetchGameState = async () => {
    // 1. Get Room
    const { data: roomData } = await supabase.from('rooms').select('*').eq('room_code', roomCode).single();
    if (!roomData) return;

    // 2. Get active game session
    const { data: sessionData } = await supabase.from('game_sessions').select('*').eq('room_id', roomData.id).order('started_at', { ascending: false }).limit(1).single();
    if (sessionData) {
      setSession(sessionData);
      fetchMemory(sessionData.selected_memory_id);
      fetchPieces(sessionData.id);
      fetchScores(sessionData.id);
      fetchPlayers(roomData.id);
      
      if (sessionData.status === 'completed') {
        navigate(`/result/${roomCode}`);
      } else {
        setGameState(prev => {
          if (prev === 'selecting') {
            return 'playing'; // Go straight to the game immediately
          }
          return prev;
        });
      }
    } else if (roomData.status === 'completed') {
      navigate(`/result/${roomCode}`);
    }
  };

  const fetchMemory = async (memoryId: string) => {
    const { data } = await supabase.from('memories').select('*').eq('id', memoryId).single();
    if (data) setMemory(data);
  };

  const fetchPieces = async (sessionId: string) => {
    const { data, error } = await supabase.from('puzzle_pieces').select('*').eq('game_session_id', sessionId).order('piece_index');
    if (error) console.error('fetchPieces error:', error);
    if (data) setPieces(data);
  };

  const fetchPlayers = async (roomId: string) => {
    const { data } = await supabase.from('room_players').select('*, profiles(name, avatar_url)').eq('room_id', roomId);
    if (data) setPlayers(data);
  };

  const fetchScores = async (sessionId: string) => {
    const { data } = await supabase.from('scores').select('*').eq('game_session_id', sessionId);
    if (data) setScores(data);
  };

  const handlePlacePiece = async (pieceIndex: number, x: number, y: number) => {
    const { data, error } = await supabase.rpc('place_piece', {
      p_session_id: session.id,
      p_piece_index: pieceIndex,
      p_x: x,
      p_y: y
    });
    return data === true;
  };

  const handlePass = async () => {
    await supabase.rpc('pass_turn', { p_session_id: session.id });
  };

  const handleHint = async () => {
    await supabase.rpc('use_hint', { p_session_id: session.id });
    // Maybe highlight correct piece briefly? (requires client-side state, skipping for MVP)
  };

  if (!session) return <div className="min-h-screen flex items-center justify-center"><Heart className="animate-pulse text-primary" size={40} /></div>;

  const isMyTurn = session.current_player_id === user?.id;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <AnimatePresence>
        {gameState === 'selecting' && (
          <motion.div exit={{ opacity: 0 }} className="absolute inset-0 bg-background z-50 flex flex-col items-center justify-center text-center p-6">
            <span className="text-6xl mb-6">🎲</span>
            <h2 className="text-2xl font-serif text-dark mb-4">CHOOSING A MEMORY...</h2>
            <p className="text-muted">Something from your story is coming.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Game UI */}
      {gameState === 'playing' && (
        <div className="w-full max-w-md p-4 flex flex-col flex-1 h-full">
          {/* Header */}
          <div className="flex justify-between items-center mb-8 bg-white/70 p-5 rounded-[2rem] shadow-lg shadow-softpink/20 border-2 border-white backdrop-blur-xl">
            {players.map(p => {
              const pScore = scores.find(s => s.player_id === p.user_id)?.score || 0;
              const isTurn = p.user_id === session.current_player_id;
              
              return (
                <div key={p.id} className={`flex flex-col items-center flex-1 ${isTurn ? 'text-primary' : 'text-muted opacity-80'}`}>
                  <span className="text-xs font-black uppercase tracking-widest mb-2" style={{ letterSpacing: '0.2em' }}>{p.profiles?.name}</span>
                  
                  <div 
                    className={`rounded-full border-2 ${isTurn ? 'bg-primary border-primary shadow-md' : 'bg-white border-softpink'}`}
                    style={{ 
                      padding: '8px 24px', 
                      color: isTurn ? 'white' : '#292326' // text-dark fallback
                    }}
                  >
                    <span className="text-xl font-black">{pScore}</span>
                  </div>
                  
                  {isTurn ? (
                    <motion.div 
                      layoutId="turn-indicator" 
                      className="bg-primary rounded-full shadow-sm font-bold uppercase"
                      style={{ 
                        marginTop: '12px',
                        padding: '4px 12px', 
                        color: 'white',
                        fontSize: '10px',
                        letterSpacing: '0.1em'
                      }}
                    >
                      Your Turn
                    </motion.div>
                  ) : (
                    <div style={{ height: '24px', marginTop: '12px' }} />
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Turn Alert */}
          <div className="text-center mb-4">
             {isMyTurn ? (
               <p className="text-primary font-bold animate-pulse">It's your turn! ❤️</p>
             ) : (
               <p className="text-muted font-medium">Waiting for partner...</p>
             )}
          </div>

          <div className="flex-1 min-h-0 mb-4 flex flex-col justify-center">
            <PuzzleBoard 
              session={session} 
              memory={memory} 
              pieces={pieces} 
              isMyTurn={isMyTurn}
              onPlace={handlePlacePiece}
            />
          </div>

          {/* Controls */}
          <div className="flex justify-between items-center gap-4 pb-4">
            <Button variant="secondary" onClick={handleHint} disabled={!isMyTurn} className="flex-1 gap-2">
              <Sparkles size={18} /> Hint
            </Button>
            <Button variant="outline" onClick={handlePass} disabled={!isMyTurn} className="flex-1">
              Pass Turn
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
