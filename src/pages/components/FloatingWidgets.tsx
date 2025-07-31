import React from 'react';
import { FaPlay, FaPause, FaMusic } from 'react-icons/fa6';
import { CustomStickerIcons } from '../../features/widgets/sticker/CustomStickerIcons';

export const FloatingWidgets: React.FC = () => {
  return (
    <>
      {/* Timer Widget - Top Left - Hidden on mobile */}
      <div className="hidden md:block fixed top-32 -left-20 md:-left-24 lg:-left-20 rotate-12 opacity-60 hover:opacity-80 transition-all duration-300 hover:translate-x-4 z-0">
        <div className="w-64 bg-gradient-to-br from-terracotta-50 to-terracotta-100 dark:from-warm-gray-800 dark:to-warm-gray-700 rounded-lg shadow-xl border-2 border-terracotta-200 dark:border-terracotta-700 p-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-terracotta-600 dark:text-terracotta-400 mb-2">05:00</div>
            <div className="flex justify-center gap-2">
              <button className="p-2 bg-terracotta-500 text-white rounded-lg shadow-md">
                <FaPlay className="w-4 h-4" />
              </button>
              <button className="p-2 bg-dusty-rose-500 text-white rounded-lg shadow-md">
                <FaPause className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Poll Widget - Top Right - Visible on all screens but pushed further out on mobile */}
      <div className="fixed top-40 -right-32 md:-right-24 -rotate-12 opacity-40 md:opacity-60 hover:opacity-80 transition-all duration-300 hover:translate-x-[-1rem] z-0">
        <div className="w-56 md:w-72 bg-gradient-to-br from-sage-50 to-sage-100 dark:from-warm-gray-800 dark:to-warm-gray-700 rounded-lg shadow-xl border-2 border-sage-200 dark:border-sage-700 p-4">
          <h3 className="font-semibold text-sage-800 dark:text-sage-200 mb-3">Quick Poll</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-sage-100 dark:bg-sage-900/20 rounded-full p-1">
                <div className="h-6 bg-gradient-to-r from-sage-400 to-sage-600 rounded-full shadow-inner" style={{ width: '75%' }}></div>
              </div>
              <span className="text-sm font-bold text-sage-700 dark:text-sage-300">75%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-dusty-rose-100 dark:bg-dusty-rose-900/20 rounded-full p-1">
                <div className="h-6 bg-gradient-to-r from-dusty-rose-400 to-dusty-rose-600 rounded-full shadow-inner" style={{ width: '25%' }}></div>
              </div>
              <span className="text-sm font-bold text-dusty-rose-700 dark:text-dusty-rose-300">25%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stickers - Bottom Left - Hidden on mobile */}
      <div className="hidden md:block fixed bottom-40 -left-16 md:-left-20 rotate-[-8deg] opacity-50 hover:opacity-70 transition-all duration-300 hover:translate-x-3 z-0">
        <div className="flex gap-3">
          <div className="w-20 h-20 bg-gradient-to-br from-dusty-rose-100 to-dusty-rose-200 dark:from-dusty-rose-800 dark:to-dusty-rose-700 rounded-lg shadow-lg flex items-center justify-center border-2 border-dusty-rose-300 dark:border-dusty-rose-600">
            <CustomStickerIcons.heart className="w-12 h-12 text-dusty-rose-600 dark:text-dusty-rose-300" />
          </div>
          <div className="w-20 h-20 bg-gradient-to-br from-terracotta-100 to-terracotta-200 dark:from-terracotta-800 dark:to-terracotta-700 rounded-lg shadow-lg flex items-center justify-center border-2 border-terracotta-300 dark:border-terracotta-600">
            <CustomStickerIcons.star className="w-12 h-12 text-terracotta-600 dark:text-terracotta-300" />
          </div>
        </div>
      </div>

      {/* Q&A Widget - Bottom Right - Visible but smaller and more out of the way on mobile */}
      <div className="fixed bottom-32 -right-28 md:-right-20 rotate-6 opacity-40 md:opacity-60 hover:opacity-80 transition-all duration-300 hover:translate-x-[-0.75rem] z-0">
        <div className="w-48 md:w-64 bg-gradient-to-br from-dusty-rose-50 to-terracotta-50 dark:from-warm-gray-800 dark:to-warm-gray-700 rounded-lg shadow-xl border-2 border-dusty-rose-200 dark:border-dusty-rose-700 p-3 md:p-4">
          <h3 className="font-semibold text-dusty-rose-800 dark:text-dusty-rose-200 mb-2">Questions</h3>
          <div className="space-y-2">
            <div className="p-2 bg-sage-100 dark:bg-sage-900/20 rounded text-sm text-sage-800 dark:text-sage-200 border border-sage-200 dark:border-sage-700">
              "How does photosynthesis work?"
            </div>
            <div className="p-2 bg-terracotta-100 dark:bg-terracotta-900/20 rounded text-sm text-terracotta-800 dark:text-terracotta-200 border border-terracotta-200 dark:border-terracotta-700">
              "Can we have a break?"
            </div>
          </div>
        </div>
      </div>

      {/* Randomizer - Middle Left - Hidden on mobile */}
      <div className="hidden lg:block fixed top-[50%] -left-24 rotate-[-15deg] opacity-50 hover:opacity-70 transition-all duration-300 hover:translate-x-4 z-0">
        <div className="w-48 h-48 bg-gradient-to-br from-sage-100 to-terracotta-100 dark:from-sage-800 dark:to-terracotta-800 rounded-full shadow-xl border-4 border-sage-500 flex items-center justify-center">
          <div className="w-44 h-44 bg-white dark:bg-warm-gray-900 rounded-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-terracotta-600 dark:text-terracotta-400">Student 7</div>
              <div className="text-sm text-sage-600 dark:text-sage-400 mt-1">Selected!</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sound Effect Button - Middle Right - Hidden on mobile */}
      <div className="hidden lg:block fixed top-[45%] -right-16 rotate-12 opacity-50 hover:opacity-70 transition-all duration-300 hover:translate-x-[-0.5rem] z-0">
        <div className="w-32 h-32 bg-gradient-to-br from-dusty-rose-400 to-terracotta-500 rounded-full shadow-xl flex items-center justify-center text-white border-4 border-dusty-rose-300 dark:border-dusty-rose-600">
          <FaMusic className="text-5xl" />
        </div>
      </div>
    </>
  );
};