import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FaVolumeHigh, FaCheck, FaArrowRight, FaMusic, FaTableCells } from 'react-icons/fa6';
import PageLayout from '../components/PageLayout';

const SoundEffectsPage: React.FC = () => {
  return (
    <PageLayout>
      <Helmet>
        <title>Sound Effects Widget for Classrooms — Audio Cues for Teachers | Classroom Widgets</title>
        <meta name="description" content="A grid of sound effect buttons for your classroom. Celebrate achievements, signal transitions, or just keep the energy up. Free classroom audio tool." />
        <meta property="og:title" content="Sound Effects Widget for Classrooms | Classroom Widgets" />
        <meta property="og:description" content="A grid of sound effect buttons for your classroom. Celebrate achievements, signal transitions, or keep energy high. Free, no login required." />
        <meta property="og:url" content="https://widgets.tk.sg/widgets/sound-effects" />
        <link rel="canonical" href="https://widgets.tk.sg/widgets/sound-effects" />
      </Helmet>

      <section className="py-16 px-4 bg-gradient-to-br from-dusty-rose-50 to-sage-50 dark:from-warm-gray-800 dark:to-warm-gray-900">
        <div className="max-w-4xl mx-auto">
          <a href="/widgets" className="text-sm text-warm-gray-500 hover:text-sage-600 transition-colors mb-4 inline-block">← All Widgets</a>
          <div className="flex items-center gap-4 mb-4">
            <FaVolumeHigh className="text-5xl text-dusty-rose-500" />
            <h2 className="text-4xl font-bold text-warm-gray-900 dark:text-warm-gray-100">Sound Effects</h2>
          </div>
          <p className="text-xl text-warm-gray-600 dark:text-warm-gray-400 max-w-2xl">
            A grid of audio cue buttons at your fingertips. Applause for a great answer, a drumroll for a reveal, a buzzer for time's up — add a bit of theatre to your classroom.
          </p>
          <a href="/" className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-dusty-rose-500 text-white rounded-lg hover:bg-dusty-rose-600 transition-colors">
            Try It Free <FaArrowRight />
          </a>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">How to use Sound Effects</h3>
          <div className="space-y-6">
            {[
              { step: 1, title: 'Launch the Sound Effects widget', body: 'Click Sound Effects in the toolbar. A responsive grid of audio buttons appears on your canvas.' },
              { step: 2, title: 'Click a button to play', body: 'Each button plays a different sound effect. Click any time — mid-sentence, mid-activity, whenever the moment calls for it.' },
              { step: 3, title: 'Use keyboard shortcuts', body: 'When the widget is focused, press 1–9 and 0 to trigger the first 10 sounds by keyboard — no need to click.' },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex gap-4">
                <div className="w-10 h-10 bg-dusty-rose-500 text-white rounded-full flex items-center justify-center font-bold shrink-0">{step}</div>
                <div>
                  <h4 className="font-semibold text-warm-gray-900 dark:text-warm-gray-100 mb-1">{title}</h4>
                  <p className="text-warm-gray-600 dark:text-warm-gray-400">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-warm-gray-50 dark:bg-warm-gray-800">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">Features</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: FaTableCells, title: 'Responsive grid', body: 'Buttons lay out in a responsive grid — resize the widget and it adapts so all buttons stay accessible.' },
              { icon: FaMusic, title: 'Variety of sounds', body: 'From applause to buzzers to drumrolls — sounds for celebrating, warning, and signalling transitions.' },
              { icon: FaCheck, title: 'Keyboard shortcuts', body: 'Focus the widget and press 1–9, 0 to trigger sounds by keyboard. Keep your hands free while teaching.' },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white dark:bg-warm-gray-700 p-6 rounded-lg shadow-sm border border-warm-gray-100 dark:border-warm-gray-600">
                <Icon className="text-xl text-dusty-rose-500 mb-3" />
                <h4 className="font-semibold text-warm-gray-900 dark:text-warm-gray-100 mb-1">{title}</h4>
                <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-6">Tips</h3>
          <ul className="space-y-3 text-warm-gray-600 dark:text-warm-gray-400">
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use applause when a student gives a great answer — it's more fun than just saying "well done".</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use the buzzer as a "time's up" signal alongside the Timer widget for a more dramatic end.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use a drumroll before revealing a Randomiser result to build suspense.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use keyboard shortcuts so you can trigger sounds mid-explanation without breaking your flow.</span></li>
          </ul>
        </div>
      </section>
    </PageLayout>
  );
};

export default SoundEffectsPage;
