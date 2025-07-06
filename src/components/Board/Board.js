import React from 'react';

const Board = ({ children, onBoardClick, stickerMode }) => {
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