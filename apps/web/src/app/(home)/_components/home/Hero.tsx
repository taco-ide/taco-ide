const Hero = () => {
  return (
    <main className="min-h-screen flex items-center relative">
      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block animate-fadeIn">
            <h1 className="text-5xl sm:text-7xl font-bold mb-8 leading-tight">
              <span className="bg-gradient-to-r from-[#FFB800] to-[#FFA000] text-transparent bg-clip-text">
                Learn How to Code
              </span>
              <br />
              <span className="bg-gradient-to-r from-white to-gray-300 text-transparent bg-clip-text">
                With Personalized AI Feedback
              </span>
            </h1>
          </div>
          <p className="text-xl sm:text-2xl mb-12 text-gray-300 animate-fadeInUp delay-200 leading-relaxed max-w-3xl mx-auto">
            A revolutionary open-source platform that unites teachers, students
            and AI for more efficient and personalized learning.
          </p>
          <div className="flex gap-6 justify-center items-center flex-wrap animate-fadeInUp delay-400">
            <a
              href="https://github.com/taco-ide/taco"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative px-8 py-4 rounded-full font-semibold text-white overflow-hidden"
            >
              <div className="absolute inset-0 w-full h-full transition-all duration-300 bg-gradient-to-r from-[#FFB800] to-[#FFA000] group-hover:opacity-90"></div>
              <span className="relative flex items-center gap-2">
                GitHub
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            </a>
            <a
              href="#features"
              className="group relative px-8 py-4 rounded-full font-semibold text-white overflow-hidden"
            >
              <div className="absolute inset-0 w-full h-full transition-all duration-300 bg-gradient-to-r from-[#4CAF50] to-[#45a049] group-hover:opacity-90"></div>
              <span className="relative flex items-center gap-2">
                Info
                <svg
                  className="w-5 h-5 transform group-hover:translate-x-1 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#4CAF50] rounded-full filter blur-[128px] opacity-20 animate-pulse"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#FFB800] rounded-full filter blur-[128px] opacity-10 animate-pulse delay-1000"></div>
      </div>
    </main>
  );
};

export default Hero;
