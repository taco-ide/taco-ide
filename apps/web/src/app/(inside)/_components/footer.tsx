import Image from "next/image";
import Link from "next/link";

const Footer = () => {
  return (
    <footer className="shrink-0 bg-gradient-to-t from-[#151822] to-[#1a1f2e] py-4">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center gap-3 sm:grid sm:grid-cols-3 sm:items-center">
          <Link
            href="/explore"
            className="flex items-center gap-2 rounded-lg outline-offset-4 hover:opacity-90 transition-opacity sm:justify-self-start"
            aria-label="Ir para Explorar"
          >
            <Image
              src="/mini-logo.png"
              alt="TACO Logo"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="text-lg font-bold text-[#FFB800]">TACO</span>
          </Link>
          <div className="flex gap-6 text-sm text-gray-400 sm:justify-self-center">
            <a href="#recursos" className="hover:text-white transition-colors">
              Recursos
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
          <p className="text-center text-gray-500 text-xs sm:justify-self-end sm:text-right">
            &copy; 2024 TACO.
            <br />
            Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
