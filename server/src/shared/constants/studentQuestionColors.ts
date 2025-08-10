import { brandColors } from './colors';

export const studentQuestionColors = [
  {
    bg: brandColors.sage[50],
    border: brandColors.sage[300],
    text: brandColors.sage[700],
    answeredBg: brandColors.sage[100],
    answeredText: brandColors.sage[600]
  },
  {
    bg: brandColors.terracotta[50],
    border: brandColors.terracotta[300],
    text: brandColors.terracotta[700],
    answeredBg: brandColors.terracotta[100],
    answeredText: brandColors.terracotta[600]
  },
  {
    bg: brandColors.sky[50],
    border: brandColors.sky[300],
    text: brandColors.sky[700],
    answeredBg: brandColors.sky[100],
    answeredText: brandColors.sky[600]
  },
  {
    bg: brandColors.amber[50],
    border: brandColors.amber[300],
    text: brandColors.amber[700],
    answeredBg: brandColors.amber[100],
    answeredText: brandColors.amber[600]
  },
  {
    bg: brandColors.dustyRose[50],
    border: brandColors.dustyRose[300],
    text: brandColors.dustyRose[700],
    answeredBg: brandColors.dustyRose[100],
    answeredText: brandColors.dustyRose[600]
  }
];

export const getStudentQuestionColor = (index: number) => {
  return studentQuestionColors[index % studentQuestionColors.length];
};