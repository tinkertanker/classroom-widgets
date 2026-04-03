import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FaDice, FaCheck, FaArrowRight, FaRotate, FaList } from 'react-icons/fa6';
import PageLayout from '../components/PageLayout';

const RandomiserPage: React.FC = () => {
  return (
    <PageLayout>
      <Helmet>
        <title>Random Picker for Classrooms — Student Name Randomiser | Classroom Widgets</title>
        <meta name="description" content="Fairly pick a student, team, or item at random with a satisfying animated spin. Add your list, click spin, and let fate decide. Free classroom randomiser tool." />
        <meta property="og:title" content="Random Picker for Classrooms | Classroom Widgets" />
        <meta property="og:description" content="Fairly pick a student, team, or item at random with an animated spin. Free classroom randomiser tool, no login required." />
        <meta property="og:url" content="https://widgets.tk.sg/widgets/randomiser" />
        <link rel="canonical" href="https://widgets.tk.sg/widgets/randomiser" />
      </Helmet>

      <section className="py-16 px-4 bg-gradient-to-br from-terracotta-50 to-sage-50 dark:from-warm-gray-800 dark:to-warm-gray-900">
        <div className="max-w-4xl mx-auto">
          <a href="/widgets" className="text-sm text-warm-gray-500 hover:text-sage-600 transition-colors mb-4 inline-block">← All Widgets</a>
          <div className="flex items-center gap-4 mb-4">
            <FaDice className="text-5xl text-terracotta-500" />
            <h2 className="text-4xl font-bold text-warm-gray-900 dark:text-warm-gray-100">Randomiser</h2>
          </div>
          <p className="text-xl text-warm-gray-600 dark:text-warm-gray-400 max-w-2xl">
            Pick a student, assign teams, or choose an option at random — with a colourful animated slot machine spin that students actually enjoy watching.
          </p>
          <a href="/" className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 transition-colors">
            Try It Free <FaArrowRight />
          </a>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">How to use the randomiser</h3>
          <div className="space-y-6">
            {[
              { step: 1, title: 'Launch the Randomiser widget', body: 'Click Randomiser in the toolbar. The widget opens with a text area ready for your list.' },
              { step: 2, title: 'Enter your items', body: 'Type or paste a list of names, options, or teams — one per line. The widget processes the list in real-time as you type.' },
              { step: 3, title: 'Spin', body: 'Click the spin button. The animated slot machine runs through the list and lands on a random winner with a confetti burst.' },
              { step: 4, title: 'Remove picked items', body: 'Picked items automatically move to the "removed" list so they won\'t be picked again. Work through the whole class without repeats.' },
              { step: 5, title: 'Restore if needed', body: 'Move items back from the removed list to the active list at any time — for example to run a second round.' },
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
              { icon: FaDice, title: 'Animated spin', body: 'A colourful gradient slot machine animation speeds up and slows to a stop on the winner. Makes the moment feel fun rather than arbitrary.' },
              { icon: FaList, title: 'Dual list view', body: 'Active and removed items shown side by side — you always know who\'s been picked and who\'s still in the pool.' },
              { icon: FaRotate, title: 'No repeats by default', body: 'Picked items move out of the active pool automatically so every spin picks someone new.' },
              { icon: FaCheck, title: 'Paste-friendly', body: 'Paste a class list from a spreadsheet or document — one name per line and you\'re ready to spin.' },
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
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-6">Tips for using the randomiser</h3>
          <ul className="space-y-3 text-warm-gray-600 dark:text-warm-gray-400">
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Keep a saved class list in a text file to paste in each lesson — takes 3 seconds to get started.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use it for team assignment — put team names in the list and spin once per student.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use it to pick topics, discussion questions, or activity stations randomly.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>The spin animation adapts speed to list size — more items means a longer, more dramatic spin.</span></li>
          </ul>
        </div>
      </section>
    </PageLayout>
  );
};

export default RandomiserPage;
