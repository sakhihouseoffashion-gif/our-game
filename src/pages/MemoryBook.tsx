import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Heart, ArrowLeft, Trophy } from 'lucide-react';

export function MemoryBook() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [memories, setMemories] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchMemories = async () => {
      // Get all completed memories where user was part of the room
      const { data } = await supabase
        .from('completed_memories')
        .select(`
          *,
          memory:memory_id(*),
          session:game_session_id(
            room:room_id(
              players:room_players(user_id, profiles(name))
            )
          )
        `)
        .order('completed_at', { ascending: false });
      
      if (data) {
        // Filter those where user is in players
        const userMemories = data.filter((cm: any) => 
          cm.session?.room?.players.some((p: any) => p.user_id === user.id)
        );
        setMemories(userMemories);
      }
    };
    fetchMemories();
  }, [user]);

  return (
    <div className="min-h-screen bg-background p-6 pt-12 relative pb-24">
      <div className="max-w-md mx-auto">
        <div className="flex items-center mb-8 relative">
          <button onClick={() => navigate(-1)} className="absolute left-0 p-2 hover:bg-black/5 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-dark" />
          </button>
          <div className="w-full text-center">
            <h2 className="text-xl font-serif font-bold text-dark">Our Memory Book ❤️</h2>
            <p className="text-sm text-muted">{memories.length} memories played</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {memories.map(cm => {
            const players = cm.session?.room?.players || [];
            const p1 = players[0];
            const p2 = players[1];
            const winner = players.find((p: any) => p.user_id === cm.winner_id);

            return (
              <div key={cm.id} className="bg-white rounded-[2rem] p-4 shadow-sm border border-softpink/30 flex gap-4">
                <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0">
                  <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/memories/${cm.memory?.storage_path}`} alt="Memory" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col justify-center flex-1">
                  <p className="font-semibold text-dark mb-1">Played on {new Date(cm.completed_at).toLocaleDateString()}</p>
                  <p className="text-sm text-muted mb-2">
                    {p1?.profiles?.name} {cm.player_1_score} - {cm.player_2_score} {p2?.profiles?.name}
                  </p>
                  <div className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 w-fit px-2 py-1 rounded-lg">
                    <Trophy size={12} />
                    {winner?.profiles?.name || 'Tie'} won
                  </div>
                </div>
              </div>
            );
          })}
          
          {memories.length === 0 && (
            <div className="text-center py-12 opacity-50">
              <Heart size={48} className="mx-auto mb-4" />
              <p>You haven't played any memories yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
