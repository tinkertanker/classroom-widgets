import { lazy } from 'react';

// Lazy load all widget components
// This ensures each widget is only loaded when actually used

export const LazyWidgets = {
  Randomiser: lazy(() => import('../randomiser/randomiser')),
  Timer: lazy(() => import('../timer/timer')),
  List: lazy(() => import('../list/list')),
  TaskCue: lazy(() => import('../taskCue/taskCue')),
  TrafficLight: lazy(() => import('../trafficLight/trafficLight')),
  AudioVolumeMonitor: lazy(() => import('../volumeLevel/volumeLevel')),
  ShortenLink: lazy(() => import('../shortenLink/shortenLink')),
  TextBanner: lazy(() => import('../textBanner/textBanner')),
  ImageDisplay: lazy(() => import('../imageDisplay/imageDisplay')),
  SoundEffects: lazy(() => import('../soundEffects/soundEffects')),
  Sticker: lazy(() => import('../sticker/sticker')),
  Poll: lazy(() => import('../poll/Poll')),
  QRCodeWidget: lazy(() => import('../qrcode/qrcode')),
  DataShare: lazy(() => import('../dataShare/DataShare')),
  Visualiser: lazy(() => import('../visualiser/visualiser')),
  RTFeedback: lazy(() => import('../rtFeedback/RTFeedback')),
  TicTacToe: lazy(() => import('../ticTacToe/TicTacToe')),
  Questions: lazy(() => import('../questions/Questions'))
};