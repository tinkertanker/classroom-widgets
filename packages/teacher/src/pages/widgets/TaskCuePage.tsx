import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FaBriefcase, FaCheck, FaArrowRight, FaEye } from 'react-icons/fa6';
import PageLayout from '../components/PageLayout';

const TaskCuePage: React.FC = () => {
  return (
    <PageLayout>
      <Helmet>
        <title>Task Cue Widget — Visual Work Mode Indicator for Classrooms | Classroom Widgets</title>
        <meta name="description" content="Show students what mode they should be in — silent work, pair discussion, group work, or free time — with a large visual indicator on your classroom screen. Free." />
        <meta property="og:title" content="Task Cue Widget | Classroom Widgets" />
        <meta property="og:description" content="Show students what work mode they should be in with a large visual indicator. Free classroom tool, no login required." />
        <meta property="og:url" content="https://widgets.tk.sg/widgets/task-cue" />
        <link rel="canonical" href="https://widgets.tk.sg/widgets/task-cue" />
      </Helmet>

      <section className="py-16 px-4 bg-gradient-to-br from-dusty-rose-50 to-terracotta-50 dark:from-warm-gray-800 dark:to-warm-gray-900">
        <div className="max-w-4xl mx-auto">
          <a href="/widgets" className="text-sm text-warm-gray-500 hover:text-sage-600 transition-colors mb-4 inline-block">← All Widgets</a>
          <div className="flex items-center gap-4 mb-4">
            <FaBriefcase className="text-5xl text-dusty-rose-500" />
            <h2 className="text-4xl font-bold text-warm-gray-900 dark:text-warm-gray-100">Task Cue</h2>
          </div>
          <p className="text-xl text-warm-gray-600 dark:text-warm-gray-400 max-w-2xl">
            Tell the room what mode they're in without saying a word. A large visual indicator on your screen shows whether students should be working silently, discussing, or in a group activity.
          </p>
          <a href="/" className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-dusty-rose-500 text-white rounded-lg hover:bg-dusty-rose-600 transition-colors">
            Try It Free <FaArrowRight />
          </a>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">How to use the Task Cue widget</h3>
          <div className="space-y-6">
            {[
              { step: 1, title: 'Launch the Task Cue widget', body: 'Click Task Cue in the toolbar. The widget shows a large visual mode indicator.' },
              { step: 2, title: 'Select the work mode', body: 'Click through the available modes to match what the class should be doing — options include silent work, pair work, group work, and more.' },
              { step: 3, title: 'Leave it visible', body: 'Keep the Task Cue on screen alongside your other widgets. Students can glance at it when they\'re unsure what they should be doing.' },
              { step: 4, title: 'Switch modes as the lesson changes', body: 'Click to change mode at any point. The display updates instantly so the whole class sees the transition.' },
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
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { icon: FaEye, title: 'Large, visible display', body: 'Designed to be readable from the back of the room — big icon, clear label, high contrast colours.' },
              { icon: FaBriefcase, title: 'Multiple work modes', body: 'Switch between silent work, pair discussion, group work, and free time with a single click.' },
              { icon: FaCheck, title: 'No verbal instruction needed', body: 'Students can self-regulate based on what\'s on screen — less repeating yourself, more teaching.' },
              { icon: FaArrowRight, title: 'Instant transitions', body: 'Change mode mid-lesson without disrupting your flow. The display updates immediately.' },
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
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-6">Tips for using the Task Cue</h3>
          <ul className="space-y-3 text-warm-gray-600 dark:text-warm-gray-400">
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Leave it on screen at all times so students develop the habit of checking it before asking "what are we doing?"</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use it to signal transitions — switching the mode cue is a clear, low-noise way to tell the class to change gears.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Pair with the Timer widget — set the timer for how long students have in a given mode, and display the cue for what they should be doing.</span></li>
          </ul>
        </div>
      </section>
    </PageLayout>
  );
};

export default TaskCuePage;
