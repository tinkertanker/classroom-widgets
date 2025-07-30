import { brandColors } from './colors';

export const pollColors = [
  {
    bg: brandColors.sage[500],
    bgLight: brandColors.sage[50],
    bgDark: 'dark:bg-sage-900/20',
    border: `border-${brandColors.sage[500]}`,
    borderLight: `border-${brandColors.sage[300]}`,
    borderDark: `dark:border-${brandColors.sage[700]}`,
    hover: 'hover:border-sage-500 hover:bg-sage-50',
    hoverDark: 'dark:hover:bg-sage-900/30',
    text: `text-${brandColors.sage[700]}`,
    textDark: `dark:text-${brandColors.sage[300]}`,
    progress: `bg-${brandColors.sage[500]}`,
    progressLight: `bg-${brandColors.sage[500]}/20`
  },
  {
    bg: brandColors.terracotta[500],
    bgLight: brandColors.terracotta[50],
    bgDark: 'dark:bg-terracotta-900/20',
    border: `border-${brandColors.terracotta[500]}`,
    borderLight: `border-${brandColors.terracotta[300]}`,
    borderDark: `dark:border-${brandColors.terracotta[700]}`,
    hover: 'hover:border-terracotta-500 hover:bg-terracotta-50',
    hoverDark: 'dark:hover:bg-terracotta-900/30',
    text: `text-${brandColors.terracotta[700]}`,
    textDark: `dark:text-${brandColors.terracotta[300]}`,
    progress: `bg-${brandColors.terracotta[500]}`,
    progressLight: `bg-${brandColors.terracotta[500]}/20`
  },
  {
    bg: brandColors.sky[500],
    bgLight: brandColors.sky[50],
    bgDark: 'dark:bg-sky-900/20',
    border: `border-${brandColors.sky[500]}`,
    borderLight: `border-${brandColors.sky[300]}`,
    borderDark: `dark:border-${brandColors.sky[700]}`,
    hover: 'hover:border-sky-500 hover:bg-sky-50',
    hoverDark: 'dark:hover:bg-sky-900/30',
    text: `text-${brandColors.sky[700]}`,
    textDark: `dark:text-${brandColors.sky[300]}`,
    progress: `bg-${brandColors.sky[500]}`,
    progressLight: `bg-${brandColors.sky[500]}/20`
  },
  {
    bg: brandColors.amber[500],
    bgLight: brandColors.amber[50],
    bgDark: 'dark:bg-amber-900/20',
    border: `border-${brandColors.amber[500]}`,
    borderLight: `border-${brandColors.amber[300]}`,
    borderDark: `dark:border-${brandColors.amber[700]}`,
    hover: 'hover:border-amber-500 hover:bg-amber-50',
    hoverDark: 'dark:hover:bg-amber-900/30',
    text: `text-${brandColors.amber[700]}`,
    textDark: `dark:text-${brandColors.amber[300]}`,
    progress: `bg-${brandColors.amber[500]}`,
    progressLight: `bg-${brandColors.amber[500]}/20`
  },
  {
    bg: brandColors.dustyRose[500],
    bgLight: brandColors.dustyRose[50],
    bgDark: 'dark:bg-dusty-rose-900/20',
    border: `border-${brandColors.dustyRose[500]}`,
    borderLight: `border-${brandColors.dustyRose[300]}`,
    borderDark: `dark:border-${brandColors.dustyRose[700]}`,
    hover: 'hover:border-dusty-rose-500 hover:bg-dusty-rose-50',
    hoverDark: 'dark:hover:bg-dusty-rose-900/30',
    text: `text-${brandColors.dustyRose[700]}`,
    textDark: `dark:text-${brandColors.dustyRose[300]}`,
    progress: `bg-${brandColors.dustyRose[500]}`,
    progressLight: `bg-${brandColors.dustyRose[500]}/20`
  }
];

export const getPollColor = (index: number) => {
  return pollColors[index % pollColors.length];
};