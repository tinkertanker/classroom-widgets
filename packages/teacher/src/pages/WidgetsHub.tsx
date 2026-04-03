import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FaChartColumn, FaQuestion, FaComments, FaFileLines, FaClock, FaDice, FaListCheck, FaTrafficLight, FaVolumeHigh, FaFont, FaQrcode, FaArrowRight } from 'react-icons/fa6';
import PageLayout from './components/PageLayout';

const interactiveWidgets = [
  {
    icon: FaChartColumn,
    title: 'Live Poll',
    description: 'Create instant polls and watch results roll in as students vote from their devices.',
    href: '/widgets/poll',
    color: 'text-terracotta-500',
  },
  {
    icon: FaQuestion,
    title: 'Q&A',
    description: 'Let students submit questions during class. Mark them answered, delete, or clear all.',
    href: '/widgets/questions',
    color: 'text-sage-500',
  },
  {
    icon: FaComments,
    title: 'Real-Time Feedback',
    description: 'A live difficulty slider so you can see at a glance if the class is following along.',
    href: '/widgets/feedback',
    color: 'text-dusty-rose-500',
  },
  {
    icon: FaFileLines,
    title: 'Handout',
    description: 'Push links and text directly to student devices. No email, no typing URLs.',
    href: '/widgets/handout',
    color: 'text-terracotta-500',
  },
];

const classroomWidgets = [
  { icon: FaClock, title: 'Timer', description: 'Countdown timer with quick-add controls and target-time support.', href: '/widgets/timer' },
  { icon: FaDice, title: 'Randomiser', description: 'Pick a student or item at random with a satisfying animated spin.', href: '/widgets/randomiser' },
  { icon: FaListCheck, title: 'List', description: 'Task list with completion tracking and confetti for the last item.', href: '/widgets/list' },
  { icon: FaTrafficLight, title: 'Traffic Light', description: 'Red / amber / green status indicator for the whole room to see.', href: '/widgets/traffic-light' },
];

const displayWidgets = [
  { icon: FaFont, title: 'Text Banner', description: 'Big bold text on screen — instructions, shoutouts, or anything else.', href: '/widgets/text-banner' },
  { icon: FaQrcode, title: 'QR Code', description: 'Generate a QR code for any link so students can scan and go.', href: '/widgets/qr-code' },
  { icon: FaVolumeHigh, title: 'Sound Effects', description: 'Audio cues to celebrate, warn, or just keep the energy up.', href: '/widgets/sound-effects' },
];

const WidgetsHub: React.FC = () => {
  return (
    <PageLayout>
      <Helmet>
        <title>All Classroom Widgets — Free Teacher Tools | Classroom Widgets</title>
        <meta name="description" content="Browse all free classroom widgets: live polls, Q&A, real-time feedback, handouts, timers, randomisers and more. No login required. Works on any device." />
        <meta property="og:title" content="All Classroom Widgets — Free Teacher Tools" />
        <meta property="og:description" content="Browse all free classroom widgets: live polls, Q&A, real-time feedback, handouts, timers, randomisers and more. No login required." />
        <meta property="og:url" content="https://widgets.tk.sg/widgets" />
        <link rel="canonical" href="https://widgets.tk.sg/widgets" />
      </Helmet>

      {/* Hero */}
      <section className="py-16 px-4 bg-gradient-to-br from-sage-50 to-dusty-rose-50 dark:from-warm-gray-800 dark:to-warm-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-4">
            All the Widgets
          </h2>
          <p className="text-xl text-warm-gray-600 dark:text-warm-gray-400 max-w-2xl mx-auto">
            Free classroom tools that just work. No login, no setup, no subscription — open the app and go.
          </p>
        </div>
      </section>

      {/* Student Interaction */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-2">Student Interaction</h3>
            <p className="text-warm-gray-600 dark:text-warm-gray-400">
              Students join with a 5-character code — no app download, no account needed.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {interactiveWidgets.map((w) => (
              <a
                key={w.href}
                href={w.href}
                className="bg-white dark:bg-warm-gray-700 p-6 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-warm-gray-100 dark:border-warm-gray-600 flex gap-4 group"
              >
                <w.icon className={`text-3xl ${w.color} shrink-0 mt-1`} />
                <div>
                  <h4 className="text-xl font-semibold text-warm-gray-900 dark:text-warm-gray-100 mb-1 group-hover:text-sage-600 dark:group-hover:text-sage-400 flex items-center gap-2">
                    {w.title}
                    <FaArrowRight className="text-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h4>
                  <p className="text-warm-gray-600 dark:text-warm-gray-400 text-sm">{w.description}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Classroom Tools */}
      <section className="py-16 px-4 bg-warm-gray-50 dark:bg-warm-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-2">Classroom Management</h3>
            <p className="text-warm-gray-600 dark:text-warm-gray-400">
              Standalone tools for keeping the room on track.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {classroomWidgets.map((w, i) => (
              <a
                key={w.title}
                href={w.href}
                className="bg-white dark:bg-warm-gray-700 p-6 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-warm-gray-100 dark:border-warm-gray-600 group"
              >
                <w.icon className={`text-2xl mb-3 ${i % 2 === 0 ? 'text-terracotta-500' : 'text-sage-500'}`} />
                <h4 className="font-semibold text-warm-gray-900 dark:text-warm-gray-100 mb-1 group-hover:text-sage-600 dark:group-hover:text-sage-400">{w.title}</h4>
                <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">{w.description}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Display */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-2">Display</h3>
            <p className="text-warm-gray-600 dark:text-warm-gray-400">
              Put things on screen so the whole room can see.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {displayWidgets.map((w, i) => (
              <a
                key={w.title}
                href={w.href}
                className="bg-white dark:bg-warm-gray-700 p-6 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-warm-gray-100 dark:border-warm-gray-600 group"
              >
                <w.icon className={`text-2xl mb-3 ${i % 2 === 0 ? 'text-dusty-rose-500' : 'text-sage-500'}`} />
                <h4 className="font-semibold text-warm-gray-900 dark:text-warm-gray-100 mb-1 group-hover:text-sage-600 dark:group-hover:text-sage-400">{w.title}</h4>
                <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">{w.description}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default WidgetsHub;
