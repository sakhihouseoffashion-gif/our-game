import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heart, Copy, Share, Image as ImageIcon } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export function Lobby() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [memoryCount, setMemoryCount] = useState(0);

  useEffect(() => {
    if (!roomCode || !user) return;

    const fetchRoom = async () => {
      const { data: roomData } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', roomCode)
        .single();
      
      if (roomData) {
        if (roomData.status === 'playing') {
          navigate(`/game/${roomCode}`);
          return;
        }
        setRoom(roomData);
        // Ensure user is in room_players
        const { data: existingPlayer } = await supabase
          .from('room_players')
          .select('*')
          .eq('room_id', roomData.id)
          .eq('user_id', user.id)
          .maybeSingle();
          
        if (!existingPlayer) {
          const role = roomData.host_player_id === user.id ? 'host' : 'guest';
          await supabase.from('room_players').upsert([
            { room_id: roomData.id, user_id: user.id, role, display_name: profile?.name }
          ], { onConflict: 'room_id,user_id', ignoreDuplicates: true });
        }
        
        fetchPlayers(roomData.id);
        fetchMemoryCount(roomData.id);
      }
    };
    
    fetchRoom();
    
    // Subscribe to room_players and memories changes
    const channel = supabase.channel(`room:${roomCode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players' }, () => {
        fetchRoom(); // Better to re-fetch room completely to be safe
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memories' }, () => {
        fetchRoom();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms' }, () => {
        fetchRoom(); // Safest way to check status without relying on incomplete payload fields
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, user, profile, navigate]); // Removed room from deps to prevent channel thrashing

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && room) {
        // Force refresh when coming back from background
        fetchPlayers(room.id);
        fetchMemoryCount(room.id);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [room]);

  const fetchPlayers = async (roomId: string) => {
    const { data } = await supabase
      .from('room_players')
      .select('*, profiles(name, avatar_url)')
      .eq('room_id', roomId);
    if (data) setPlayers(data);
  };

  const fetchMemoryCount = async (roomId: string) => {
    const { count } = await supabase.from('memories').select('*', { count: 'exact', head: true }).eq('room_id', roomId);
    setMemoryCount(count || 0);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${roomCode}`);
    alert('Link copied!');
  };

  const startGame = async () => {
    if (room && players.length === 2 && memoryCount > 0) {
      const difficulty = localStorage.getItem(`omg_difficulty_${room.id}`) || 'medium';
      const { data, error } = await supabase.rpc('start_game', { p_room_id: room.id, p_difficulty: difficulty });
      
      if (error) {
        console.error("Start Game Error:", error);
        alert(`Failed to start game: ${error.message}`);
      } else {
        // Force navigation immediately, don't just rely on the realtime event
        navigate(`/game/${roomCode}`);
      }
    }
  };

  const isHost = room?.host_player_id === user?.id;
  const isReady = players.length === 2;

  if (!room) return <div className="p-8 text-center flex items-center justify-center min-h-screen"><Heart className="animate-pulse text-primary" size={40} fill="currentColor" /></div>;

  return (
    <div className="min-h-screen flex flex-col items-center p-6 pt-12 relative bg-background">
      {isHost && (
        <button onClick={() => navigate(`/lobby/${roomCode}/setup`)} className="absolute top-6 right-6 p-2 text-dark hover:bg-black/5 rounded-full transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      )}
      <div className="w-full max-w-md flex flex-col items-center text-center">
        <h2 className="text-xl font-medium text-dark mb-8 tracking-wide">
          {isHost ? 'Create Private Game' : 'Lobby'}
        </h2>
        
        <Heart className="text-primary animate-pulse mb-6" size={48} fill="currentColor" />
        
        {isHost && !isReady ? (
          <>
            <p className="text-dark mb-4">Your private room is ready!</p>
            <div className="bg-white rounded-xl shadow-sm border border-softpink/30 px-8 py-4 mb-6">
              <span className="text-4xl font-bold tracking-widest text-dark">{roomCode}</span>
            </div>
            <p className="text-sm text-muted mb-8">Only you two can enter this game.</p>
            
            <div className="flex flex-col gap-4 w-full">
              <Button onClick={handleCopyLink} className="w-full gap-2 text-lg">
                <Copy size={20} /> Copy Game Link
              </Button>
              <Button variant="secondary" className="w-full gap-2 text-lg">
                <Share size={20} /> Share Link
              </Button>
            </div>
            
            <div className="mt-12 flex items-center justify-center gap-4 text-primary">
              <Heart size={16} />
              <span className="text-sm font-medium">Waiting for your person...</span>
              <Heart size={16} />
            </div>
          </>
        ) : (
          <>
            <p className="text-muted mb-8 font-medium">{roomCode}</p>
            <div className="flex justify-center items-center w-full gap-8 mb-12">
              {players.map((p, i) => (
                <div key={p.id} className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-softpink overflow-hidden border-2 border-white shadow-md mb-3 flex items-center justify-center text-2xl">
                    {p.profiles?.name?.charAt(0) || '👤'}
                  </div>
                  <span className="font-semibold text-dark">{p.profiles?.name || p.display_name}</span>
                  <span className="text-xs text-primary/80 font-medium">{p.role === 'host' ? 'Host' : 'Ready'}</span>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-muted">Ready</span>
                  </div>
                </div>
              ))}
              {players.length === 1 && (
                <div className="flex flex-col items-center opacity-50">
                  <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 mb-3 flex items-center justify-center">
                    <Heart size={24} className="text-gray-400" />
                  </div>
                  <span className="font-medium text-gray-500">Waiting...</span>
                </div>
              )}
            </div>
            
            <div className="text-center w-full mb-8 border-t border-softpink/50 pt-8 flex flex-col items-center">
              <p className="text-dark font-medium mb-2">{players.length} / 2 Players Ready</p>
              <p className="text-sm text-muted mb-4">
                {memoryCount > 0 ? `${memoryCount} memories are waiting...` : 'Your memories are waiting...'}
              </p>
              
              <Button variant="outline" size="sm" onClick={() => navigate(`/lobby/${roomCode}/memories`)} className="gap-2 rounded-full">
                <ImageIcon size={16} /> Manage Memories
              </Button>
            </div>
            
            {isHost && isReady && (
              <Button 
                size="lg" 
                onClick={startGame} 
                className={`w-full text-lg ${memoryCount > 0 ? 'animate-bounce-short' : 'opacity-50 cursor-not-allowed'}`}
                disabled={memoryCount === 0}
              >
                {memoryCount === 0 ? 'Upload a memory first' : 'Start Game'}
              </Button>
            )}
            {!isHost && !isReady && (
              <p className="text-primary font-medium animate-pulse">Waiting for host...</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
