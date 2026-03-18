import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FaFileLines, FaCheck, FaArrowRight, FaMobileScreen, FaLink, FaCopy } from 'react-icons/fa6';
import PageLayout from '../components/PageLayout';

const HandoutPage: React.FC = () => {
  return (
    <PageLayout>
      <Helmet>
        <title>Digital Handout Widget — Share Links & Text with Students | Classroom Widgets</title>
        <meta name="description" content="Push links, URLs, and text directly to students' devices in real-time. No email, no typing long URLs. Free classroom handout tool, no login required." />
        <meta property="og:title" content="Digital Handout Widget — Share Links & Text | Classroom Widgets" />
        <meta property="og:description" content="Push links, URLs, and text directly to students' devices in real-time. No email, no typing long URLs. Free, no login required." />
        <meta property="og:url" content="https://widgets.tk.sg/widgets/handout" />
        <link rel="canonical" href="https://widgets.tk.sg/widgets/handout" />
      </Helmet>

      {/* Hero */}
      <section className="py-16 px-4 bg-gradient-to-br from-terracotta-50 to-dusty-rose-50 dark:from-warm-gray-800 dark:to-warm-gray-900">
        <div className="max-w-4xl mx-auto">
          <a href="/widgets" className="text-sm text-warm-gray-500 hover:text-sage-600 transition-colors mb-4 inline-block">
            ← All Widgets
          </a>
          <div className="flex items-center gap-4 mb-4">
            <FaFileLines className="text-5xl text-terracotta-500" />
            <h2 className="text-4xl font-bold text-warm-gray-900 dark:text-warm-gray-100">Handout</h2>
          </div>
          <p className="text-xl text-warm-gray-600 dark:text-warm-gray-400 max-w-2xl">
            Push links, URLs, and text snippets directly to student devices in real-time. No email threads, no "can you repeat that URL?", no typos.
          </p>
          <a href="/" className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 transition-colors">
            Try It Free <FaArrowRight />
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">How to share a handout</h3>
          <div className="space-y-6">
            {[
              { step: 1, title: 'Launch the Handout widget', body: 'Click Handout in the toolbar. The widget opens with an input field ready to go.' },
              { step: 2, title: 'Share the session code', body: 'Students visit your Classroom Widgets URL and enter the 5-character session code. Works on any device with a browser.' },
              { step: 3, title: 'Type or paste your content', body: 'Enter a URL, a link, or any text in the input field. The widget auto-detects URLs and formats them as clickable links.' },
              { step: 4, title: 'Send it', body: 'Press Enter or click "+". The item appears instantly on every connected student device.' },
              { step: 5, title: 'Add more, remove old ones', body: 'Keep adding items throughout the lesson. Delete individual items or clear all when done.' },
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
            <FaMobileScreen className="text-2xl text-terracotta-500" />
            <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100">What students see</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { icon: FaLink, title: 'Clickable links', body: 'URLs appear as tappable links with an external link icon. Students tap once to open — no copying, no mistyping.' },
              { icon: FaCopy, title: 'Copy to clipboard', body: 'Every item has a copy button. Useful for code snippets, passwords to shared accounts, or anything students need to paste elsewhere.' },
              { icon: FaFileLines, title: 'Text items', body: 'Plain text items are displayed with line breaks preserved — great for multi-line instructions, code, or formatted content.' },
              { icon: FaCheck, title: 'Persists while connected', body: 'Items stay on the student screen as long as they\'re connected. Students don\'t need to rush to copy something before it disappears.' },
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

      {/* Tips */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-6">Tips for using Handout</h3>
          <ul className="space-y-3 text-warm-gray-600 dark:text-warm-gray-400">
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use it instead of writing long URLs on a whiteboard — students tap, not type.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Share code snippets or terminal commands that students need to copy exactly — the copy button handles it.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Stage your handouts — start with one link, add the next when students are ready, rather than dumping everything at once.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use it alongside the Timer widget — share a resource and start a countdown for how long students have to work with it.</span></li>
          </ul>
        </div>
      </section>
    </PageLayout>
  );
};

export default HandoutPage;
