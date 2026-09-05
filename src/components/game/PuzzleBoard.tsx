import React, { useState, useEffect, useRef } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { supabase } from '../../lib/supabase';

interface PuzzleBoardProps {
  session: any;
  memory: any;
  pieces: any[];
  isMyTurn: boolean;
  onPlace: (pieceIndex: number, x: number, y: number) => Promise<boolean>;
}

export function PuzzleBoard({ session, memory, pieces, isMyTurn, onPlace }: PuzzleBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(3);
  const [optimisticLocks, setOptimisticLocks] = useState<string[]>([]);
  
  useEffect(() => {
    if (session?.difficulty === 'easy') { setCols(3); setRows(3); }
    else if (session?.difficulty === 'medium') { setCols(4); setRows(4); }
    else if (session?.difficulty === 'hard') { setCols(5); setRows(5); }
  }, [session]);

  const imageUrl = memory?.storage_path ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/memories/${memory.storage_path}` : '';
  
  // The available pieces pool (exclude optimistically locked ones)
  const unlockedPieces = pieces.filter(p => !p.locked && !optimisticLocks.includes(p.id));

  const handleDragEnd = async (e: any, info: any, piece: any) => {
    if (!isMyTurn || !containerRef.current) return;
    
    // Calculate drop position relative to grid
    const rect = containerRef.current.getBoundingClientRect();
    const dropX = info.point.x - rect.left;
    const dropY = info.point.y - rect.top;
    
    const cellWidth = rect.width / cols;
    const cellHeight = rect.height / rows;
    
    const gridX = Math.floor(dropX / cellWidth);
    const gridY = Math.floor(dropY / cellHeight);
    
    // Check if within bounds
    if (gridX >= 0 && gridX < cols && gridY >= 0 && gridY < rows) {
      const isCorrect = (gridX === piece.correct_position?.x && gridY === piece.correct_position?.y);
      
      if (isCorrect) {
        // Optimistically lock to instantly move it to the board and stop snap-back animation
        setOptimisticLocks(prev => [...prev, piece.id]);
      }
      
      // Call RPC in background
      onPlace(piece.piece_index, gridX, gridY);
    }
  };

  return (
    <div className="flex flex-col w-full gap-6">
      {/* The Board */}
      <div className="w-full flex justify-center">
        <div 
          ref={containerRef}
          className="w-full max-w-[320px] aspect-square bg-softpink/30 rounded-2xl border-2 border-primary/20 relative overflow-hidden shrink-0 shadow-sm"
        >
          {/* Render grid lines for guidance */}
          <div 
            className="absolute inset-0 grid pointer-events-none opacity-30" 
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
          >
            {Array.from({ length: cols * rows }).map((_, i) => (
              <div key={i} className="border border-white/50" />
            ))}
          </div>

          {/* Render locked pieces */}
          {pieces.filter(p => p.locked || optimisticLocks.includes(p.id)).map(piece => {
            const x = piece.locked ? piece.current_position?.x : piece.correct_position?.x;
            const y = piece.locked ? piece.current_position?.y : piece.correct_position?.y;
            const correctX = piece.correct_position?.x || 0;
            const correctY = piece.correct_position?.y || 0;
            
            return (
              <div
                key={piece.id}
                className="absolute"
                style={{
                  width: `${100 / cols}%`,
                  height: `${100 / rows}%`,
                  left: `${(x / cols) * 100}%`,
                  top: `${(y / rows) * 100}%`,
                  backgroundImage: `url(${imageUrl})`,
                  backgroundSize: `${cols * 100}% ${rows * 100}%`,
                  backgroundPosition: `${(correctX / (cols - 1)) * 100}% ${(correctY / (rows - 1)) * 100}%`,
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)'
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Pieces Pool */}
      <div className="w-full bg-white/50 rounded-2xl border border-softpink/50 p-4 relative shadow-sm">
        <p className="text-xs font-semibold uppercase text-muted text-center mb-4">Drag pieces to board</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {unlockedPieces.map(piece => {
            const correctX = piece.correct_position?.x || 0;
            const correctY = piece.correct_position?.y || 0;
            
            return (
              <motion.div
                key={piece.id}
                drag={isMyTurn}
                dragSnapToOrigin
                onDragEnd={(e, info) => handleDragEnd(e, info, piece)}
                whileDrag={{ scale: 1.1, zIndex: 50 }}
                className={`rounded-md shadow-sm border-2 border-primary/50 cursor-grab active:cursor-grabbing relative shrink-0 ${!isMyTurn ? 'opacity-50' : ''}`}
                style={{
                  width: '56px',
                  height: '56px',
                  backgroundColor: '#ffb3c6', // softpink fallback
                  backgroundImage: imageUrl ? `url(${imageUrl})` : 'none',
                  backgroundSize: `${cols * 100}% ${rows * 100}%`,
                  backgroundPosition: `${(correctX / (cols - 1)) * 100}% ${(correctY / (rows - 1)) * 100}%`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
