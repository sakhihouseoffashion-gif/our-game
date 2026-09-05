import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heart, Plus, Trash2, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';

export function MemoryCollection() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [room, setRoom] = useState<any>(null);
  const [memories, setMemories] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!roomCode) return;
    const fetchRoomAndMemories = async () => {
      const { data: roomData } = await supabase.from('rooms').select('*').eq('room_code', roomCode).single();
      if (roomData) {
        setRoom(roomData);
        fetchMemories(roomData.id);
      }
    };
    fetchRoomAndMemories();
  }, [roomCode]);

  const fetchMemories = async (roomId: string) => {
    const { data } = await supabase.from('memories').select('*').eq('room_id', roomId).order('created_at', { ascending: false });
    if (data) setMemories(data);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !room || !user) return;
    
    setUploading(true);
    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${room.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage.from('memories').upload(filePath, file);
      
      if (!uploadError) {
        await supabase.from('memories').insert([{
          room_id: room.id,
          uploaded_by: user.id,
          storage_path: filePath
        }]);
      }
    }
    
    await fetchMemories(room.id);
    setUploading(false);
  };

  const handleDelete = async (id: string, storagePath: string) => {
    await supabase.from('memories').delete().eq('id', id);
    await supabase.storage.from('memories').remove([storagePath]);
    setMemories(memories.filter(m => m.id !== id));
  };

  return (
    <div className="min-h-screen bg-background p-6 pt-12 relative pb-24">
      <div className="max-w-md mx-auto">
        <div className="flex items-center mb-8 relative">
          <button onClick={() => navigate(-1)} className="absolute left-0 p-2 hover:bg-black/5 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-dark" />
          </button>
          <div className="w-full text-center">
            <h2 className="text-xl font-serif font-bold text-dark">Our Memories</h2>
            <p className="text-sm text-muted">{memories.length} Memories</p>
          </div>
        </div>

        <p className="text-center text-sm text-muted mb-8 px-4">
          Add the moments we might get surprised by later.
          <br/>Photos are private to your room.
        </p>

        <div className="grid grid-cols-3 gap-3">
          <AnimatePresence>
            {memories.map((m) => (
              <motion.div 
                key={m.id} 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="aspect-square rounded-2xl overflow-hidden relative group bg-softpink shadow-sm"
              >
                <img 
                  src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/memories/${m.storage_path}`} 
                  alt="Memory" 
                  className="w-full h-full object-cover"
                />
                <button 
                  onClick={() => handleDelete(m.id, m.storage_path)}
                  className="absolute top-1 right-1 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          
          <label className="aspect-square rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/10 transition-colors text-primary relative overflow-hidden">
            {uploading ? (
              <Heart className="animate-pulse" size={24} fill="currentColor" />
            ) : (
              <>
                <Plus size={24} className="mb-1" />
                <span className="text-xs font-semibold">Add More</span>
              </>
            )}
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              onChange={handleFileUpload} 
              className="hidden" 
              disabled={uploading}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
