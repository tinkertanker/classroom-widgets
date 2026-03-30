import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FaQuestion, FaCheck, FaArrowRight, FaMobileScreen, FaTrash, FaEyeSlash } from 'react-icons/fa6';
import PageLayout from '../components/PageLayout';

const QuestionsPage: React.FC = () => {
  return (
    <PageLayout>
      <Helmet>
        <title>Q&A Widget — Anonymous Student Questions for Class | Classroom Widgets</title>
        <meta name="description" content="Let students submit questions during class anonymously. Mark answered, delete, or clear all in real-time. Free classroom Q&A tool, no login required." />
        <meta property="og:title" content="Q&A Widget — Anonymous Student Questions | Classroom Widgets" />
        <meta property="og:description" content="Let students submit questions during class anonymously. Mark answered, delete, or clear all in real-time. Free, no login required." />
        <meta property="og:url" content="https://widgets.tk.sg/widgets/questions" />
        <link rel="canonical" href="https://widgets.tk.sg/widgets/questions" />
      </Helmet>

      {/* Hero */}
      <section className="py-16 px-4 bg-gradient-to-br from-sage-50 to-dusty-rose-50 dark:from-warm-gray-800 dark:to-warm-gray-900">
        <div className="max-w-4xl mx-auto">
          <a href="/widgets" className="text-sm text-warm-gray-500 hover:text-sage-600 transition-colors mb-4 inline-block">
            ← All Widgets
          </a>
          <div className="flex items-center gap-4 mb-4">
            <FaQuestion className="text-5xl text-sage-500" />
            <h2 className="text-4xl font-bold text-warm-gray-900 dark:text-warm-gray-100">Q&A</h2>
          </div>
          <p className="text-xl text-warm-gray-600 dark:text-warm-gray-400 max-w-2xl">
            Give every student a voice. The Q&A widget lets students submit questions during class — the quiet ones included — and gives you a live queue to work through at your own pace.
          </p>
          <a href="/" className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-sage-500 text-white rounded-lg hover:bg-sage-600 transition-colors">
            Try It Free <FaArrowRight />
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">How to run a Q&A session</h3>
          <div className="space-y-6">
            {[
              { step: 1, title: 'Launch the Q&A widget', body: 'Click Q&A in the toolbar. The widget opens showing an empty question queue.' },
              { step: 2, title: 'Share the session code', body: 'Students visit your Classroom Widgets URL and enter the 5-character session code. No app download, no account needed.' },
              { step: 3, title: 'Start accepting questions', body: 'Click "Start accepting questions". Students can now type and submit questions from their devices.' },
              { step: 4, title: 'Manage the queue', body: 'Questions appear in real-time. Tick the checkmark to mark a question as answered (it moves to the bottom), or delete it. Unanswered questions always float to the top.' },
              { step: 5, title: 'Pause or clear when done', body: 'Pause to stop new submissions while you work through the queue. Clear all when you\'re ready for the next round.' },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex gap-4">
                <div className="w-10 h-10 bg-sage-500 text-white rounded-full flex items-center justify-center font-bold shrink-0">
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
              { icon: FaEyeSlash, title: 'Anonymous by default', body: 'Students type their question and hit submit. No name required — which means the students who never raise their hand actually ask.' },
              { icon: FaCheck, title: 'Submission confirmation', body: 'After submitting, students see a confirmation toast and their question appears in their local list with a colour tag.' },
              { icon: FaQuestion, title: 'See answered status', body: "Students can see when their question has been marked as answered — it gets a strikethrough and a ✓ badge." },
              { icon: FaTrash, title: 'Teacher controls everything', body: 'Only the teacher can delete questions or clear the queue. Students can submit but not moderate.' },
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
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-6">Tips for Q&A in class</h3>
          <ul className="space-y-3 text-warm-gray-600 dark:text-warm-gray-400">
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Leave it open during independent work time — students can queue questions without interrupting the class.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use it at the end of a lesson as an exit ticket — "What's one thing you're still unsure about?"</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Pause submissions before addressing the queue so new questions don't distract you mid-answer.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Upvoted questions rise naturally — if the same thing is being asked multiple times, you know it's the one to address first.</span></li>
          </ul>
        </div>
      </section>
    </PageLayout>
  );
};

export default QuestionsPage;
