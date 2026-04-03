import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FaTrafficLight, FaCheck, FaArrowRight, FaCircle } from 'react-icons/fa6';
import PageLayout from '../components/PageLayout';

const TrafficLightPage: React.FC = () => {
  return (
    <PageLayout>
      <Helmet>
        <title>Traffic Light Widget for Classrooms — Red Amber Green Status | Classroom Widgets</title>
        <meta name="description" content="A simple red, amber, green traffic light for your classroom screen. Signal go, slow down, or stop at a glance — no words needed. Free, no login required." />
        <meta property="og:title" content="Traffic Light Widget | Classroom Widgets" />
        <meta property="og:description" content="Signal go, slow down, or stop to your class with a simple traffic light display. Free classroom tool, no login required." />
        <meta property="og:url" content="https://widgets.tk.sg/widgets/traffic-light" />
        <link rel="canonical" href="https://widgets.tk.sg/widgets/traffic-light" />
      </Helmet>

      <section className="py-16 px-4 bg-gradient-to-br from-sage-50 to-terracotta-50 dark:from-warm-gray-800 dark:to-warm-gray-900">
        <div className="max-w-4xl mx-auto">
          <a href="/widgets" className="text-sm text-warm-gray-500 hover:text-sage-600 transition-colors mb-4 inline-block">← All Widgets</a>
          <div className="flex items-center gap-4 mb-4">
            <FaTrafficLight className="text-5xl text-sage-500" />
            <h2 className="text-4xl font-bold text-warm-gray-900 dark:text-warm-gray-100">Traffic Light</h2>
          </div>
          <p className="text-xl text-warm-gray-600 dark:text-warm-gray-400 max-w-2xl">
            The simplest widget in the box. A red, amber, green traffic light on your classroom screen — click to change colour, no explanation needed.
          </p>
          <a href="/" className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-sage-500 text-white rounded-lg hover:bg-sage-600 transition-colors">
            Try It Free <FaArrowRight />
          </a>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">How to use the Traffic Light</h3>
          <div className="space-y-6">
            {[
              { step: 1, title: 'Launch the Traffic Light widget', body: 'Click Traffic Light in the toolbar. A large traffic light appears on your canvas.' },
              { step: 2, title: 'Click to change colour', body: 'Click the widget to cycle through red, amber, and green. The active colour lights up prominently.' },
              { step: 3, title: 'Students read the signal', body: 'Green means go (start working, quiet working). Amber means slow down or get ready to transition. Red means stop (pause, look at the board).' },
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

      <section className="py-16 px-4 bg-warm-gray-50 dark:bg-warm-gray-800">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">What each colour means</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: FaCircle, color: 'text-green-500', title: 'Green — Go', body: 'Students are working, the class is in flow. Keep going, no interruptions.' },
              { icon: FaCircle, color: 'text-amber-500', title: 'Amber — Slow down', body: 'Wrapping up, getting ready to transition. Students should finish what they\'re doing and look up soon.' },
              { icon: FaCircle, color: 'text-red-500', title: 'Red — Stop', body: 'Whole class attention needed. Pens down, eyes forward.' },
            ].map(({ icon: Icon, color, title, body }) => (
              <div key={title} className="bg-white dark:bg-warm-gray-700 p-6 rounded-lg shadow-sm border border-warm-gray-100 dark:border-warm-gray-600">
                <Icon className={`text-3xl ${color} mb-3`} />
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
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Establish the meaning of each colour with your class early in term — then the widget does the communication for you.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use amber as a 2-minute warning before switching to red for a whole-class pause.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Works particularly well for younger students who respond well to visual, non-verbal cues.</span></li>
          </ul>
        </div>
      </section>
    </PageLayout>
  );
};

export default TrafficLightPage;
