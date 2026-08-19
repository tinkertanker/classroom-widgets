import React from 'react';
import { Helmet } from 'react-helmet-async';
import type { IconType } from 'react-icons';
import {
  FaArrowRight,
  FaBriefcase,
  FaBullseye,
  FaChartBar,
  FaChartColumn,
  FaCheck,
  FaCircle,
  FaClock,
  FaCopy,
  FaDice,
  FaEye,
  FaEyeSlash,
  FaFileLines,
  FaFont,
  FaGauge,
  FaGear,
  FaLink,
  FaList,
  FaListCheck,
  FaMobileScreen,
  FaMusic,
  FaPalette,
  FaPlus,
  FaQrcode,
  FaQuestion,
  FaRotate,
  FaSliders,
  FaStar,
  FaTableCells,
  FaTrafficLight,
  FaTrash,
  FaVolumeHigh,
} from 'react-icons/fa6';
import PageLayout from '../components/PageLayout';

/**
 * Every widget landing page is the same four-section marketing skeleton — hero,
 * numbered steps, a card grid, and a tips list — so the markup lives here once and
 * each page under `pages/widgets/` supplies only its own entry from
 * `widgetLandingPages` below.
 */

type AccentColor = 'sage' | 'terracotta' | 'dusty-rose';

/**
 * Tailwind only sees class names it can find as literal strings, so accents are a
 * static lookup rather than an interpolated `bg-${accent}-500`.
 */
const ACCENT_CLASS_NAMES: Record<AccentColor, {
  heroIcon: string;
  heroCta: string;
  stepBadge: string;
  sectionIcon: string;
  cardIcon: string;
}> = {
  sage: {
    heroIcon: 'text-5xl text-sage-500',
    heroCta: 'inline-flex items-center gap-2 mt-6 px-6 py-3 bg-sage-500 text-white rounded-lg hover:bg-sage-600 transition-colors',
    stepBadge: 'w-10 h-10 bg-sage-500 text-white rounded-full flex items-center justify-center font-bold shrink-0',
    sectionIcon: 'text-2xl text-sage-500',
    cardIcon: 'text-xl text-sage-500 mb-3',
  },
  terracotta: {
    heroIcon: 'text-5xl text-terracotta-500',
    heroCta: 'inline-flex items-center gap-2 mt-6 px-6 py-3 bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 transition-colors',
    stepBadge: 'w-10 h-10 bg-terracotta-500 text-white rounded-full flex items-center justify-center font-bold shrink-0',
    sectionIcon: 'text-2xl text-terracotta-500',
    cardIcon: 'text-xl text-terracotta-500 mb-3',
  },
  'dusty-rose': {
    heroIcon: 'text-5xl text-dusty-rose-500',
    heroCta: 'inline-flex items-center gap-2 mt-6 px-6 py-3 bg-dusty-rose-500 text-white rounded-lg hover:bg-dusty-rose-600 transition-colors',
    stepBadge: 'w-10 h-10 bg-dusty-rose-500 text-white rounded-full flex items-center justify-center font-bold shrink-0',
    sectionIcon: 'text-2xl text-dusty-rose-500',
    cardIcon: 'text-xl text-dusty-rose-500 mb-3',
  },
};

const CARD_GRID_CLASS_NAMES: Record<2 | 3, string> = {
  2: 'grid md:grid-cols-2 gap-6',
  3: 'grid md:grid-cols-3 gap-6',
};

export interface WidgetLandingStep {
  step: number;
  title: string;
  body: string;
}

export interface WidgetLandingCard {
  icon: IconType;
  title: string;
  body: string;
  /** Overrides the section accent — only the Traffic Light colour legend uses this. */
  iconClassName?: string;
}

export interface WidgetLandingPageConfig {
  /** Path segment after `/widgets/`; drives both `og:url` and the canonical link. */
  slug: string;
  meta: {
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
  };
  accent: AccentColor;
  /** Literal Tailwind gradient stops for the hero, e.g. `from-sage-50 to-terracotta-50`. */
  heroGradient: string;
  heroIcon: IconType;
  heading: string;
  lede: string;
  steps: {
    heading: string;
    items: WidgetLandingStep[];
  };
  cards: {
    heading: string;
    /** Rendered to the left of the heading when present. */
    headingIcon?: IconType;
    /** Usually the page accent; Poll deliberately uses sage here against a terracotta hero. */
    accent: AccentColor;
    columns: 2 | 3;
    items: WidgetLandingCard[];
  };
  tips: {
    heading: string;
    items: string[];
  };
}

export const WidgetLandingPage: React.FC<{ config: WidgetLandingPageConfig }> = ({ config }) => {
  const accent = ACCENT_CLASS_NAMES[config.accent];
  const cardAccent = ACCENT_CLASS_NAMES[config.cards.accent];
  const HeroIcon = config.heroIcon;
  const CardsHeadingIcon = config.cards.headingIcon;
  const canonicalUrl = `https://widgets.tk.sg/widgets/${config.slug}`;

  return (
    <PageLayout>
      <Helmet>
        <title>{config.meta.title}</title>
        <meta name="description" content={config.meta.description} />
        <meta property="og:title" content={config.meta.ogTitle} />
        <meta property="og:description" content={config.meta.ogDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      {/* Hero */}
      <section className={`py-16 px-4 bg-gradient-to-br ${config.heroGradient} dark:from-warm-gray-800 dark:to-warm-gray-900`}>
        <div className="max-w-4xl mx-auto">
          <a href="/widgets" className="text-sm text-warm-gray-500 hover:text-sage-600 transition-colors mb-4 inline-block">← All Widgets</a>
          <div className="flex items-center gap-4 mb-4">
            <HeroIcon className={accent.heroIcon} />
            <h2 className="text-4xl font-bold text-warm-gray-900 dark:text-warm-gray-100">{config.heading}</h2>
          </div>
          <p className="text-xl text-warm-gray-600 dark:text-warm-gray-400 max-w-2xl">
            {config.lede}
          </p>
          <a href="/" className={accent.heroCta}>
            Try It Free <FaArrowRight />
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">{config.steps.heading}</h3>
          <div className="space-y-6">
            {config.steps.items.map(({ step, title, body }) => (
              <div key={step} className="flex gap-4">
                <div className={accent.stepBadge}>{step}</div>
                <div>
                  <h4 className="font-semibold text-warm-gray-900 dark:text-warm-gray-100 mb-1">{title}</h4>
                  <p className="text-warm-gray-600 dark:text-warm-gray-400">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features / what students see */}
      <section className="py-16 px-4 bg-warm-gray-50 dark:bg-warm-gray-800">
        <div className="max-w-4xl mx-auto">
          {CardsHeadingIcon ? (
            <div className="flex items-center gap-3 mb-8">
              <CardsHeadingIcon className={cardAccent.sectionIcon} />
              <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100">{config.cards.heading}</h3>
            </div>
          ) : (
            <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">{config.cards.heading}</h3>
          )}
          <div className={CARD_GRID_CLASS_NAMES[config.cards.columns]}>
            {config.cards.items.map(({ icon: Icon, title, body, iconClassName }) => (
              <div key={title} className="bg-white dark:bg-warm-gray-700 p-6 rounded-lg shadow-sm border border-warm-gray-100 dark:border-warm-gray-600">
                <Icon className={iconClassName ?? cardAccent.cardIcon} />
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
          <h3 className="text-2xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-6">{config.tips.heading}</h3>
          <ul className="space-y-3 text-warm-gray-600 dark:text-warm-gray-400">
            {config.tips.items.map((tip) => (
              <li key={tip} className="flex gap-3"><FaCheck className="text-sage-500 mt-1 shrink-0" /><span>{tip}</span></li>
            ))}
          </ul>
        </div>
      </section>
    </PageLayout>
  );
};

export const widgetLandingPages = {
  feedback: {
    slug: 'feedback',
    meta: {
      title: 'Real-Time Student Feedback Widget — Gauge Difficulty Live | Classroom Widgets',
      description: 'See instantly if your class is keeping up. Students slide a difficulty gauge from Too Easy to Too Hard, and you see the live distribution. Free, no login.',
      ogTitle: 'Real-Time Student Feedback Widget | Classroom Widgets',
      ogDescription: 'See instantly if your class is keeping up. Students slide a difficulty gauge and you see the live distribution. Free, no login required.',
    },
    accent: 'dusty-rose',
    heroGradient: 'from-dusty-rose-50 to-sage-50',
    heroIcon: FaGauge,
    heading: 'Real-Time Feedback',
    lede: 'A live difficulty gauge that tells you exactly how the class is feeling — without anyone having to raise their hand or say a word.',
    steps: {
      heading: 'How to collect real-time feedback',
      items: [
        { step: 1, title: 'Launch RT Feedback', body: 'Click RT Feedback in the toolbar. The widget opens showing an empty histogram.' },
        { step: 2, title: 'Share the session code', body: 'Students visit your Classroom Widgets URL and enter the 5-character session code. Works on any device.' },
        { step: 3, title: 'Start feedback collection', body: 'Click "Start feedback". Students immediately see the slider on their device.' },
        { step: 4, title: 'Read the histogram', body: 'As students adjust their sliders, a bar chart updates in real-time on your screen showing the distribution across 5 levels: Too Easy → Too Hard.' },
        { step: 5, title: 'Adjust your teaching', body: 'If the bars cluster on the right, slow down. If they\'re all on the left, push forward. Clear and repeat any time.' },
      ],
    },
    cards: {
      heading: 'What students see',
      headingIcon: FaMobileScreen,
      accent: 'dusty-rose',
      columns: 2,
      items: [
        { icon: FaSliders, title: 'A simple slider', body: 'Students see a single slider on a colour gradient — green for easy, red for hard. They drag it to where they are and let go. Done.' },
        { icon: FaGauge, title: 'Labelled levels', body: 'Five labels — Too Easy, Easy, Just Right, Hard, Too Hard — make it clear what the scale means. No ambiguity.' },
        { icon: FaChartBar, title: 'Continuous updates', body: 'The slider sends feedback whenever released. Students can update it as the lesson progresses — it\'s not a one-shot response.' },
        { icon: FaCheck, title: 'Completely anonymous', body: 'The teacher sees the distribution, not individual responses. Students are more honest when there\'s no name attached.' },
      ],
    },
    tips: {
      heading: 'Tips for using real-time feedback',
      items: [
        'Leave it running throughout a lesson and glance at it periodically — you don\'t need to talk about it every time.',
        'Use it after introducing a new concept to gauge whether to move on or re-explain.',
        'Pair it with the Q&A widget — students who find it hard can ask questions while you monitor the feedback distribution.',
        'Clear and restart between topics so each reading is relevant to what\'s happening right now.',
      ],
    },
  },

  handout: {
    slug: 'handout',
    meta: {
      title: 'Digital Handout Widget — Share Links & Text with Students | Classroom Widgets',
      description: 'Push links, URLs, and text directly to students\' devices in real-time. No email, no typing long URLs. Free classroom handout tool, no login required.',
      ogTitle: 'Digital Handout Widget — Share Links & Text | Classroom Widgets',
      ogDescription: 'Push links, URLs, and text directly to students\' devices in real-time. No email, no typing long URLs. Free, no login required.',
    },
    accent: 'terracotta',
    heroGradient: 'from-terracotta-50 to-dusty-rose-50',
    heroIcon: FaFileLines,
    heading: 'Handout',
    lede: 'Push links, URLs, and text snippets directly to student devices in real-time. No email threads, no "can you repeat that URL?", no typos.',
    steps: {
      heading: 'How to share a handout',
      items: [
        { step: 1, title: 'Launch the Handout widget', body: 'Click Handout in the toolbar. The widget opens with an input field ready to go.' },
        { step: 2, title: 'Share the session code', body: 'Students visit your Classroom Widgets URL and enter the 5-character session code. Works on any device with a browser.' },
        { step: 3, title: 'Type or paste your content', body: 'Enter a URL, a link, or any text in the input field. The widget auto-detects URLs and formats them as clickable links.' },
        { step: 4, title: 'Send it', body: 'Press Enter or click "+". The item appears instantly on every connected student device.' },
        { step: 5, title: 'Add more, remove old ones', body: 'Keep adding items throughout the lesson. Delete individual items or clear all when done.' },
      ],
    },
    cards: {
      heading: 'What students see',
      headingIcon: FaMobileScreen,
      accent: 'terracotta',
      columns: 2,
      items: [
        { icon: FaLink, title: 'Clickable links', body: 'URLs appear as tappable links with an external link icon. Students tap once to open — no copying, no mistyping.' },
        { icon: FaCopy, title: 'Copy to clipboard', body: 'Every item has a copy button. Useful for code snippets, passwords to shared accounts, or anything students need to paste elsewhere.' },
        { icon: FaFileLines, title: 'Text items', body: 'Plain text items are displayed with line breaks preserved — great for multi-line instructions, code, or formatted content.' },
        { icon: FaCheck, title: 'Persists while connected', body: 'Items stay on the student screen as long as they\'re connected. Students don\'t need to rush to copy something before it disappears.' },
      ],
    },
    tips: {
      heading: 'Tips for using Handout',
      items: [
        'Use it instead of writing long URLs on a whiteboard — students tap, not type.',
        'Share code snippets or terminal commands that students need to copy exactly — the copy button handles it.',
        'Stage your handouts — start with one link, add the next when students are ready, rather than dumping everything at once.',
        'Use it alongside the Timer widget — share a resource and start a countdown for how long students have to work with it.',
      ],
    },
  },

  list: {
    slug: 'list',
    meta: {
      title: 'Classroom Task List Widget — Visual To-Do for Teachers | Classroom Widgets',
      description: 'A visual task list for your classroom. Add items, check them off as students complete them, and celebrate finishing with confetti. Free, no login required.',
      ogTitle: 'Classroom Task List Widget | Classroom Widgets',
      ogDescription: 'A visual task list for your classroom. Add items, check them off, celebrate finishing with confetti. Free, no login required.',
    },
    accent: 'sage',
    heroGradient: 'from-sage-50 to-dusty-rose-50',
    heroIcon: FaListCheck,
    heading: 'List',
    lede: 'A shared task list the whole class can see. Add your agenda or work steps, tick them off as you go, and trigger a confetti burst when the last item is done.',
    steps: {
      heading: 'How to use the List widget',
      items: [
        { step: 1, title: 'Launch the List widget', body: 'Click List in the toolbar. An empty task list appears on your canvas.' },
        { step: 2, title: 'Add your items', body: 'Type a task and press Enter or click the + button. Add as many items as you need — the list scrolls.' },
        { step: 3, title: 'Check items off', body: 'Click the checkbox next to an item to mark it complete. Completed items are shown with a strikethrough.' },
        { step: 4, title: 'Celebrate completion', body: 'When the last item is checked off, confetti fires. It\'s a small thing but students love it.' },
      ],
    },
    cards: {
      heading: 'Features',
      accent: 'sage',
      columns: 3,
      items: [
        { icon: FaPlus, title: 'Add on the fly', body: 'Add new items at any point during the lesson — no need to plan the whole list upfront.' },
        { icon: FaCheck, title: 'Completion tracking', body: 'Items are visually marked as done with a strikethrough. Students always know what\'s left.' },
        { icon: FaStar, title: 'Confetti finish', body: 'Checking off the last item triggers a confetti burst — a small reward that makes finishing feel good.' },
      ],
    },
    tips: {
      heading: 'Tips for using the List widget',
      items: [
        'Use it as a visible lesson agenda — students always know what\'s coming next and how far through the lesson you are.',
        'Use it for independent work steps — put each task as a separate item so students self-pace through the work.',
        'Run multiple lists simultaneously for group work with different task sets per group.',
        'Pair with the Timer widget — list the tasks, start the countdown, and let students self-manage.',
      ],
    },
  },

  poll: {
    slug: 'poll',
    meta: {
      title: 'Live Poll Widget for Classrooms — Classroom Widgets',
      description: 'Create instant classroom polls and see results in real-time as students vote from any device. Free, no login required. Works with any browser.',
      ogTitle: 'Live Poll Widget for Classrooms — Classroom Widgets',
      ogDescription: 'Create instant classroom polls and see results in real-time as students vote from any device. Free, no login required.',
    },
    accent: 'terracotta',
    heroGradient: 'from-terracotta-50 to-sage-50',
    heroIcon: FaChartColumn,
    heading: 'Live Poll',
    lede: 'Create a multiple-choice poll and watch results update live as students vote from their phones, tablets, or laptops — no app download needed.',
    steps: {
      heading: 'How to run a poll',
      items: [
        { step: 1, title: 'Launch the Poll widget', body: 'Click Poll in the toolbar. The widget opens on your teacher screen ready to configure.' },
        { step: 2, title: 'Set your question and options', body: 'Click the Settings gear and type your question. Add between 2 and 6 answer options. You can save polls to reuse later.' },
        { step: 3, title: 'Share the session code', body: 'Students visit your Classroom Widgets URL and enter the 5-character session code shown in the bottom bar. No app, no account.' },
        { step: 4, title: 'Start the poll', body: 'Hit "Start poll". Students see the question and options on their device and tap to vote.' },
        { step: 5, title: 'Watch results live', body: 'Vote counts and percentages update instantly on your screen. Pause voting at any time, or reset votes and run it again.' },
      ],
    },
    cards: {
      heading: 'What students see',
      headingIcon: FaMobileScreen,
      accent: 'sage',
      columns: 2,
      items: [
        { icon: FaCheck, title: 'Simple voting UI', body: 'Students see the question and coloured option buttons. One tap to vote — no confusion, no friction.' },
        { icon: FaChartColumn, title: 'Live results (optional)', body: "After voting, students can see the bar chart update in real-time showing how the class voted — including which option was theirs." },
        { icon: FaRotate, title: 'Pause and resume', body: "When you pause the poll, students see a 'Poll Paused' message. Resume when you're ready to discuss and collect more votes." },
        { icon: FaGear, title: 'Saved polls', body: 'Build a library of reusable poll questions in settings. Great for quick-fire comprehension checks you run every lesson.' },
      ],
    },
    tips: {
      heading: 'Tips for using polls in class',
      items: [
        'Use polls as a warm-up — ask a question from last lesson before you start.',
        'Run the same poll before and after a topic to show how opinions or understanding has shifted.',
        'Pause voting before revealing results — ask students to predict the outcome first.',
        'Save your most-used questions so you can run them again in seconds.',
      ],
    },
  },

  qrCode: {
    slug: 'qr-code',
    meta: {
      title: 'QR Code Widget for Classrooms — Share Links Instantly | Classroom Widgets',
      description: 'Generate a QR code for any URL and display it on your classroom screen. Students scan and go — no typing, no typos. Free classroom QR code tool.',
      ogTitle: 'QR Code Widget for Classrooms | Classroom Widgets',
      ogDescription: 'Generate a QR code for any URL and show it on your classroom screen. Students scan and go. Free, no login required.',
    },
    accent: 'sage',
    heroGradient: 'from-sage-50 to-dusty-rose-50',
    heroIcon: FaQrcode,
    heading: 'QR Code',
    lede: 'Generate a QR code for any URL and display it on your classroom screen. Students point their phone camera and they\'re there — no typing, no typos, no "how do you spell that?"',
    steps: {
      heading: 'How to use the QR Code widget',
      items: [
        { step: 1, title: 'Launch the QR Code widget', body: 'Click QR Code in the toolbar. The widget opens with a URL input field.' },
        { step: 2, title: 'Enter your URL', body: 'Paste or type the link you want to share. The QR code generates instantly as you type.' },
        { step: 3, title: 'Display it on screen', body: 'The QR code is shown large on your canvas. Resize the widget to make it bigger if students are far from the screen.' },
        { step: 4, title: 'Students scan', body: 'Students point their phone camera at the screen. Most phones open the link automatically without needing a QR app.' },
      ],
    },
    cards: {
      heading: 'Features',
      accent: 'sage',
      columns: 2,
      items: [
        { icon: FaQrcode, title: 'Instant generation', body: 'The QR code updates as you type the URL — no save button needed.' },
        { icon: FaMobileScreen, title: 'Works with any camera app', body: 'Modern phones scan QR codes natively through the camera app. No extra app needed.' },
        { icon: FaCheck, title: 'Scalable', body: 'Resize the widget and the QR code scales with it — make it as large as your screen allows.' },
        { icon: FaArrowRight, title: 'Change URL any time', body: 'Update the link mid-lesson and the code regenerates immediately.' },
      ],
    },
    tips: {
      heading: 'Tips',
      items: [
        'Use a URL shortener first if the link is long — shorter URLs generate simpler, easier-to-scan QR codes.',
        'Make the widget large and place it in a corner so students can scan without blocking the rest of the screen.',
        'Great for sharing Google Docs, YouTube videos, Kahoot links, or any external resource mid-lesson.',
        'Pair with the Handout widget for the same link — some students prefer to scan, others prefer to tap a link on their device.',
      ],
    },
  },

  questions: {
    slug: 'questions',
    meta: {
      title: 'Q&A Widget — Anonymous Student Questions for Class | Classroom Widgets',
      description: 'Let students submit questions during class anonymously. Mark answered, delete, or clear all in real-time. Free classroom Q&A tool, no login required.',
      ogTitle: 'Q&A Widget — Anonymous Student Questions | Classroom Widgets',
      ogDescription: 'Let students submit questions during class anonymously. Mark answered, delete, or clear all in real-time. Free, no login required.',
    },
    accent: 'sage',
    heroGradient: 'from-sage-50 to-dusty-rose-50',
    heroIcon: FaQuestion,
    heading: 'Q&A',
    lede: 'Give every student a voice. The Q&A widget lets students submit questions during class — the quiet ones included — and gives you a live queue to work through at your own pace.',
    steps: {
      heading: 'How to run a Q&A session',
      items: [
        { step: 1, title: 'Launch the Q&A widget', body: 'Click Q&A in the toolbar. The widget opens showing an empty question queue.' },
        { step: 2, title: 'Share the session code', body: 'Students visit your Classroom Widgets URL and enter the 5-character session code. No app download, no account needed.' },
        { step: 3, title: 'Start accepting questions', body: 'Click "Start accepting questions". Students can now type and submit questions from their devices.' },
        { step: 4, title: 'Manage the queue', body: 'Questions appear in real-time. Tick the checkmark to mark a question as answered (it moves to the bottom), or delete it. Unanswered questions always float to the top.' },
        { step: 5, title: 'Pause or clear when done', body: 'Pause to stop new submissions while you work through the queue. Clear all when you\'re ready for the next round.' },
      ],
    },
    cards: {
      heading: 'What students see',
      headingIcon: FaMobileScreen,
      accent: 'sage',
      columns: 2,
      items: [
        { icon: FaEyeSlash, title: 'Anonymous by default', body: 'Students type their question and hit submit. No name required — which means the students who never raise their hand actually ask.' },
        { icon: FaCheck, title: 'Submission confirmation', body: 'After submitting, students see a confirmation toast and their question appears in their local list with a colour tag.' },
        { icon: FaQuestion, title: 'See answered status', body: "Students can see when their question has been marked as answered — it gets a strikethrough and a ✓ badge." },
        { icon: FaTrash, title: 'Teacher controls everything', body: 'Only the teacher can delete questions or clear the queue. Students can submit but not moderate.' },
      ],
    },
    tips: {
      heading: 'Tips for Q&A in class',
      items: [
        'Leave it open during independent work time — students can queue questions without interrupting the class.',
        'Use it at the end of a lesson as an exit ticket — "What\'s one thing you\'re still unsure about?"',
        'Pause submissions before addressing the queue so new questions don\'t distract you mid-answer.',
        'Upvoted questions rise naturally — if the same thing is being asked multiple times, you know it\'s the one to address first.',
      ],
    },
  },

  randomiser: {
    slug: 'randomiser',
    meta: {
      title: 'Random Picker for Classrooms — Student Name Randomiser | Classroom Widgets',
      description: 'Fairly pick a student, team, or item at random with a satisfying animated spin. Add your list, click spin, and let fate decide. Free classroom randomiser tool.',
      ogTitle: 'Random Picker for Classrooms | Classroom Widgets',
      ogDescription: 'Fairly pick a student, team, or item at random with an animated spin. Free classroom randomiser tool, no login required.',
    },
    accent: 'terracotta',
    heroGradient: 'from-terracotta-50 to-sage-50',
    heroIcon: FaDice,
    heading: 'Randomiser',
    lede: 'Pick a student, assign teams, or choose an option at random — with a colourful animated slot machine spin that students actually enjoy watching.',
    steps: {
      heading: 'How to use the randomiser',
      items: [
        { step: 1, title: 'Launch the Randomiser widget', body: 'Click Randomiser in the toolbar. The widget opens with a text area ready for your list.' },
        { step: 2, title: 'Enter your items', body: 'Type or paste a list of names, options, or teams — one per line. The widget processes the list in real-time as you type.' },
        { step: 3, title: 'Spin', body: 'Click the spin button. The animated slot machine runs through the list and lands on a random winner with a confetti burst.' },
        { step: 4, title: 'Remove picked items', body: 'Picked items automatically move to the "removed" list so they won\'t be picked again. Work through the whole class without repeats.' },
        { step: 5, title: 'Restore if needed', body: 'Move items back from the removed list to the active list at any time — for example to run a second round.' },
      ],
    },
    cards: {
      heading: 'Features',
      accent: 'terracotta',
      columns: 2,
      items: [
        { icon: FaDice, title: 'Animated spin', body: 'A colourful gradient slot machine animation speeds up and slows to a stop on the winner. Makes the moment feel fun rather than arbitrary.' },
        { icon: FaList, title: 'Dual list view', body: 'Active and removed items shown side by side — you always know who\'s been picked and who\'s still in the pool.' },
        { icon: FaRotate, title: 'No repeats by default', body: 'Picked items move out of the active pool automatically so every spin picks someone new.' },
        { icon: FaCheck, title: 'Paste-friendly', body: 'Paste a class list from a spreadsheet or document — one name per line and you\'re ready to spin.' },
      ],
    },
    tips: {
      heading: 'Tips for using the randomiser',
      items: [
        'Keep a saved class list in a text file to paste in each lesson — takes 3 seconds to get started.',
        'Use it for team assignment — put team names in the list and spin once per student.',
        'Use it to pick topics, discussion questions, or activity stations randomly.',
        'The spin animation adapts speed to list size — more items means a longer, more dramatic spin.',
      ],
    },
  },

  soundEffects: {
    slug: 'sound-effects',
    meta: {
      title: 'Sound Effects Widget for Classrooms — Audio Cues for Teachers | Classroom Widgets',
      description: 'A grid of sound effect buttons for your classroom. Celebrate achievements, signal transitions, or just keep the energy up. Free classroom audio tool.',
      ogTitle: 'Sound Effects Widget for Classrooms | Classroom Widgets',
      ogDescription: 'A grid of sound effect buttons for your classroom. Celebrate achievements, signal transitions, or keep energy high. Free, no login required.',
    },
    accent: 'dusty-rose',
    heroGradient: 'from-dusty-rose-50 to-sage-50',
    heroIcon: FaVolumeHigh,
    heading: 'Sound Effects',
    lede: 'A grid of audio cue buttons at your fingertips. Applause for a great answer, a drumroll for a reveal, a buzzer for time\'s up — add a bit of theatre to your classroom.',
    steps: {
      heading: 'How to use Sound Effects',
      items: [
        { step: 1, title: 'Launch the Sound Effects widget', body: 'Click Sound Effects in the toolbar. A responsive grid of audio buttons appears on your canvas.' },
        { step: 2, title: 'Click a button to play', body: 'Each button plays a different sound effect. Click any time — mid-sentence, mid-activity, whenever the moment calls for it.' },
        { step: 3, title: 'Use keyboard shortcuts', body: 'When the widget is focused, press 1–9 and 0 to trigger the first 10 sounds by keyboard — no need to click.' },
      ],
    },
    cards: {
      heading: 'Features',
      accent: 'dusty-rose',
      columns: 3,
      items: [
        { icon: FaTableCells, title: 'Responsive grid', body: 'Buttons lay out in a responsive grid — resize the widget and it adapts so all buttons stay accessible.' },
        { icon: FaMusic, title: 'Variety of sounds', body: 'From applause to buzzers to drumrolls — sounds for celebrating, warning, and signalling transitions.' },
        { icon: FaCheck, title: 'Keyboard shortcuts', body: 'Focus the widget and press 1–9, 0 to trigger sounds by keyboard. Keep your hands free while teaching.' },
      ],
    },
    tips: {
      heading: 'Tips',
      items: [
        'Use applause when a student gives a great answer — it\'s more fun than just saying "well done".',
        'Use the buzzer as a "time\'s up" signal alongside the Timer widget for a more dramatic end.',
        'Use a drumroll before revealing a Randomiser result to build suspense.',
        'Use keyboard shortcuts so you can trigger sounds mid-explanation without breaking your flow.',
      ],
    },
  },

  taskCue: {
    slug: 'task-cue',
    meta: {
      title: 'Task Cue Widget — Visual Work Mode Indicator for Classrooms | Classroom Widgets',
      description: 'Show students what mode they should be in — silent work, pair discussion, group work, or free time — with a large visual indicator on your classroom screen. Free.',
      ogTitle: 'Task Cue Widget | Classroom Widgets',
      ogDescription: 'Show students what work mode they should be in with a large visual indicator. Free classroom tool, no login required.',
    },
    accent: 'dusty-rose',
    heroGradient: 'from-dusty-rose-50 to-terracotta-50',
    heroIcon: FaBriefcase,
    heading: 'Task Cue',
    lede: 'Tell the room what mode they\'re in without saying a word. A large visual indicator on your screen shows whether students should be working silently, discussing, or in a group activity.',
    steps: {
      heading: 'How to use the Task Cue widget',
      items: [
        { step: 1, title: 'Launch the Task Cue widget', body: 'Click Task Cue in the toolbar. The widget shows a large visual mode indicator.' },
        { step: 2, title: 'Select the work mode', body: 'Click through the available modes to match what the class should be doing — options include silent work, pair work, group work, and more.' },
        { step: 3, title: 'Leave it visible', body: 'Keep the Task Cue on screen alongside your other widgets. Students can glance at it when they\'re unsure what they should be doing.' },
        { step: 4, title: 'Switch modes as the lesson changes', body: 'Click to change mode at any point. The display updates instantly so the whole class sees the transition.' },
      ],
    },
    cards: {
      heading: 'Features',
      accent: 'dusty-rose',
      columns: 2,
      items: [
        { icon: FaEye, title: 'Large, visible display', body: 'Designed to be readable from the back of the room — big icon, clear label, high contrast colours.' },
        { icon: FaBriefcase, title: 'Multiple work modes', body: 'Switch between silent work, pair discussion, group work, and free time with a single click.' },
        { icon: FaCheck, title: 'No verbal instruction needed', body: 'Students can self-regulate based on what\'s on screen — less repeating yourself, more teaching.' },
        { icon: FaArrowRight, title: 'Instant transitions', body: 'Change mode mid-lesson without disrupting your flow. The display updates immediately.' },
      ],
    },
    tips: {
      heading: 'Tips for using the Task Cue',
      items: [
        'Leave it on screen at all times so students develop the habit of checking it before asking "what are we doing?"',
        'Use it to signal transitions — switching the mode cue is a clear, low-noise way to tell the class to change gears.',
        'Pair with the Timer widget — set the timer for how long students have in a given mode, and display the cue for what they should be doing.',
      ],
    },
  },

  textBanner: {
    slug: 'text-banner',
    meta: {
      title: 'Text Banner Widget — Big Screen Text for Classrooms | Classroom Widgets',
      description: 'Display large, readable text on your classroom screen. Announcements, instructions, shoutouts — anything you want the whole room to see at a glance. Free.',
      ogTitle: 'Text Banner Widget | Classroom Widgets',
      ogDescription: 'Display large, readable text on your classroom screen. Announcements, instructions, shoutouts. Free, no login required.',
    },
    accent: 'terracotta',
    heroGradient: 'from-terracotta-50 to-sage-50',
    heroIcon: FaFont,
    heading: 'Text Banner',
    lede: 'Put anything in big, bold text on your classroom screen. Instructions, reminders, shoutouts, or the WiFi password — if you want the whole room to read it, put it in a Text Banner.',
    steps: {
      heading: 'How to use the Text Banner',
      items: [
        { step: 1, title: 'Launch the Text Banner widget', body: 'Click Text Banner in the toolbar. A large text display appears on your canvas.' },
        { step: 2, title: 'Type or paste your text', body: 'Click the banner and type directly. The text scales to fill the widget so it\'s always as large as possible.' },
        { step: 3, title: 'Resize as needed', body: 'Drag the widget to make it bigger or smaller. The text auto-sizes to fit, so it stays readable at any size.' },
        { step: 4, title: 'Run multiple banners', body: 'Add more than one Text Banner to show different pieces of information simultaneously — e.g. the task and the deadline.' },
      ],
    },
    cards: {
      heading: 'Features',
      accent: 'terracotta',
      columns: 2,
      items: [
        { icon: FaFont, title: 'Auto-scaling text', body: 'Text grows to fill the widget — resize the widget and the text keeps pace. Always readable, never cramped.' },
        { icon: FaPalette, title: 'Customisable style', body: 'Change colours and styling to match your classroom aesthetic or highlight important messages.' },
        { icon: FaCheck, title: 'Paste-friendly', body: 'Paste from anywhere — a doc, a browser, a spreadsheet. The banner displays exactly what you paste.' },
        { icon: FaArrowRight, title: 'Always visible', body: 'Leave it on screen throughout the lesson. Students glance up and always know what the current task or instruction is.' },
      ],
    },
    tips: {
      heading: 'Tips',
      items: [
        'Show the lesson objective at the top of the screen throughout class — students (and observers) always know what the lesson is about.',
        'Use it for the WiFi password at the start of class so students don\'t have to ask.',
        'Use it for shoutouts — put a student\'s name up in big text when they do something great.',
        'Paste directly from your lesson plan — no reformatting needed.',
      ],
    },
  },

  timer: {
    slug: 'timer',
    meta: {
      title: 'Classroom Timer Widget — Countdown Timer for Teachers | Classroom Widgets',
      description: 'A visual countdown timer for your classroom. Quick-add controls, target clock time, sound alerts, and state that survives page reloads. Free, no login.',
      ogTitle: 'Classroom Timer Widget | Classroom Widgets',
      ogDescription: 'A visual countdown timer for your classroom. Quick-add controls, target clock time, sound alerts, and state that survives page reloads. Free.',
    },
    accent: 'sage',
    heroGradient: 'from-sage-50 to-terracotta-50',
    heroIcon: FaClock,
    heading: 'Timer',
    lede: 'A large visual countdown timer the whole class can see. Set a time, start it, and get back to teaching — the timer handles the rest.',
    steps: {
      heading: 'How to use the timer',
      items: [
        { step: 1, title: 'Launch the Timer widget', body: 'Click Timer in the toolbar. A large circular timer appears on your canvas.' },
        { step: 2, title: 'Set the time', body: 'Click any segment of the time display (hours, minutes, seconds) to edit it. Type the value and press Tab or Enter to confirm.' },
        { step: 3, title: 'Start', body: 'Hit the play button. The rainbow arc counts down and a hamster runs along it. Students love it.' },
        { step: 4, title: 'Adjust on the fly', body: 'Use the quick-add tray (+1m, +2m, +5m) to add time without stopping. Or open the target time tray to count down to a specific clock time like 2:30 PM.' },
        { step: 5, title: 'When time is up', body: 'The timer plays a sound and the display shakes. Click restart to run it again with the same duration.' },
      ],
    },
    cards: {
      heading: 'Features',
      accent: 'sage',
      columns: 3,
      items: [
        { icon: FaPlus, title: 'Quick-add controls', body: 'Add 1, 2, or 5 minutes with a single tap — without stopping the timer or losing your flow.' },
        { icon: FaBullseye, title: 'Target clock time', body: 'Count down to a specific time of day (e.g. "until 2:30 PM") instead of setting a duration manually.' },
        { icon: FaVolumeHigh, title: 'Sound modes', body: 'Choose from quiet (no sound), short beep, or long chime when the timer ends. Cycle through with the speaker button.' },
      ],
    },
    tips: {
      heading: 'Tips for using the timer',
      items: [
        'Use the target time feature at the start of class — "we\'re working until 2:30" is clearer than "you have 23 minutes".',
        'Pair the timer with the Handout widget — share the task link and start the countdown together.',
        'The timer state persists through page reloads — if you accidentally refresh, it picks up where it left off.',
        'Run multiple timers simultaneously on the canvas for group activities with different time limits.',
      ],
    },
  },

  trafficLight: {
    slug: 'traffic-light',
    meta: {
      title: 'Traffic Light Widget for Classrooms — Red Amber Green Status | Classroom Widgets',
      description: 'A simple red, amber, green traffic light for your classroom screen. Signal go, slow down, or stop at a glance — no words needed. Free, no login required.',
      ogTitle: 'Traffic Light Widget | Classroom Widgets',
      ogDescription: 'Signal go, slow down, or stop to your class with a simple traffic light display. Free classroom tool, no login required.',
    },
    accent: 'sage',
    heroGradient: 'from-sage-50 to-terracotta-50',
    heroIcon: FaTrafficLight,
    heading: 'Traffic Light',
    lede: 'The simplest widget in the box. A red, amber, green traffic light on your classroom screen — click to change colour, no explanation needed.',
    steps: {
      heading: 'How to use the Traffic Light',
      items: [
        { step: 1, title: 'Launch the Traffic Light widget', body: 'Click Traffic Light in the toolbar. A large traffic light appears on your canvas.' },
        { step: 2, title: 'Click to change colour', body: 'Click the widget to cycle through red, amber, and green. The active colour lights up prominently.' },
        { step: 3, title: 'Students read the signal', body: 'Green means go (start working, quiet working). Amber means slow down or get ready to transition. Red means stop (pause, look at the board).' },
      ],
    },
    cards: {
      heading: 'What each colour means',
      accent: 'sage',
      columns: 3,
      items: [
        { icon: FaCircle, iconClassName: 'text-3xl text-green-500 mb-3', title: 'Green — Go', body: 'Students are working, the class is in flow. Keep going, no interruptions.' },
        { icon: FaCircle, iconClassName: 'text-3xl text-amber-500 mb-3', title: 'Amber — Slow down', body: 'Wrapping up, getting ready to transition. Students should finish what they\'re doing and look up soon.' },
        { icon: FaCircle, iconClassName: 'text-3xl text-red-500 mb-3', title: 'Red — Stop', body: 'Whole class attention needed. Pens down, eyes forward.' },
      ],
    },
    tips: {
      heading: 'Tips',
      items: [
        'Establish the meaning of each colour with your class early in term — then the widget does the communication for you.',
        'Use amber as a 2-minute warning before switching to red for a whole-class pause.',
        'Works particularly well for younger students who respond well to visual, non-verbal cues.',
      ],
    },
  },
} satisfies Record<string, WidgetLandingPageConfig>;
