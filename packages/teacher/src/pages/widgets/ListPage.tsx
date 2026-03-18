import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FaListCheck, FaCheck, FaArrowRight, FaPlus, FaStar } from 'react-icons/fa6';
import PageLayout from '../components/PageLayout';

const ListPage: React.FC = () => {
  return (
    <PageLayout>
      <Helmet>
        <title>Classroom Task List Widget — Visual To-Do for Teachers | Classroom Widgets</title>
        <meta name="description" content="A visual task list for your classroom. Add items, check them off as students complete them, and celebrate finishing with confetti. Free, no login required." />
        <meta property="og:title" content="Classroom Task List Widget | Classroom Widgets" />
        <meta property="og:description" content="A visual task list for your classroom. Add items, check them off, celebrate finishing with confetti. Free, no login required." />
        <meta property="og:url" content="https://widgets.tk.sg/widgets/list" />
        <link rel="canonical" href="https://widgets.tk.sg/widgets/list" />
      </Helmet>

      <section className="py-16 px-4 bg-gradient-to-br from-sage-50 to-dusty-rose-50 dark:from-warm-gray-800 dark:to-warm-gray-900">
        <div className="max-w-4xl mx-auto">
          <a href="/widgets" className="text-sm text-warm-gray-500 hover:text-sage-600 transition-colors mb-4 inline-block">← All Widgets</a>
          <div className="flex items-center gap-4 mb-4">
            <FaListCheck className="text-5xl text-sage-500" />
            <h2 className="text-4xl font-bold text-warm-gray-900 dark:text-warm-gray-100">List</h2>
          </div>
          <p className="text-xl text-warm-gray-600 dark:text-warm-gray-400 max-w-2xl">
            A shared task list the whole class can see. Add your agenda or work steps, tick them off as you go, and trigger a confetti burst when the last item is done.
          </p>
          <a href="/" className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-sage-500 text-white rounded-lg hover:bg-sage-600 transition-colors">
            Try It Free <FaArrowRight />
          </a>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">How to use the List widget</h3>
          <div className="space-y-6">
            {[
              { step: 1, title: 'Launch the List widget', body: 'Click List in the toolbar. An empty task list appears on your canvas.' },
              { step: 2, title: 'Add your items', body: 'Type a task and press Enter or click the + button. Add as many items as you need — the list scrolls.' },
              { step: 3, title: 'Check items off', body: 'Click the checkbox next to an item to mark it complete. Completed items are shown with a strikethrough.' },
              { step: 4, title: 'Celebrate completion', body: 'When the last item is checked off, confetti fires. It\'s a small thing but students love it.' },
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
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">Features</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: FaPlus, title: 'Add on the fly', body: 'Add new items at any point during the lesson — no need to plan the whole list upfront.' },
              { icon: FaCheck, title: 'Completion tracking', body: 'Items are visually marked as done with a strikethrough. Students always know what\'s left.' },
              { icon: FaStar, title: 'Confetti finish', body: 'Checking off the last item triggers a confetti burst — a small reward that makes finishing feel good.' },
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

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-6">Tips for using the List widget</h3>
          <ul className="space-y-3 text-warm-gray-600 dark:text-warm-gray-400">
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use it as a visible lesson agenda — students always know what's coming next and how far through the lesson you are.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use it for independent work steps — put each task as a separate item so students self-pace through the work.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Run multiple lists simultaneously for group work with different task sets per group.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Pair with the Timer widget — list the tasks, start the countdown, and let students self-manage.</span></li>
          </ul>
        </div>
      </section>
    </PageLayout>
  );
};

export default ListPage;
