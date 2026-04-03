import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FaQrcode, FaCheck, FaArrowRight, FaMobileScreen } from 'react-icons/fa6';
import PageLayout from '../components/PageLayout';

const QrCodePage: React.FC = () => {
  return (
    <PageLayout>
      <Helmet>
        <title>QR Code Widget for Classrooms — Share Links Instantly | Classroom Widgets</title>
        <meta name="description" content="Generate a QR code for any URL and display it on your classroom screen. Students scan and go — no typing, no typos. Free classroom QR code tool." />
        <meta property="og:title" content="QR Code Widget for Classrooms | Classroom Widgets" />
        <meta property="og:description" content="Generate a QR code for any URL and show it on your classroom screen. Students scan and go. Free, no login required." />
        <meta property="og:url" content="https://widgets.tk.sg/widgets/qr-code" />
        <link rel="canonical" href="https://widgets.tk.sg/widgets/qr-code" />
      </Helmet>

      <section className="py-16 px-4 bg-gradient-to-br from-sage-50 to-dusty-rose-50 dark:from-warm-gray-800 dark:to-warm-gray-900">
        <div className="max-w-4xl mx-auto">
          <a href="/widgets" className="text-sm text-warm-gray-500 hover:text-sage-600 transition-colors mb-4 inline-block">← All Widgets</a>
          <div className="flex items-center gap-4 mb-4">
            <FaQrcode className="text-5xl text-sage-500" />
            <h2 className="text-4xl font-bold text-warm-gray-900 dark:text-warm-gray-100">QR Code</h2>
          </div>
          <p className="text-xl text-warm-gray-600 dark:text-warm-gray-400 max-w-2xl">
            Generate a QR code for any URL and display it on your classroom screen. Students point their phone camera and they're there — no typing, no typos, no "how do you spell that?"
          </p>
          <a href="/" className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-sage-500 text-white rounded-lg hover:bg-sage-600 transition-colors">
            Try It Free <FaArrowRight />
          </a>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">How to use the QR Code widget</h3>
          <div className="space-y-6">
            {[
              { step: 1, title: 'Launch the QR Code widget', body: 'Click QR Code in the toolbar. The widget opens with a URL input field.' },
              { step: 2, title: 'Enter your URL', body: 'Paste or type the link you want to share. The QR code generates instantly as you type.' },
              { step: 3, title: 'Display it on screen', body: 'The QR code is shown large on your canvas. Resize the widget to make it bigger if students are far from the screen.' },
              { step: 4, title: 'Students scan', body: 'Students point their phone camera at the screen. Most phones open the link automatically without needing a QR app.' },
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
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { icon: FaQrcode, title: 'Instant generation', body: 'The QR code updates as you type the URL — no save button needed.' },
              { icon: FaMobileScreen, title: 'Works with any camera app', body: 'Modern phones scan QR codes natively through the camera app. No extra app needed.' },
              { icon: FaCheck, title: 'Scalable', body: 'Resize the widget and the QR code scales with it — make it as large as your screen allows.' },
              { icon: FaArrowRight, title: 'Change URL any time', body: 'Update the link mid-lesson and the code regenerates immediately.' },
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
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-6">Tips</h3>
          <ul className="space-y-3 text-warm-gray-600 dark:text-warm-gray-400">
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Use a URL shortener first if the link is long — shorter URLs generate simpler, easier-to-scan QR codes.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Make the widget large and place it in a corner so students can scan without blocking the rest of the screen.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Great for sharing Google Docs, YouTube videos, Kahoot links, or any external resource mid-lesson.</span></li>
            <li className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>Pair with the Handout widget for the same link — some students prefer to scan, others prefer to tap a link on their device.</span></li>
          </ul>
        </div>
      </section>
    </PageLayout>
  );
};

export default QrCodePage;
