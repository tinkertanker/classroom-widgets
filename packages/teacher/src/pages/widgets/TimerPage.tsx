import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FaClock, FaCheck, FaArrowRight, FaPlus, FaBullseye, FaVolumeHigh } from 'react-icons/fa6';
import PageLayout from '../components/PageLayout';

const TimerPage: React.FC = () => {
  return (
    <PageLayout>
      <Helmet>
        <title>Classroom Timer Widget — Countdown Timer for Teachers | Classroom Widgets</title>
        <meta name="description" content="A visual countdown timer for your classroom. Quick-add controls, target clock time, sound alerts, and state that survives page reloads. Free, no login." />
        <meta property="og:title" content="Classroom Timer Widget | Classroom Widgets" />
        <meta property="og:description" content="A visual countdown timer for your classroom. Quick-add controls, target clock time, sound alerts, and state that survives page reloads. Free." />
        <meta property="og:url" content="https://widgets.tk.sg/widgets/timer" />
        <link rel="canonical" href="https://widgets.tk.sg/widgets/timer" />
      </Helmet>

      {/* Hero */}
      <section className="py-16 px-4 bg-gradient-to-br from-sage-50 to-terracotta-50 dark:from-warm-gray-800 dark:to-warm-gray-900">
        <div className="max-w-4xl mx-auto">
          <a href="/widgets" className="text-sm text-warm-gray-500 hover:text-sage-600 transition-colors mb-4 inline-block">← All Widgets</a>
          <div className="flex items-center gap-4 mb-4">
            <FaClock className="text-5xl text-sage-500" />
            <h2 className="text-4xl font-bold text-warm-gray-900 dark:text-warm-gray-100">Timer</h2>
          </div>
          <p className="text-xl text-warm-gray-600 dark:text-warm-gray-400 max-w-2xl">
            A large visual countdown timer the whole class can see. Set a time, start it, and get back to teaching — the timer handles the rest.
          </p>
          <a href="/" className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-sage-500 text-white rounded-lg hover:bg-sage-600 transition-colors">
            Try It Free <FaArrowRight />
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">How to use the timer</h3>
          <div className="space-y-6">
            {[
              { step: 1, title: 'Launch the Timer widget', body: 'Click Timer in the toolbar. A large circular timer appears on your canvas.' },
              { step: 2, title: 'Set the time', body: 'Click any segment of the time display (hours, minutes, seconds) to edit it. Type the value and press Tab or Enter to confirm.' },
              { step: 3, title: 'Start', body: 'Hit the play button. The rainbow arc counts down and a hamster runs along it. Students love it.' },
              { step: 4, title: 'Adjust on the fly', body: 'Use the quick-add tray (+1m, +2m, +5m) to add time without stopping. Or open the target time tray to count down to a specific clock time like 2:30 PM.' },
              { step: 5, title: 'When time is up', body: 'The timer plays a sound and the display shakes. Click restart to run it again with the same duration.' },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex gap-4">
                <div className="w-10 h-10 bg-sage-500 text-white rounded-full flex items-center justify-center font-bold shrink-0">{step}</div>
                <div>
                  <h4 className="font-semibold text-warm-gray-900 dark:text-warm-gray-100 mb-1">{title}</h4>
                  <p className="text-warm-gray-600 dark:text-warm-gray-400">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-warm-gray-50 dark:bg-warm-gray-800">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">Features</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: FaPlus, title: 'Quick-add controls', body: 'Add 1, 2, or 5 minutes with a single tap — without stopping the timer or losing your flow.' },
              { icon: FaBullseye, title: 'Target clock time', body: 'Count down to a specific time of day (e.g. "until 2:30 PM") instead of setting a duration manually.' },
              { icon: FaVolumeHigh, title: 'Sound modes', body: 'Choose from quiet (no sound), short beep, or long chime when the timer ends. Cycle through with the speaker button.' },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white dark:bg-warm-gray-700 p-6 rounded-lg shadow-sm border border-warm-gray-100 dark:border-warm-gray-600">
                <Icon className="text-xl text-sage-500 mb-3" />
                <h4 className="font-semibold text-warm-gray-900 dark:text-warm-gray-100 mb-1">{title}</h4>
                <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-6">Tips for using the timer</h3>
          <ul className="space-y-3 text-warm-gray-600 dark:text-warm-gray-400">
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use the target time feature at the start of class — "we're working until 2:30" is clearer than "you have 23 minutes".</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Pair the timer with the Handout widget — share the task link and start the countdown together.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>The timer state persists through page reloads — if you accidentally refresh, it picks up where it left off.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Run multiple timers simultaneously on the canvas for group activities with different time limits.</span></li>
          </ul>
        </div>
      </section>
    </PageLayout>
  );
};

export default TimerPage;
