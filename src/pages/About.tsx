import React from 'react';
import { FaChartColumn, FaQuestion, FaMusic, FaClock, FaComments, FaDice, FaArrowRight, FaChalkboardUser, FaUsers, FaRocket, FaCheck, FaTriangleExclamation, FaFaceSadTear, FaLightbulb, FaLock, FaShieldHalved } from 'react-icons/fa6';
import { CustomStickerIcons } from '../features/widgets/sticker/CustomStickerIcons';
import { FloatingWidgets } from './components/FloatingWidgets';

const About: React.FC = () => {
  const features = [
    {
      icon: FaChartColumn,
      title: "Live Polls",
      description: "Create instant polls and see results in real-time as students vote from their devices"
    },
    {
      icon: FaQuestion,
      title: "Q&A Sessions",
      description: "Let students submit questions anonymously and manage them with ease during lectures"
    },
    {
      icon: FaMusic,
      title: "Sound Effects",
      description: "Add fun audio cues to celebrate achievements and keep energy high"
    },
    {
      icon: FaClock,
      title: "Classroom Timer",
      description: "Keep activities on track with a visual timer everyone can see"
    },
    {
      icon: FaComments,
      title: "Real-time Feedback",
      description: "Get instant feedback from students with quick reactions and sentiment checks"
    },
    {
      icon: FaDice,
      title: "Random Picker",
      description: "Fairly select students, teams, or items with an animated randomizer"
    }
  ];

  const benefits = [
    {
      icon: FaChalkboardUser,
      title: "Engage Every Student",
      description: "Even that one kid in the back who's definitely on TikTok right now"
    },
    {
      icon: FaUsers,
      title: "Zero Security Theatre",
      description: "No logins because we're scared of storing your data. We can barely store our own passwords."
    },
    {
      icon: FaRocket,
      title: "Currently Free",
      description: "Not freemium. Not 'free trial'. Just free. We literally don't know how to add payments."
    }
  ];

  return (
    <div className="min-h-screen bg-soft-white dark:bg-warm-gray-900 overflow-hidden relative">
      {/* Floating Widgets */}
      <FloatingWidgets />
      {/* Navigation */}
      <nav className="bg-white/80 dark:bg-warm-gray-800/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-warm-gray-200 dark:border-warm-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="Classroom Widgets Logo" 
                className="w-10 h-10 object-contain"
              />
              <div>
                <h1 className="text-xl font-bold text-warm-gray-900 dark:text-warm-gray-100">
                  Classroom Widgets
                </h1>
                <p className="text-xs text-warm-gray-600 dark:text-warm-gray-400 -mt-1">
                  Swiss Army Knife for Teaching
                </p>
              </div>
            </div>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-sage-500 text-white rounded-lg hover:bg-sage-600 transition-colors"
            >
              Try It Now
              <FaArrowRight className="text-sm" />
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-sage-300 dark:bg-sage-700 rounded-full filter blur-3xl opacity-30"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-dusty-rose-300 dark:bg-dusty-rose-700 rounded-full filter blur-3xl opacity-30"></div>
          <div className="absolute top-40 right-20 w-64 h-64 bg-terracotta-300 dark:bg-terracotta-700 rounded-full filter blur-3xl opacity-20"></div>
        </div>
        {/* Subtle decorative images */}
        <div className="absolute bottom-0 left-1/4 opacity-[0.03] dark:opacity-[0.02] transform -translate-x-1/2">
          <img src="/randomiser.png" alt="" className="w-80 h-auto" />
        </div>
        
        <div className="max-w-7xl mx-auto text-center relative z-20">
          <div className="flex justify-center gap-6 mb-6 flex-wrap">
            <div className="animate-bounce" style={{ animationDelay: '0ms' }}>
              <CustomStickerIcons.fire className="w-16 h-16 text-terracotta-500" />
            </div>
            <div className="animate-bounce hidden md:block" style={{ animationDelay: '200ms' }}>
              <CustomStickerIcons.star className="w-16 h-16 text-sage-500" />
            </div>
            <div className="animate-bounce hidden md:block" style={{ animationDelay: '400ms' }}>
              <CustomStickerIcons.heart className="w-16 h-16 text-dusty-rose-500" />
            </div>
            <div className="animate-bounce" style={{ animationDelay: '600ms' }}>
              <CustomStickerIcons.smile className="w-16 h-16 text-terracotta-400" />
            </div>
          </div>
          <h2 className="text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-terracotta-600 via-sage-600 to-dusty-rose-600 bg-clip-text text-transparent">
              &gt; 90% Vibe-Coded
            </span>
            <span className="text-warm-gray-900 dark:text-warm-gray-100"> Classroom Magic</span>
          </h2>
          <p className="text-xl text-warm-gray-600 dark:text-warm-gray-400 mb-4 max-w-3xl mx-auto">
            We built this instead of grading papers. Interactive classroom tools that actually work - 
            timers, polls, Q&A, randomizers, and more. All in one place, zero setup required.
          </p>
          <p className="text-lg mb-4 text-warm-gray-500 dark:text-warm-gray-400 italic">
            Warning: May cause excessive student engagement and spontaneous learning
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-terracotta-500 to-terracotta-600 text-white rounded-lg hover:from-terracotta-600 hover:to-terracotta-700 transition-all transform hover:scale-105 text-lg font-medium shadow-lg"
            >
              Start Teaching
              <FaArrowRight />
            </a>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sage-100 to-dusty-rose-100 dark:from-sage-800 dark:to-dusty-rose-800 text-sage-800 dark:text-sage-100 rounded-lg hover:from-sage-200 hover:to-dusty-rose-200 dark:hover:from-sage-700 dark:hover:to-dusty-rose-700 transition-all text-lg font-medium border-2 border-sage-200 dark:border-sage-700"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-warm-gray-50 dark:bg-warm-gray-800 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-10 right-20 animate-pulse">
          <CustomStickerIcons.star className="w-8 h-8 text-yellow-400 opacity-20" />
        </div>
        <div className="absolute bottom-10 left-20 animate-bounce" style={{ animationDelay: '1s' }}>
          <CustomStickerIcons.heart className="w-6 h-6 text-red-400 opacity-20" />
        </div>
        {/* Additional decorative background image */}
        <div className="absolute top-1/2 -right-48 transform -translate-y-1/2 opacity-5 dark:opacity-[0.02]">
          <img src="/more.png" alt="" className="w-96 h-auto rotate-45" />
        </div>
        
        <div className="max-w-7xl mx-auto relative z-20">
          <h3 className="text-3xl font-bold text-center text-warm-gray-900 dark:text-warm-gray-100 mb-12">
            Tools That Actually Work (We're As Surprised As You Are)
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white dark:bg-warm-gray-700 p-6 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-warm-gray-100 dark:border-warm-gray-600 group"
              >
                <feature.icon className={`text-3xl mb-4 ${
                  index % 3 === 0 ? 'text-terracotta-500' : 
                  index % 3 === 1 ? 'text-sage-500' : 
                  'text-dusty-rose-500'
                }`} />
                <h4 className="text-xl font-semibold text-warm-gray-900 dark:text-warm-gray-100 mb-2">
                  {feature.title}
                </h4>
                <p className="text-warm-gray-600 dark:text-warm-gray-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* See It In Action */}
      <section className="py-20 px-4 bg-warm-gray-50 dark:bg-warm-gray-800 relative overflow-hidden">
        {/* Decorative background images */}
        <div className="absolute top-10 -left-32 opacity-10 dark:opacity-5 rotate-[-15deg]">
          <img src="/more.png" alt="" className="w-64 h-auto" />
        </div>
        <div className="absolute bottom-10 -right-32 opacity-10 dark:opacity-5 rotate-[15deg]">
          <img src="/randomiser.png" alt="" className="w-72 h-auto" />
        </div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <h3 className="text-3xl font-bold text-center text-warm-gray-900 dark:text-warm-gray-100 mb-12">
            See Classroom Widgets in Action
          </h3>
          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            <div className="rounded-lg overflow-hidden shadow-lg transform hover:scale-105 transition-transform duration-300">
              <div className="aspect-[16/10] w-full">
                <img 
                  src="/classroom-display-1.jpg" 
                  alt="Classroom Widgets on display showing timer and Q&A features"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="rounded-lg overflow-hidden shadow-lg transform hover:scale-105 transition-transform duration-300">
              <div className="aspect-[16/10] w-full">
                <img 
                  src="/classroom-display-2.jpg" 
                  alt="Classroom Widgets being used in a maker space"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-3xl font-bold text-center text-warm-gray-900 dark:text-warm-gray-100 mb-12">
            So Easy, Even We Can Use It
          </h3>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center bg-white dark:bg-warm-gray-700 relative">
              <div className="w-16 h-16 bg-terracotta-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h4 className="text-xl font-semibold text-warm-gray-900 dark:text-warm-gray-100 mb-2">
                Launch Widgets
              </h4>
              <p className="text-warm-gray-600 dark:text-warm-gray-400">
                Just visit the site and launch the widgets you need. Tiny tools for big classroom energy. All batteries included. They just work.* 
                <br />
                <span className="text-xs italic">*mostly</span>
              </p>
            </div>
            <div className="text-center bg-white dark:bg-warm-gray-700 relative">
              <div className="w-16 h-16 bg-sage-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h4 className="text-xl font-semibold text-warm-gray-900 dark:text-warm-gray-100 mb-2">
                Students Join the Party
              </h4>
              <p className="text-warm-gray-600 dark:text-warm-gray-400">
                Want student vibes? They punch in 5 characters and boom - 
                widgets on their screens waiting for their response. It's like magic but with more WiFi issues.
              </p>
            </div>
            <div className="text-center bg-white dark:bg-warm-gray-700 relative">
              <div className="w-16 h-16 bg-dusty-rose-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h4 className="text-xl font-semibold text-warm-gray-900 dark:text-warm-gray-100 mb-2">
                Use Effortlessly
              </h4>
              <p className="text-warm-gray-600 dark:text-warm-gray-400">
                Flash announcements! Race against timers! Collect anonymous feelings! 
                Quick polls about literally anything!
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* Security Section */}
      <section className="py-20 px-4 bg-warm-gray-50 dark:bg-warm-gray-800 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-1/3 -left-64 opacity-[0.03] dark:opacity-[0.02] rotate-[-25deg]">
          <img src="/sessionbanner.png" alt="" className="w-96 h-auto" />
        </div>
        <div className="absolute bottom-1/4 -right-64 opacity-[0.03] dark:opacity-[0.02] rotate-[20deg]">
          <img src="/studentfeedback.png" alt="" className="w-96 h-auto" />
        </div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h3 className="text-3xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">
            <span className="flex items-center justify-center gap-3">
              <FaLock className="text-3xl text-sage-500" />
              Security Model
              <FaShieldHalved className="text-3xl text-sage-600" />
            </span>
          </h3>
          <div className="bg-white dark:bg-warm-gray-700 rounded-lg p-8 shadow-lg mb-8 relative overflow-hidden">
            {/* Session banner as background accent */}
            <div className="absolute -right-32 top-1/2 transform -translate-y-1/2 opacity-[0.08] dark:opacity-[0.05] rotate-12">
              <img src="/sessionbanner.png" alt="" className="w-96 h-auto" />
            </div>
            
            <div className="relative z-10">
              <p className="text-lg text-warm-gray-700 dark:text-warm-gray-300 mb-4">
                <strong>No Authentication = No Password Leaks</strong>
              </p>
              <p className="text-warm-gray-600 dark:text-warm-gray-400 mb-6">
                Can't get hacked if there's nothing to hack. *taps forehead*
              </p>
              <div className="grid md:grid-cols-2 gap-6 text-left">
              <div>
                <h4 className="font-semibold text-warm-gray-900 dark:text-warm-gray-100 mb-2 flex items-center gap-2">
                  <FaCheck className="text-green-500" />
                  What We Don't Store:
                </h4>
                <ul className="text-sm text-warm-gray-600 dark:text-warm-gray-400 space-y-1">
                  <li>• Your personal data (we don't even ask)</li>
                  <li>• Student information (the name field is optional)</li>
                  <li>• Credit cards (we're allergic to money)</li>
                  <li>• Passwords (login? never heard of her)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-warm-gray-900 dark:text-warm-gray-100 mb-2 flex items-center gap-2">
                  <FaTriangleExclamation className="text-amber-500" />
                  Actual Risks:
                </h4>
                <ul className="text-sm text-warm-gray-600 dark:text-warm-gray-400 space-y-1">
                  <li>• Students might actually participate</li>
                  <li>• You might have too much fun</li>
                  <li>• Other teachers will want to know your secret</li>
                  <li>• Possible addiction to rainbow stickers</li>
                </ul>
              </div>
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4 bg-sage-50 dark:bg-warm-gray-800 relative overflow-hidden">
        {/* Subtle decorative element */}
        <div className="absolute top-0 right-0 opacity-[0.02] dark:opacity-[0.01]">
          <img src="/randomiser.png" alt="" className="w-64 h-auto transform translate-x-32 -translate-y-32" />
        </div>
        
        <div className="max-w-4xl mx-auto relative z-10">
          <h3 className="text-3xl font-bold text-center text-warm-gray-900 dark:text-warm-gray-100 mb-12">
            Why This Exists (Spoiler: We Were Bored)
          </h3>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <benefit.icon className="text-4xl text-sage-500 mx-auto mb-4" />
                <h4 className="text-xl font-semibold text-warm-gray-900 dark:text-warm-gray-100 mb-2">
                  {benefit.title}
                </h4>
                <p className="text-warm-gray-600 dark:text-warm-gray-400">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Origin Story */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-3xl font-bold text-center text-warm-gray-900 dark:text-warm-gray-100 mb-12 flex items-center justify-center gap-3">
            <FaLightbulb className="text-3xl text-yellow-500" />
            Origin Story
            <FaRocket className="text-3xl text-terracotta-500" />
          </h3>
          <div className="bg-white dark:bg-warm-gray-700 rounded-lg p-8 shadow-lg z-10 relative">
            <div className="prose prose-lg dark:prose-invert max-w-none text-center">
              <p className="text-warm-gray-700 dark:text-warm-gray-300 mb-6">
                We're tinkerers and tech educators who got tired of having 47 browser tabs open just to find 
                a decent timer and a randomizer wheel that doesn't look like it was made in 2003.
              </p>
              <p className="text-warm-gray-700 dark:text-warm-gray-300 mb-6">
                So we built our own. Then we kept adding more and more, increasingly useless, widgets to it.
                At the same time, vibe coding is changing our industry, and we needed to understand it better. So we decided
                to go all out with using tools like Claude, Gemini and ChatGPT to help build this, and learn what the hype is all about. 
              </p>
              <p className="text-warm-gray-700 dark:text-warm-gray-300 mb-8">
                Want to learn how to vibe code something like this for yourself? Get in touch!
              </p>
              <div className="mt-8 pt-8 border-t border-warm-gray-200 dark:border-warm-gray-600">
                <p className="text-warm-gray-600 dark:text-warm-gray-400 mb-4">
                  Built with love by the team at
                </p>
                <a 
                  href="https://tinkercademy.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sage-600 dark:text-sage-400 hover:text-sage-700 dark:hover:text-sage-300 font-semibold text-xl transition-colors"
                >
                  Tinkercademy
                  <FaArrowRight className="text-sm" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Meta Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-8">
            Fun Fact: This page was also vibe-coded in 20 minutes
          </h3>
          <div className="bg-gradient-to-r from-pink-100 to-blue-100 dark:from-warm-gray-700 dark:to-warm-gray-700 rounded-lg p-8 shadow-lg">
            <div className="flex justify-center gap-3 mb-4 flex-wrap">
              <CustomStickerIcons.smile className="w-8 h-8 text-pink-500 animate-pulse" />
              <CustomStickerIcons.arrow className="w-8 h-8 text-green-500 animate-bounce hidden sm:block" />
              <CustomStickerIcons.heart className="w-8 h-8 text-red-500 animate-pulse" />
            </div>
            <p className="text-lg text-warm-gray-700 dark:text-warm-gray-300 mb-4">
              We've asked Claude, ChatGPT and Gemini to help build this page.
              Then we added stickers. Then more stickers. Then we made them self-aware.
            </p>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-4 bg-warm-gray-50 dark:bg-warm-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-12">
            Perfect for Every Classroom*
          </h3>
          <div className="bg-gradient-to-br from-sage-50 to-dusty-rose-50 dark:from-warm-gray-700 dark:to-warm-gray-700 rounded-lg p-8 shadow-lg border-2 border-terracotta-200 dark:border-terracotta-700 relative">
            <p className="text-xl text-warm-gray-700 dark:text-warm-gray-300 mb-6">
              *As long as it's a classroom with a projector that actually works
            </p>
            <div className="space-y-4 text-lg text-warm-gray-600 dark:text-warm-gray-400">
              <p>
                <span className="font-semibold text-terracotta-600 dark:text-terracotta-400">Perfect for classes where you give students lots of independent work time</span>
                <br />
                Keep them focused on what needs to be done (as long as they occasionally glance at the screen)
              </p>
              <p>
                <span className="font-semibold text-sage-600 dark:text-sage-400">Perfect for when you need feedback</span>
                <br />
                Because sometimes you actually want to know if they're following along or just nodding politely
              </p>
            </div>
            <div className="mt-6 pt-6 border-t border-warm-gray-200 dark:border-warm-gray-600">
              <p className="text-sm text-warm-gray-500 dark:text-warm-gray-400 italic">
                Not recommended for classes that do not spark joy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-terracotta-500 via-dusty-rose-500 to-sage-500">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h3 className="text-4xl font-bold mb-6">
            Ready to Risk It All?
          </h3>
          <p className="text-xl mb-4 opacity-90">
            Join dozens (maybe hundreds?) of brave educators. 
          </p>
          <p className="text-lg mb-8 opacity-80">
            We promise we're not mining bitcoin on your computer. Probably.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-sage-600 rounded-lg hover:bg-warm-gray-100 transition-colors text-lg font-medium"
          >
            Get Started Now
            <FaArrowRight />
          </a>
        </div>
      </section>

      {/* Feedback Section */}
      <section className="py-20 px-4 bg-warm-gray-50 dark:bg-warm-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-bold text-warm-gray-900 dark:text-warm-gray-100 mb-6 flex items-center justify-center gap-2">
            Send Us Your Complaints!
            <FaFaceSadTear className="text-3xl text-dusty-rose-500" />
          </h3>
          <p className="text-lg text-warm-gray-600 dark:text-warm-gray-400 mb-8">
            Built by people who should be lesson planning instead. Your feedback goes straight to our hearts.
          </p>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <a
              href="mailto:hello+classroomwidgets@tinkertanker.com?subject=Classroom Widgets Feedback"
              className="bg-white dark:bg-warm-gray-700 p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow text-left group"
            >
              <h4 className="font-semibold text-warm-gray-900 dark:text-warm-gray-100 mb-2 group-hover:text-sage-600 dark:group-hover:text-sage-400">
                Share Feedback
              </h4>
              <p className="text-warm-gray-600 dark:text-warm-gray-400 text-sm">
                Tell us what broke and we'll pretend we know how to fix it
              </p>
            </a>
            <a
              href="mailto:hello+classroomwidgets@tinkertanker.com?subject=Feature Request for Classroom Widgets"
              className="bg-white dark:bg-warm-gray-700 p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow text-left group"
            >
              <h4 className="font-semibold text-warm-gray-900 dark:text-warm-gray-100 mb-2 group-hover:text-sage-600 dark:group-hover:text-sage-400">
                Request Features
              </h4>
              <p className="text-warm-gray-600 dark:text-warm-gray-400 text-sm">
                Got ideas? We have a very sophisticated sticky note system
              </p>
            </a>
          </div>
          <p className="mt-8 text-warm-gray-600 dark:text-warm-gray-400">
            Or share your classroom success stories - we love hearing how you're using these tools!
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-warm-gray-900 dark:bg-warm-gray-950 text-white">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex justify-center gap-4 mb-4 flex-wrap">
            <CustomStickerIcons.fire className="w-12 h-12 text-terracotta-400 animate-pulse" />
            <CustomStickerIcons.star className="w-12 h-12 text-sage-400 animate-spin hidden md:block" style={{ animationDuration: '3s' }} />
            <CustomStickerIcons.heart className="w-12 h-12 text-dusty-rose-400 animate-pulse hidden md:block" style={{ animationDelay: '500ms' }} />
            <CustomStickerIcons.thumbsup className="w-12 h-12 text-terracotta-500 animate-bounce" />
            <CustomStickerIcons.check className="w-12 h-12 text-sage-500 animate-pulse" style={{ animationDelay: '1s' }} />
            <CustomStickerIcons.fire className="w-12 h-12 text-dusty-rose-500 animate-pulse hidden md:block" style={{ animationDelay: '1.5s' }} />
          </div>
          <p className="mb-2">
            Made with chaos energy and a lot of agentic AI.
          </p>
          <p className="text-sm text-warm-gray-400 mb-4">
            © {new Date().getFullYear()} Tinkertanker. Free until we figure out Stripe (which may be never).
          </p>
        </div>
      </footer>
    </div>
  );
};

export default About;