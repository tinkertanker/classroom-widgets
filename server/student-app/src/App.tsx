import React, { useState, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import JoinForm from './components/JoinForm';
import PollActivity from './components/PollActivity';
import DataShareActivity from './components/DataShareActivity';
import './App.css';

export type RoomType = 'poll' | 'dataShare';

const App: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [roomType, setRoomType] = useState<RoomType | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [studentName, setStudentName] = useState('');

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io();
    setSocket(newSocket);

    // Handle room join response
    newSocket.on('room:joined', (data) => {
      // DEBUG: Log room join response
      console.log('Received room:joined event:', data);
      
      if (data.success) {
        setIsJoined(true);
        setRoomType(data.type);
      }
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleJoin = async (code: string, name: string) => {
    try {
      // DEBUG: Log API check
      console.log('Checking if room exists via API...');
      const response = await fetch(`/api/rooms/${code}/exists`);
      const data = await response.json();
      // DEBUG: Log API response
      console.log('Room exists API response:', data);
      
      if (data.exists) {
        if (data.roomType) {
          setRoomCode(code);
          setStudentName(name);
          // DEBUG: Log room type from API
          console.log(`Room exists with type: ${data.roomType}, joining...`);
          // Join with the correct room type
          socket?.emit('room:join', { code, name, type: data.roomType });
        } else {
          // DEBUG: Log room exists but type unknown
          console.log('Room exists but type is unknown:', data);
          throw new Error('Room configuration error');
        }
      } else {
        throw new Error('Invalid room code');
      }
    } catch (error) {
      throw error;
    }
  };

  const handleChangeRoom = () => {
    setIsJoined(false);
    setRoomCode('');
    setRoomType(null);
  };

  if (!isJoined) {
    return <JoinForm onJoin={handleJoin} />;
  }

  return (
    <div className="activity-wrapper">
      {roomType === 'poll' && socket && (
        <PollActivity 
          socket={socket} 
          roomCode={roomCode} 
          onChangeRoom={handleChangeRoom}
        />
      )}
      {roomType === 'dataShare' && socket && (
        <DataShareActivity 
          socket={socket} 
          roomCode={roomCode}
          studentName={studentName}
          onChangeRoom={handleChangeRoom}
        />
      )}
    </div>
  );
};

export default App;