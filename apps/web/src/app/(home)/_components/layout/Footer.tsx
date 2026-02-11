import Image from "next/image";

const Footer = () => {
  return (
    <footer className="bg-gradient-to-t from-[#151822] to-[#1a1f2e] py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="flex items-center gap-3">
            <Image
              src="/mini-logo.png"
              alt="TACO-IDE Logo"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <span className="text-xl font-bold text-[#FFB800]">TACO-IDE</span>
          </div>
          <div className="flex gap-8 text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a
              href="https://github.com/taco-ide"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
          <p className="text-gray-500 text-sm">
            &copy; 2025 TACO. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
