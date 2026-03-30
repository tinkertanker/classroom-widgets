import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FaChartColumn, FaCheck, FaGear, FaArrowRight, FaMobileScreen, FaRotate } from 'react-icons/fa6';
import PageLayout from '../components/PageLayout';

const PollPage: React.FC = () => {
  return (
    <PageLayout>
      <Helmet>
        <title>Live Poll Widget for Classrooms — Classroom Widgets</title>
        <meta name="description" content="Create instant classroom polls and see results in real-time as students vote from any device. Free, no login required. Works with any browser." />
        <meta property="og:title" content="Live Poll Widget for Classrooms — Classroom Widgets" />
        <meta property="og:description" content="Create instant classroom polls and see results in real-time as students vote from any device. Free, no login required." />
        <meta property="og:url" content="https://widgets.tk.sg/widgets/poll" />
        <link rel="canonical" href="https://widgets.tk.sg/widgets/poll" />
      </Helmet>

      {/* Hero */}
      <section className="py-16 px-4 bg-gradient-to-br from-terracotta-50 to-sage-50 dark:from-warm-gray-800 dark:to-warm-gray-900">
        <div className="max-w-4xl mx-auto">
          <a href="/widgets" className="text-sm text-warm-gray-500 hover:text-sage-600 transition-colors mb-4 inline-block">
            ← All Widgets
          </a>
          <div className="flex items-center gap-4 mb-4">
            <FaChartColumn className="text-5xl text-terracotta-500" />
            <h2 className="text-4xl font-bold text-warm-gray-900 dark:text-warm-gray-100">Live Poll</h2>
          </div>
          <p className="text-xl text-warm-gray-600 dark:text-warm-gray-400 max-w-2xl">
            Create a multiple-choice poll and watch results update live as students vote from their phones, tablets, or laptops — no app download needed.
          </p>
          <a href="/" className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 transition-colors">
            Try It Free <FaArrowRight />
          </a>
        </div>
      </section>

      {/* How it works - Teacher */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">How to run a poll</h3>
          <div className="space-y-6">
            {[
              { step: 1, title: 'Launch the Poll widget', body: 'Click Poll in the toolbar. The widget opens on your teacher screen ready to configure.' },
              { step: 2, title: 'Set your question and options', body: 'Click the Settings gear and type your question. Add between 2 and 6 answer options. You can save polls to reuse later.' },
              { step: 3, title: 'Share the session code', body: 'Students visit your Classroom Widgets URL and enter the 5-character session code shown in the bottom bar. No app, no account.' },
              { step: 4, title: 'Start the poll', body: 'Hit "Start poll". Students see the question and options on their device and tap to vote.' },
              { step: 5, title: 'Watch results live', body: 'Vote counts and percentages update instantly on your screen. Pause voting at any time, or reset votes and run it again.' },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex gap-4">
                <div className="w-10 h-10 bg-terracotta-500 text-white rounded-full flex items-center justify-center font-bold shrink-0">
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
            <FaMobileScreen className="text-2xl text-sage-500" />
            <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100">What students see</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { icon: FaCheck, title: 'Simple voting UI', body: 'Students see the question and coloured option buttons. One tap to vote — no confusion, no friction.' },
              { icon: FaChartColumn, title: 'Live results (optional)', body: "After voting, students can see the bar chart update in real-time showing how the class voted — including which option was theirs." },
              { icon: FaRotate, title: 'Pause and resume', body: "When you pause the poll, students see a 'Poll Paused' message. Resume when you're ready to discuss and collect more votes." },
              { icon: FaGear, title: 'Saved polls', body: 'Build a library of reusable poll questions in settings. Great for quick-fire comprehension checks you run every lesson.' },
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
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-6">Tips for using polls in class</h3>
          <ul className="space-y-3 text-warm-gray-600 dark:text-warm-gray-400">
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use polls as a warm-up — ask a question from last lesson before you start.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Run the same poll before and after a topic to show how opinions or understanding has shifted.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Pause voting before revealing results — ask students to predict the outcome first.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Save your most-used questions so you can run them again in seconds.</span></li>
          </ul>
        </div>
      </section>
    </PageLayout>
  );
};

export default PollPage;
