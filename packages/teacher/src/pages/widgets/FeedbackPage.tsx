import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FaGauge, FaCheck, FaArrowRight, FaMobileScreen, FaChartBar, FaSliders } from 'react-icons/fa6';
import PageLayout from '../components/PageLayout';

const FeedbackPage: React.FC = () => {
  return (
    <PageLayout>
      <Helmet>
        <title>Real-Time Student Feedback Widget — Gauge Difficulty Live | Classroom Widgets</title>
        <meta name="description" content="See instantly if your class is keeping up. Students slide a difficulty gauge from Too Easy to Too Hard, and you see the live distribution. Free, no login." />
        <meta property="og:title" content="Real-Time Student Feedback Widget | Classroom Widgets" />
        <meta property="og:description" content="See instantly if your class is keeping up. Students slide a difficulty gauge and you see the live distribution. Free, no login required." />
        <meta property="og:url" content="https://widgets.tk.sg/widgets/feedback" />
        <link rel="canonical" href="https://widgets.tk.sg/widgets/feedback" />
      </Helmet>

      {/* Hero */}
      <section className="py-16 px-4 bg-gradient-to-br from-dusty-rose-50 to-sage-50 dark:from-warm-gray-800 dark:to-warm-gray-900">
        <div className="max-w-4xl mx-auto">
          <a href="/widgets" className="text-sm text-warm-gray-500 hover:text-sage-600 transition-colors mb-4 inline-block">
            ← All Widgets
          </a>
          <div className="flex items-center gap-4 mb-4">
            <FaGauge className="text-5xl text-dusty-rose-500" />
            <h2 className="text-4xl font-bold text-warm-gray-900 dark:text-warm-gray-100">Real-Time Feedback</h2>
          </div>
          <p className="text-xl text-warm-gray-600 dark:text-warm-gray-400 max-w-2xl">
            A live difficulty gauge that tells you exactly how the class is feeling — without anyone having to raise their hand or say a word.
          </p>
          <a href="/" className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-dusty-rose-500 text-white rounded-lg hover:bg-dusty-rose-600 transition-colors">
            Try It Free <FaArrowRight />
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">How to collect real-time feedback</h3>
          <div className="space-y-6">
            {[
              { step: 1, title: 'Launch RT Feedback', body: 'Click RT Feedback in the toolbar. The widget opens showing an empty histogram.' },
              { step: 2, title: 'Share the session code', body: 'Students visit your Classroom Widgets URL and enter the 5-character session code. Works on any device.' },
              { step: 3, title: 'Start feedback collection', body: 'Click "Start feedback". Students immediately see the slider on their device.' },
              { step: 4, title: 'Read the histogram', body: 'As students adjust their sliders, a bar chart updates in real-time on your screen showing the distribution across 5 levels: Too Easy → Too Hard.' },
              { step: 5, title: 'Adjust your teaching', body: 'If the bars cluster on the right, slow down. If they\'re all on the left, push forward. Clear and repeat any time.' },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex gap-4">
                <div className="w-10 h-10 bg-dusty-rose-500 text-white rounded-full flex items-center justify-center font-bold shrink-0">
                  {step}
                </div>
                <div>
                  <h4 className="font-semibold text-warm-gray-900 dark:text-warm-gray-100 mb-1">{title}</h4>
                  <p className="text-warm-gray-600 dark:text-warm-gray-400">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Student experience */}
      <section className="py-16 px-4 bg-warm-gray-50 dark:bg-warm-gray-800">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <FaMobileScreen className="text-2xl text-dusty-rose-500" />
            <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100">What students see</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { icon: FaSliders, title: 'A simple slider', body: 'Students see a single slider on a colour gradient — green for easy, red for hard. They drag it to where they are and let go. Done.' },
              { icon: FaGauge, title: 'Labelled levels', body: 'Five labels — Too Easy, Easy, Just Right, Hard, Too Hard — make it clear what the scale means. No ambiguity.' },
              { icon: FaChartBar, title: 'Continuous updates', body: 'The slider sends feedback whenever released. Students can update it as the lesson progresses — it\'s not a one-shot response.' },
              { icon: FaCheck, title: 'Completely anonymous', body: 'The teacher sees the distribution, not individual responses. Students are more honest when there\'s no name attached.' },
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

      {/* Tips */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-6">Tips for using real-time feedback</h3>
          <ul className="space-y-3 text-warm-gray-600 dark:text-warm-gray-400">
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Leave it running throughout a lesson and glance at it periodically — you don't need to talk about it every time.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use it after introducing a new concept to gauge whether to move on or re-explain.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Pair it with the Q&A widget — students who find it hard can ask questions while you monitor the feedback distribution.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Clear and restart between topics so each reading is relevant to what's happening right now.</span></li>
          </ul>
        </div>
      </section>
    </PageLayout>
  );
};

export default FeedbackPage;
