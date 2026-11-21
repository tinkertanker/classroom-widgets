import { FaHeadphones, FaSun, FaLeaf, FaMugHot } from 'react-icons/fa6';
import type { IconType } from 'react-icons';

// All tracks are CC0 1.0 from FreePD.com; tracks/CREDITS.md records each source.
import studyAndRelax from './tracks/study-and-relax.mp3';
import citySunshine from './tracks/city-sunshine.mp3';
import funshine from './tracks/funshine.mp3';
import freshFocus from './tracks/fresh-focus.mp3';
import wisdomInTheSun from './tracks/wisdom-in-the-sun.mp3';
import connectingRainbows from './tracks/connecting-rainbows.mp3';
import fakeItTilYouFakeIt from './tracks/fake-it-til-you-fake-it.mp3';
import nightInVenice from './tracks/night-in-venice.mp3';

export type MoodId = 'chill' | 'upbeat' | 'calm' | 'jazz';

export interface Track {
  title: string;
  artist: string;
  src: string;
}

export interface Mood {
  id: MoodId;
  label: string;
  description: string;
  icon: IconType;
  /** Tailwind classes for the selected mood button. */
  selectedClass: string;
  tracks: Track[];
}

export const moods: Mood[] = [
  {
    id: 'chill',
    label: 'Chill',
    description: 'Lo-fi beats',
    icon: FaHeadphones,
    selectedClass: 'bg-slate-blue-500 border-slate-blue-600 text-white',
    tracks: [
      { title: 'Study and Relax', artist: 'Kevin MacLeod', src: studyAndRelax },
      { title: 'City Sunshine', artist: 'Kevin MacLeod', src: citySunshine }
    ]
  },
  {
    id: 'upbeat',
    label: 'Upbeat',
    description: 'Sunny tunes',
    icon: FaSun,
    selectedClass: 'bg-amber-600 border-amber-700 text-white',
    tracks: [
      { title: 'Funshine', artist: 'Kevin MacLeod', src: funshine },
      { title: 'Fresh Focus', artist: 'Kevin MacLeod', src: freshFocus }
    ]
  },
  {
    id: 'calm',
    label: 'Calm',
    description: 'Soft guitar',
    icon: FaLeaf,
    selectedClass: 'bg-sage-500 border-sage-600 text-white',
    tracks: [
      { title: 'Wisdom in the Sun', artist: 'Kevin MacLeod', src: wisdomInTheSun },
      { title: 'Connecting Rainbows', artist: 'Kevin MacLeod', src: connectingRainbows }
    ]
  },
  {
    id: 'jazz',
    label: 'Jazz café',
    description: 'Easy swing',
    icon: FaMugHot,
    selectedClass: 'bg-terracotta-500 border-terracotta-600 text-white',
    tracks: [
      { title: 'Fake It Til You Fake It', artist: 'Kevin MacLeod', src: fakeItTilYouFakeIt },
      { title: 'Night in Venice', artist: 'Kevin MacLeod', src: nightInVenice }
    ]
  }
];

export const getMood = (id: MoodId): Mood => moods.find(mood => mood.id === id) ?? moods[0];
