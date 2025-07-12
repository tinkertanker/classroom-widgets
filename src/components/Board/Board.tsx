import React from 'react';

interface BoardProps {
  children: React.ReactNode;
  onBoardClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  stickerMode: boolean;
}

const Board: React.FC<BoardProps> = ({ children, onBoardClick, stickerMode }) => {
  return (
    <div className="board-scroll-container">
      <div 
        className="board" 
        id="widget-board"
        onClick={onBoardClick}
        style={{ cursor: stickerMode ? 'crosshair' : 'default' }}
      >
        {children}
      </div>
    </div>
  );
};

export default Board;