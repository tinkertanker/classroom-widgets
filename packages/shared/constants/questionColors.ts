import { brandColors } from './colors';

export const questionColors = [
  {
    bg: brandColors.sage[100],
    border: brandColors.sage[300],
    text: brandColors.sage[700],
    icon: 'text-sage-600',
    iconHover: 'hover:bg-sage-100',
  },
  {
    bg: brandColors.terracotta[100],
    border: brandColors.terracotta[300],
    text: brandColors.terracotta[700],
    icon: 'text-terracotta-600',
    iconHover: 'hover:bg-terracotta-100',
  },
  {
    bg: brandColors.sky[100],
    border: brandColors.sky[300],
    text: brandColors.sky[700],
    icon: 'text-sky-600',
    iconHover: 'hover:bg-sky-100',
  },
  {
    bg: brandColors.amber[100],
    border: brandColors.amber[300],
    text: brandColors.amber[700],
    icon: 'text-amber-600',
    iconHover: 'hover:bg-amber-100',
  },
  {
    bg: brandColors.dustyRose[100],
    border: brandColors.dustyRose[300],
    text: brandColors.dustyRose[700],
    icon: 'text-dusty-rose-600',
    iconHover: 'hover:bg-dusty-rose-100',
  },
];

export const getQuestionColor = (index: number) => {
  return questionColors[index % questionColors.length];
};