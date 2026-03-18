import React from 'react';
import { FaArrowRight } from 'react-icons/fa6';
import { CustomStickerIcons } from '../../features/widgets/sticker/CustomStickerIcons';

interface PageLayoutProps {
  children: React.ReactNode;
}

const PageLayout: React.FC<PageLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-soft-white dark:bg-warm-gray-900">
      {/* Nav */}
      <nav className="bg-white/80 dark:bg-warm-gray-800/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-warm-gray-200 dark:border-warm-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="/" className="flex items-center gap-3">
              <img src="/logo.png" alt="Classroom Widgets Logo" className="w-10 h-10 object-contain" />
              <div>
                <h1 className="text-xl font-bold text-warm-gray-900 dark:text-warm-gray-100">Classroom Widgets</h1>
                <p className="text-xs text-warm-gray-600 dark:text-warm-gray-400 -mt-1">Swiss Army Knife for Teaching</p>
              </div>
            </a>
            <div className="flex items-center gap-4">
              <a href="/widgets" className="text-sm text-warm-gray-600 dark:text-warm-gray-400 hover:text-sage-600 dark:hover:text-sage-400 transition-colors hidden sm:block">
                All Widgets
              </a>
              <a href="/about" className="text-sm text-warm-gray-600 dark:text-warm-gray-400 hover:text-sage-600 dark:hover:text-sage-400 transition-colors hidden sm:block">
                About
              </a>
              <a href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-sage-500 text-white rounded-lg hover:bg-sage-600 transition-colors text-sm">
                Try It Now
                <FaArrowRight className="text-xs" />
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Page content */}
      {children}

      {/* Footer */}
      <footer className="py-12 px-4 bg-warm-gray-900 dark:bg-warm-gray-950 text-white">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex justify-center gap-4 mb-6 flex-wrap">
            <CustomStickerIcons.fire className="w-10 h-10 text-terracotta-400 animate-pulse" />
            <CustomStickerIcons.star className="w-10 h-10 text-sage-400 animate-spin hidden md:block" style={{ animationDuration: '3s' }} />
            <CustomStickerIcons.heart className="w-10 h-10 text-dusty-rose-400 animate-pulse" style={{ animationDelay: '500ms' }} />
          </div>
          <a href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-sage-500 text-white rounded-lg hover:bg-sage-600 transition-colors mb-6">
            Try Classroom Widgets Free
            <FaArrowRight />
          </a>
          <p className="text-sm text-warm-gray-400 mt-4">
            © {new Date().getFullYear()} Tinkertanker. Free until we figure out Stripe (which may be never).
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PageLayout;
