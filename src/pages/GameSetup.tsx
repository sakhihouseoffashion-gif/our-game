import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heart, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export function GameSetup() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [room, setRoom] = useState<any>(null);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [rewardText, setRewardText] = useState('Winner chooses our next date ❤️');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!roomCode || !user) return;
    const fetchRoom = async () => {
      const { data } = await supabase.from('rooms').select('*').eq('room_code', roomCode).single();
      if (data) {
        if (data.host_player_id !== user.id) {
          navigate(`/lobby/${roomCode}`); // Only host can setup
        }
        setRoom(data);
        
        // Fetch existing reward if any
        const { data: reward } = await supabase.from('rewards').select('*').eq('room_id', data.id).single();
        if (reward) setRewardText(reward.reward_text);
      }
    };
    fetchRoom();
  }, [roomCode, user, navigate]);

  const handleSave = async () => {
    if (!room) return;
    setSaving(true);
    
    // Save reward
    const { data: existingReward } = await supabase.from('rewards').select('id').eq('room_id', room.id).single();
    if (existingReward) {
      await supabase.from('rewards').update({ reward_text: rewardText }).eq('id', existingReward.id);
    } else {
      await supabase.from('rewards').insert([{ room_id: room.id, reward_text: rewardText }]);
    }

    // Save difficulty (we'll store it in game_sessions or a new column on rooms)
    // For now, let's just pass it along or save it to local storage as default
    localStorage.setItem(`omg_difficulty_${room.id}`, difficulty);

    setSaving(false);
    navigate(`/lobby/${roomCode}`);
  };

  return (
    <div className="min-h-screen bg-background p-6 pt-12 relative flex flex-col items-center">
      <div className="w-full max-w-md">
        <div className="flex items-center mb-8 relative">
          <button onClick={() => navigate(-1)} className="absolute left-0 p-2 hover:bg-black/5 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-dark" />
          </button>
          <div className="w-full text-center">
            <h2 className="text-xl font-serif font-bold text-dark">Game Setup</h2>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-sm font-semibold text-dark mb-4 uppercase tracking-wider">Puzzle Difficulty</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'easy', label: 'Easy', pieces: '9 pieces' },
              { id: 'medium', label: 'Medium', pieces: '16 pieces' },
              { id: 'hard', label: 'Hard', pieces: '25 pieces' },
            ].map(d => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id as any)}
                className={`p-4 rounded-xl border-2 flex flex-col items-center transition-all ${
                  difficulty === d.id ? 'border-primary bg-primary/5 text-primary' : 'border-softpink bg-white text-muted hover:border-primary/50'
                }`}
              >
                <span className="font-semibold mb-1">{d.label}</span>
                <span className="text-xs">{d.pieces}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <h3 className="text-sm font-semibold text-dark mb-4 uppercase tracking-wider">Winner Reward <Heart className="inline text-primary w-4 h-4" /></h3>
          <input
            type="text"
            value={rewardText}
            onChange={(e) => setRewardText(e.target.value)}
            className="w-full px-4 py-4 rounded-xl border-2 border-softpink bg-white text-dark focus:outline-none focus:border-primary/50"
            placeholder="What does the winner get?"
          />
        </div>

        <Button size="lg" onClick={handleSave} disabled={saving} className="w-full text-lg shadow-lg shadow-primary/20">
          Save & Continue
        </Button>
      </div>
    </div>
  );
}
