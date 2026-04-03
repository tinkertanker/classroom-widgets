import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FaFont, FaCheck, FaArrowRight, FaPalette } from 'react-icons/fa6';
import PageLayout from '../components/PageLayout';

const TextBannerPage: React.FC = () => {
  return (
    <PageLayout>
      <Helmet>
        <title>Text Banner Widget — Big Screen Text for Classrooms | Classroom Widgets</title>
        <meta name="description" content="Display large, readable text on your classroom screen. Announcements, instructions, shoutouts — anything you want the whole room to see at a glance. Free." />
        <meta property="og:title" content="Text Banner Widget | Classroom Widgets" />
        <meta property="og:description" content="Display large, readable text on your classroom screen. Announcements, instructions, shoutouts. Free, no login required." />
        <meta property="og:url" content="https://widgets.tk.sg/widgets/text-banner" />
        <link rel="canonical" href="https://widgets.tk.sg/widgets/text-banner" />
      </Helmet>

      <section className="py-16 px-4 bg-gradient-to-br from-terracotta-50 to-sage-50 dark:from-warm-gray-800 dark:to-warm-gray-900">
        <div className="max-w-4xl mx-auto">
          <a href="/widgets" className="text-sm text-warm-gray-500 hover:text-sage-600 transition-colors mb-4 inline-block">← All Widgets</a>
          <div className="flex items-center gap-4 mb-4">
            <FaFont className="text-5xl text-terracotta-500" />
            <h2 className="text-4xl font-bold text-warm-gray-900 dark:text-warm-gray-100">Text Banner</h2>
          </div>
          <p className="text-xl text-warm-gray-600 dark:text-warm-gray-400 max-w-2xl">
            Put anything in big, bold text on your classroom screen. Instructions, reminders, shoutouts, or the WiFi password — if you want the whole room to read it, put it in a Text Banner.
          </p>
          <a href="/" className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 transition-colors">
            Try It Free <FaArrowRight />
          </a>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">How to use the Text Banner</h3>
          <div className="space-y-6">
            {[
              { step: 1, title: 'Launch the Text Banner widget', body: 'Click Text Banner in the toolbar. A large text display appears on your canvas.' },
              { step: 2, title: 'Type or paste your text', body: 'Click the banner and type directly. The text scales to fill the widget so it\'s always as large as possible.' },
              { step: 3, title: 'Resize as needed', body: 'Drag the widget to make it bigger or smaller. The text auto-sizes to fit, so it stays readable at any size.' },
              { step: 4, title: 'Run multiple banners', body: 'Add more than one Text Banner to show different pieces of information simultaneously — e.g. the task and the deadline.' },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex gap-4">
                <div className="w-10 h-10 bg-terracotta-500 text-white rounded-full flex items-center justify-center font-bold shrink-0">{step}</div>
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
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { icon: FaFont, title: 'Auto-scaling text', body: 'Text grows to fill the widget — resize the widget and the text keeps pace. Always readable, never cramped.' },
              { icon: FaPalette, title: 'Customisable style', body: 'Change colours and styling to match your classroom aesthetic or highlight important messages.' },
              { icon: FaCheck, title: 'Paste-friendly', body: 'Paste from anywhere — a doc, a browser, a spreadsheet. The banner displays exactly what you paste.' },
              { icon: FaArrowRight, title: 'Always visible', body: 'Leave it on screen throughout the lesson. Students glance up and always know what the current task or instruction is.' },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white dark:bg-warm-gray-700 p-6 rounded-lg shadow-sm border border-warm-gray-100 dark:border-warm-gray-600">
                <Icon className="text-xl text-terracotta-500 mb-3" />
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
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Show the lesson objective at the top of the screen throughout class — students (and observers) always know what the lesson is about.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use it for the WiFi password at the start of class so students don't have to ask.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use it for shoutouts — put a student's name up in big text when they do something great.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Paste directly from your lesson plan — no reformatting needed.</span></li>
          </ul>
        </div>
      </section>
    </PageLayout>
  );
};

export default TextBannerPage;
